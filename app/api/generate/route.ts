import { NextResponse } from "next/server";
import * as yaml from "js-yaml";
import { createClient } from "@/lib/supabase/server";

const GITHUB_REPO = "theacidtimes/trendreport";

export async function POST(req: Request) {
  try {
    const { briefing: briefingYaml, marcaId } = (await req.json()) as {
      briefing: string;
      marcaId?: string | null;
    };

    if (!briefingYaml || typeof briefingYaml !== "string") {
      return NextResponse.json(
        { error: "Campo 'briefing' é obrigatório." },
        { status: 400 }
      );
    }

    let briefing: Record<string, unknown>;
    try {
      briefing = yaml.load(briefingYaml) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "YAML inválido no briefing." },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // Enforcement pré-voo (ANTES de criar o job e disparar o Action — falha
    // rápido, não gasta compute). Resolvidos pelo claim do usuário (jwt_tenant_id):
    //  - status do tenant: suspenso/cancelado não gera nada (Fase de enforcement);
    //  - módulo "reports": tenant que não assinou o app de reports não gera;
    //  - créditos (Fase 3B): sem saldo, não gera. O débito de verdade segue no
    //    fim da geração (idempotente, service_role).
    const [{ data: status }, { data: modulos, error: modErr }, { data: resumo }] =
      await Promise.all([
        supabase.rpc("meu_tenant_status"),
        supabase.rpc("meus_modulos"),
        supabase.rpc("credito_resumo"),
      ]);

    if (status === "suspenso" || status === "cancelado") {
      return NextResponse.json(
        {
          error:
            "Conta inativa. Fale com o administrador para reativar antes de gerar reports.",
        },
        { status: 403 }
      );
    }

    // Fail-open no erro da rpc (não trava geração por blip); estrito quando a
    // lista chega e não inclui "reports".
    if (!modErr && Array.isArray(modulos) && !modulos.includes("reports")) {
      return NextResponse.json(
        {
          error:
            "O módulo de Reports não está no seu plano. Fale com o administrador para habilitar.",
        },
        { status: 403 }
      );
    }

    const saldo = (Array.isArray(resumo) ? resumo[0]?.saldo : undefined) ?? 0;
    if (saldo <= 0) {
      return NextResponse.json(
        {
          error:
            "Sem créditos disponíveis. Recarregue ou fale com o administrador para continuar gerando reports.",
        },
        { status: 402 }
      );
    }

    const cliente =
      typeof briefing.cliente === "string" ? briefing.cliente : "Cliente";

    // A geração de verdade (scraping + Claude) roda fora do Vercel, via
    // GitHub Actions — o plano atual limita funções serverless a 60s, bem
    // menos que os minutos que o pipeline real leva. Aqui só criamos o job
    // pendente e disparamos o workflow; a rota responde na hora.
    const { data: saved, error: saveError } = await supabase
      .from("reports")
      .insert({
        user_id: user.id,
        cliente,
        briefing,
        // Report avulso = marca_id null (o gerador cai no fallback neutro, o
        // briefing manda). Com marca escolhida, o gerador bebe do DNA do YAML.
        marca_id: typeof marcaId === "string" && marcaId ? marcaId : null,
        report: null,
        status: "pending",
      })
      .select("slug")
      .single();

    if (saveError || !saved) {
      console.error("Erro ao criar report no Supabase:", saveError);
      const detail = saveError
        ? [saveError.message, saveError.details, saveError.hint, saveError.code]
            .filter(Boolean)
            .join(" | ") || JSON.stringify(saveError)
        : "Nenhum dado retornado pelo insert.";
      return NextResponse.json(
        { error: "Falha ao criar report no Supabase.", detail },
        { status: 500 }
      );
    }

    const dispatchToken = process.env.GITHUB_DISPATCH_TOKEN;
    if (!dispatchToken) {
      await supabase
        .from("reports")
        .update({
          status: "error",
          error_message: "GITHUB_DISPATCH_TOKEN não configurado.",
        })
        .eq("slug", saved.slug);
      return NextResponse.json(
        { error: "Geração assíncrona não configurada (GITHUB_DISPATCH_TOKEN ausente)." },
        { status: 500 }
      );
    }

    const dispatchRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${dispatchToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: "generate-report",
          client_payload: { slug: saved.slug, briefing_yaml: briefingYaml },
        }),
      }
    );

    if (!dispatchRes.ok) {
      const detail = await dispatchRes.text();
      await supabase
        .from("reports")
        .update({
          status: "error",
          error_message: `Falha ao disparar geração: ${dispatchRes.status} ${detail}`,
        })
        .eq("slug", saved.slug);
      return NextResponse.json(
        { error: "Falha ao disparar geração assíncrona.", detail },
        { status: 502 }
      );
    }

    return NextResponse.json({ slug: saved.slug });
  } catch (err) {
    console.error("Erro inesperado em /api/generate:", err);

    return NextResponse.json(
      {
        error: "Erro inesperado ao gerar relatório.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

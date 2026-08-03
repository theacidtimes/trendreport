import { createClient } from "@supabase/supabase-js";
import * as yaml from "js-yaml";
import WebSocket from "ws";
import { generateReport } from "../lib/generateReport";
import { registrarCustos } from "../lib/custos";
import type { MarcaKnowledge } from "../lib/types";

async function main() {
  const slug = process.env.REPORT_SLUG;
  const briefingYaml = process.env.BRIEFING_YAML;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!slug || !briefingYaml) {
    throw new Error("REPORT_SLUG e BRIEFING_YAML são obrigatórios.");
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios (verifique os secrets do repositório)."
    );
  }

  console.log("FASE 0: process.version =", process.version);

  // O runner do GitHub Actions nem sempre expõe um WebSocket global nativo
  // (depende da build exata do Node), e o @supabase/supabase-js quebra na
  // criação do client sem isso — mesmo sem usarmos Realtime. Passar o `ws`
  // como transporte explícito evita essa detecção de ambiente por completo.
  //
  // Nota de tipagem: criamos via uma função concreta (não generic) e usamos
  // `ReturnType<typeof buildSupabaseClient>` pra anotar `supabase` — anotar
  // direto como `ReturnType<typeof createClient>` faz o TS resolver os
  // generics do createClient sem os argumentos reais, colapsando os tipos de
  // linha das tabelas pra `never` (e quebrando `next build` no Vercel).
  function buildSupabaseClient() {
    return createClient(supabaseUrl!, supabaseServiceKey!, {
      realtime: { transport: WebSocket as never },
    });
  }

  let supabase: ReturnType<typeof buildSupabaseClient>;
  try {
    supabase = buildSupabaseClient();
    console.log("FASE 1: client Supabase criado com sucesso.");
  } catch (err) {
    console.error(
      "FASE 1 FALHOU (criação do client Supabase):",
      err instanceof Error ? err.message : String(err)
    );
    throw err;
  }

  try {
    const briefing = yaml.load(briefingYaml) as Record<string, unknown>;
    console.log("FASE 2: briefing parseado, iniciando generateReport()...");

    // Fonte única de marca: se o report está ligado a uma marca (marca_id), o
    // gerador bebe do yaml_conhecimento dela. Sem marca_id, marcaKnowledge fica
    // undefined e o gerador cai no bloco de marca padrão (comportamento atual).
    let marcaKnowledge: MarcaKnowledge | undefined;
    // tenant_id vem junto porque é ele que dá dono ao custo de fornecedor
    // gasto nesta geração (ver registrarCustos mais abaixo).
    const { data: reportRow, error: reportError } = await supabase
      .from("reports")
      .select("marca_id, tenant_id")
      .eq("slug", slug)
      .maybeSingle();
    if (reportError) {
      console.error("Falha ao ler marca_id do report (segue no fallback):", reportError.message);
    } else if (reportRow?.marca_id) {
      const { data: marcaRow, error: marcaError } = await supabase
        .from("marcas")
        .select("yaml_conhecimento")
        .eq("id", reportRow.marca_id)
        .maybeSingle();
      if (marcaError) {
        console.error("Falha ao carregar marca (segue no fallback):", marcaError.message);
      } else if (marcaRow?.yaml_conhecimento) {
        marcaKnowledge = marcaRow.yaml_conhecimento as MarcaKnowledge;
        console.log("FASE 2b: marca carregada, gerador vai usar o yaml_conhecimento.");
      }
    }

    const result = await generateReport(briefingYaml, briefing, async (progress) => {
      console.log("PROGRESSO:", JSON.stringify(progress));
      // Best-effort: se essa update falhar, a coleta/geração continua normal —
      // só a barra de progresso na interface fica parada até o próximo passo.
      const { error } = await supabase
        .from("reports")
        .update({ progress })
        .eq("slug", slug);
      if (error) {
        console.error("Falha ao atualizar progress (não bloqueia a geração):", error.message);
      }
    }, marcaKnowledge);
    console.log("FASE 3: generateReport() concluído.", "error" in result ? "(com erro)" : "(sucesso)");

    // CUSTO REAL DESTA GERAÇÃO, com dono.
    //
    // Este é o ponto que fechou o buraco do "NAO ATRIBUIDO" em /console/custos:
    // antes o report usava o endpoint síncrono da Apify, que não devolve run
    // id, então o dólar existia na fatura e não tinha como ser ligado a um
    // tenant. Com o runActor refatorado, cada run vem identificado até aqui —
    // que é o único lugar da cadeia que sabe de quem é o report.
    //
    // Roda ANTES do desvio de erro de propósito: geração que falhou no meio já
    // consumiu scrape e token, e esse dinheiro saiu igual. E não bloqueia: se
    // o registro de custo falhar, o report ainda é entregue (registrarCustos
    // loga o problema por dentro).
    if (result.custos.length) {
      await registrarCustos(
        supabase,
        result.custos.map((c) => ({
          ...c,
          tenantId: reportRow?.tenant_id ?? null,
          marcaId: reportRow?.marca_id ?? null,
          origem: "report" as const,
        }))
      );
      const totalUsd = result.custos.reduce((s, c) => s + c.custoUsd, 0);
      console.log(
        `[REPORT][CUSTO] ${result.custos.length} evento(s) registrado(s), ` +
          `US$${totalUsd.toFixed(4)} — tenant=${reportRow?.tenant_id ?? "SEM DONO"}`
      );
    } else {
      // Chegar aqui sem nenhum evento significa que nem a Apify nem o Anthropic
      // devolveram algo mensurável. Não é normal e não deve passar calado.
      console.error(
        `[REPORT][CUSTO] nenhum evento de custo medido nesta geracao (slug=${slug}) — ` +
          `o painel financeiro vai subestimar o gasto deste report`
      );
    }

    if ("error" in result) {
      await supabase
        .from("reports")
        .update({ status: "error", error_message: result.error })
        .eq("slug", slug);
      console.error("Geração falhou:", result.error);
      return;
    }

    console.log("FASE 4: salvando report no Supabase...");
    const { data: updateData, error: updateError } = await supabase
      .from("reports")
      .update({ status: "ready", report: result.report })
      .eq("slug", slug)
      .select("slug, status");
    console.log("FASE 5: update concluído.", JSON.stringify({ updateData, updateError }));

    if (updateError) {
      throw new Error(`Falha ao salvar report no Supabase: ${updateError.message}`);
    }

    if (!updateData || updateData.length === 0) {
      throw new Error(
        `Update não afetou nenhuma linha (slug não encontrado?): ${JSON.stringify(slug)}`
      );
    }

    // Metering (Fase 3A): 1 report = 1 crédito. Debitado no ponto onde o
    // trabalho de fato termina (report salvo como "ready"). Idempotente por
    // report.id no lado do banco. NÃO bloqueia: metering, não trava (trava é 3B).
    //
    // ATENÇÃO ao formato do erro: supabase-js NÃO rejeita a promise quando o
    // Postgres devolve erro — resolve com { data, error }. Sem ler o `error`,
    // um report podia ser entregue ao cliente sem nunca ser cobrado, em
    // silêncio absoluto. Segue sem bloquear (o report já está pronto), mas
    // agora falha ruidosamente.
    try {
      const { error: cobrancaErr } = await supabase.rpc("cobrar_report", {
        p_slug: slug,
      });
      if (cobrancaErr) {
        console.error(
          `[REPORT][CUSTO] FALHA AO DEBITAR CREDITO — report entregue sem ` +
            `cobrar. slug=${slug}: ${cobrancaErr.message}`
        );
      }
    } catch (e) {
      console.error(
        `[REPORT][CUSTO] FALHA AO DEBITAR CREDITO (excecao) slug=${slug}:`,
        e
      );
    }

    console.log(`Report ${slug} gerado com sucesso.`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("FASE X: erro capturado no bloco principal:", detail);
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    await supabase
      .from("reports")
      .update({ status: "error", error_message: `Erro inesperado ao gerar relatório: ${detail}` })
      .eq("slug", slug);
    console.error("Erro inesperado:", detail);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  // Se chegou aqui, quebrou antes de ter um client do Supabase pra registrar
  // o erro na linha (ex: env var ausente) — pelo menos deixa claro no log.
  console.error(
    "Erro fatal antes de conseguir salvar status no Supabase:",
    err instanceof Error ? err.message : String(err)
  );
  process.exitCode = 1;
});

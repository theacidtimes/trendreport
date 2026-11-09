import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  refsValidas,
  resolverItens,
  type BriefingMontado,
} from "@/lib/montarReport";

// Cria um report montado a partir de itens do acervo. A rota só valida e
// enfileira: a linha nasce em "pending" com um briefing de modo "montado", e o
// worker da fila escreve o report com o mesmo modelo dos gerados, usando os
// itens escolhidos no lugar de uma coleta (ver lib/redigirMontado.ts). Como
// passa pelo modelo, consome 1 crédito, igual ao report gerado.
//
// O cliente manda só ids. Imagem, link, autor e texto são relidos do banco
// (com a RLS do tenant) aqui e de novo no worker.

type Body = {
  marcaId?: string;
  produto?: string;
  edicao?: string;
  tituloSocial?: string;
  orientacao?: string;
  tendencias?: unknown;
  memes?: unknown;
};

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const marcaId = typeof body.marcaId === "string" ? body.marcaId : "";
  const tendenciasRef = refsValidas(body.tendencias);
  const memesRef = refsValidas(body.memes);
  if (!marcaId) {
    return NextResponse.json({ error: "Escolha a marca." }, { status: 400 });
  }
  if (tendenciasRef.length + memesRef.length === 0) {
    return NextResponse.json({ error: "Adicione pelo menos um item ao report." }, { status: 400 });
  }

  // Mesmo pré-voo do /api/generate.
  const [{ data: status }, { data: modulos, error: modErr }, { data: resumo }, { data: marca }] =
    await Promise.all([
      supabase.rpc("meu_tenant_status"),
      supabase.rpc("meus_modulos"),
      supabase.rpc("credito_resumo"),
      supabase.from("marcas").select("id, nome").eq("id", marcaId).maybeSingle(),
    ]);
  if (status === "suspenso" || status === "cancelado") {
    return NextResponse.json(
      { error: "Conta inativa. Fale com o administrador para reativar." },
      { status: 403 }
    );
  }
  if (!modErr && Array.isArray(modulos) && !modulos.includes("reports")) {
    return NextResponse.json(
      { error: "O módulo de Reports não está no seu plano." },
      { status: 403 }
    );
  }
  const saldo = (Array.isArray(resumo) ? resumo[0]?.saldo : undefined) ?? 0;
  if (saldo <= 0) {
    return NextResponse.json(
      { error: "Sem créditos disponíveis. Recarregue ou fale com o administrador." },
      { status: 402 }
    );
  }
  if (!marca) {
    return NextResponse.json({ error: "Marca não encontrada." }, { status: 404 });
  }

  // Confere já aqui que os itens existem e são da marca, pra não enfileirar
  // um report que o worker não teria com o que escrever.
  const itens = await resolverItens(supabase, marcaId, { tendencias: tendenciasRef, memes: memesRef });
  if ("error" in itens) {
    return NextResponse.json({ error: "Falha ao ler o acervo.", detail: itens.error }, { status: 500 });
  }
  if (itens.tendencias.length + itens.memes.length === 0) {
    return NextResponse.json(
      { error: "Nenhum dos itens escolhidos foi encontrado no acervo desta marca." },
      { status: 400 }
    );
  }

  const briefing: BriefingMontado = {
    modo: "montado",
    cliente: marca.nome,
    produto: texto(body.produto, 120) || undefined,
    edicao: texto(body.edicao, 60) || undefined,
    titulo_social: texto(body.tituloSocial, 200) || undefined,
    orientacao: texto(body.orientacao, 600) || undefined,
    tendencias: tendenciasRef,
    memes: memesRef,
  };

  const { data: saved, error: saveError } = await supabase
    .from("reports")
    .insert({
      user_id: user.id,
      cliente: marca.nome,
      // JSON não guarda undefined: os campos vazios simplesmente somem.
      briefing: JSON.parse(JSON.stringify(briefing)),
      marca_id: marca.id,
      report: null,
      status: "pending",
      progress: { phase: "briefing", sources_done: [], montado: true },
    })
    .select("slug")
    .single();

  if (saveError || !saved) {
    console.error("Erro ao criar report montado:", saveError);
    return NextResponse.json(
      { error: "Falha ao criar o report.", detail: saveError?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ slug: saved.slug });
}

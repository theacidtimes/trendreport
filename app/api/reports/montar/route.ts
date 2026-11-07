import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  COLUNAS_COLETA,
  COLUNAS_RADAR,
  linhaColetaParaItem,
  linhaRadarParaItem,
  type LinhaRadar,
} from "@/lib/acervo";
import { montarReport } from "@/lib/montarReport";
import type { ColetaItem } from "@/lib/types";

// Cria um report montado a partir de itens do acervo (fase 3 do report
// customizado). Não coleta nem chama modelo, por isso não consome crédito:
// o report nasce em "ready" e vai direto pro editor.
//
// O cliente manda só ids. Imagem, link, autor e texto são relidos do banco
// (com a RLS do tenant), pra que nenhum card carregue dado que não veio da
// coleta.

type Ref = { id: string; origem: "report" | "radar" };
type Body = {
  marcaId?: string;
  produto?: string;
  edicao?: string;
  tituloSocial?: string;
  tendencias?: Ref[];
  memes?: Ref[];
};

const MAX_POR_BLOCO = 12;

function refsValidas(refs: unknown): Ref[] {
  if (!Array.isArray(refs)) return [];
  return refs
    .filter(
      (r): r is Ref =>
        !!r &&
        typeof (r as Ref).id === "string" &&
        ((r as Ref).origem === "report" || (r as Ref).origem === "radar")
    )
    .slice(0, MAX_POR_BLOCO);
}

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

  // Mesmo pré-voo do /api/generate, menos crédito (montar não gasta nada).
  const [{ data: status }, { data: modulos, error: modErr }, { data: marca }] = await Promise.all([
    supabase.rpc("meu_tenant_status"),
    supabase.rpc("meus_modulos"),
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
  if (!marca) {
    return NextResponse.json({ error: "Marca não encontrada." }, { status: 404 });
  }

  const todos = [...tendenciasRef, ...memesRef];
  const idsColeta = todos.filter((r) => r.origem === "report").map((r) => r.id);
  const idsRadar = todos.filter((r) => r.origem === "radar").map((r) => r.id);

  const [resColeta, resRadar] = await Promise.all([
    idsColeta.length
      ? supabase.from("coleta_item").select(COLUNAS_COLETA).eq("marca_id", marcaId).in("id", idsColeta)
      : Promise.resolve({ data: [], error: null }),
    idsRadar.length
      ? supabase.from("radar_raw_data").select(COLUNAS_RADAR).eq("marca_id", marcaId).in("id", idsRadar)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (resColeta.error || resRadar.error) {
    return NextResponse.json(
      { error: "Falha ao ler o acervo.", detail: (resColeta.error ?? resRadar.error)?.message },
      { status: 500 }
    );
  }

  const porChave = new Map<string, ColetaItem>();
  for (const r of resColeta.data ?? []) {
    porChave.set(`report:${(r as { id: string }).id}`, linhaColetaParaItem(r as Omit<ColetaItem, "origem">));
  }
  for (const r of (resRadar.data ?? []) as LinhaRadar[]) {
    const item = linhaRadarParaItem(r);
    if (item) porChave.set(`radar:${item.id}`, item);
  }

  // Mantém a ordem que a pessoa montou; item que sumiu (ou de outra marca)
  // simplesmente não entra.
  const resolver = (refs: Ref[]) =>
    refs
      .map((r) => porChave.get(`${r.origem}:${r.id}`))
      .filter((i): i is ColetaItem => !!i);
  const tendencias = resolver(tendenciasRef);
  const memes = resolver(memesRef);
  if (tendencias.length + memes.length === 0) {
    return NextResponse.json(
      { error: "Nenhum dos itens escolhidos foi encontrado no acervo desta marca." },
      { status: 400 }
    );
  }

  const report = montarReport({
    cliente: marca.nome,
    produto: texto(body.produto, 120) || marca.nome,
    edicao: texto(body.edicao, 60),
    tituloSocial: texto(body.tituloSocial, 200),
    tendencias,
    memes,
  });

  const { data: saved, error: saveError } = await supabase
    .from("reports")
    .insert({
      user_id: user.id,
      cliente: marca.nome,
      briefing: null,
      marca_id: marca.id,
      report,
      status: "ready",
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

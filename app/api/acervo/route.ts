import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { palavrao } from "@/lib/brandSafety";
import type { ColetaItem } from "@/lib/types";

// Busca no acervo da marca do report (coleta_item + memória do radar), pro
// "Trocar pela coleta" do editor. A RLS de tenant vale nas duas tabelas: quem
// não é do tenant recebe lista vazia, não erro.
//
// GET /api/acervo?slug=<report>&q=&plataforma=&dias=&ordem=engajamento|recentes

const PLATAFORMAS = ["instagram", "tiktok", "twitter", "news", "reddit"] as const;
type Plataforma = (typeof PLATAFORMAS)[number];
const LIMITE = 60;

type LinhaRadar = {
  id: string;
  fonte: string;
  conteudo: string;
  url: string | null;
  metadata: { upvotes?: number | null; comentarios?: number | null } | null;
  created_at: string;
};

// Busca vira padrão de ilike. Curingas e a pontuação que a sintaxe de filtro
// do PostgREST usa (vírgula, parênteses, aspas) saem: buscar "truco, zap"
// quebraria o .or() em vez de achar algo.
function padrao(q: string): string {
  return `%${q.replace(/[\\%_,()"*]/g, " ").trim()}%`;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const slug = params.get("slug");
  if (!slug) {
    return NextResponse.json({ error: "Informe o report (slug)." }, { status: 400 });
  }
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const plataformaParam = params.get("plataforma");
  const plataforma = PLATAFORMAS.includes(plataformaParam as Plataforma)
    ? (plataformaParam as Plataforma)
    : null;
  const dias = Number(params.get("dias")) || 0;
  const ordem = params.get("ordem") === "recentes" ? "recentes" : "engajamento";
  const desde = dias > 0 ? new Date(Date.now() - dias * 86_400_000).toISOString() : null;

  const { data: report } = await supabase
    .from("reports")
    .select("id, marca_id")
    .eq("slug", slug)
    .maybeSingle();
  if (!report) {
    return NextResponse.json({ error: "Report não encontrado." }, { status: 404 });
  }

  // Report com marca: acervo da marca inteira. Avulso: só o que ele coletou.
  let coleta = supabase
    .from("coleta_item")
    .select(
      "id, plataforma, url, autor, texto, imagem_url, imagem_estavel, linguagem_explicita, metricas, engajamento, publicado_em, coletado_em"
    )
    .limit(LIMITE);
  coleta = report.marca_id
    ? coleta.eq("marca_id", report.marca_id)
    : coleta.eq("report_id", report.id);
  if (plataforma) coleta = coleta.eq("plataforma", plataforma);
  if (desde) coleta = coleta.gte("coletado_em", desde);
  if (q) coleta = coleta.or(`texto.ilike.${padrao(q)},autor.ilike.${padrao(q)}`);
  coleta =
    ordem === "recentes"
      ? coleta.order("coletado_em", { ascending: false })
      : coleta.order("engajamento", { ascending: false });

  // O radar só guarda Reddit, notícias e X, sem imagem nem autor: entra como
  // complemento, nunca quando o filtro pede outra rede.
  const radarCabe =
    !!report.marca_id && (!plataforma || ["reddit", "news", "twitter"].includes(plataforma));
  async function buscarRadar(): Promise<LinhaRadar[]> {
    if (!radarCabe) return [];
    let radar = supabase
      .from("radar_raw_data")
      .select("id, fonte, conteudo, url, metadata, created_at")
      .eq("marca_id", report!.marca_id)
      .not("url", "is", null);
    if (plataforma) radar = radar.eq("fonte", plataforma);
    if (desde) radar = radar.gte("created_at", desde);
    if (q) radar = radar.ilike("conteudo", padrao(q));
    const { data, error } = await radar.order("created_at", { ascending: false }).limit(LIMITE);
    // Radar é complemento: se falhar, o acervo do report ainda aparece.
    if (error) console.error("[ACERVO] falha ao ler o radar:", error.message);
    return (data ?? []) as LinhaRadar[];
  }

  const [resColeta, linhasRadar] = await Promise.all([coleta, buscarRadar()]);
  if (resColeta.error) {
    return NextResponse.json({ error: resColeta.error.message }, { status: 500 });
  }

  const itens: ColetaItem[] = (resColeta.data ?? []).map((r) => ({
    ...(r as Omit<ColetaItem, "origem">),
    origem: "report",
  }));

  const vistos = new Set(itens.map((i) => i.url));
  for (const r of linhasRadar) {
    if (!r.url || vistos.has(r.url) || !PLATAFORMAS.includes(r.fonte as Plataforma)) continue;
    vistos.add(r.url);
    const meta = (r.metadata ?? {}) as { upvotes?: number | null; comentarios?: number | null };
    itens.push({
      id: r.id,
      origem: "radar",
      plataforma: r.fonte as Plataforma,
      url: r.url,
      autor: null,
      texto: r.conteudo,
      imagem_url: null,
      imagem_estavel: true,
      linguagem_explicita: palavrao(r.conteudo),
      metricas: { upvotes: meta.upvotes ?? null, comentarios: meta.comentarios ?? null },
      engajamento: (meta.upvotes ?? 0) + (meta.comentarios ?? 0),
      publicado_em: null,
      coletado_em: r.created_at,
    });
  }

  itens.sort((a, b) =>
    ordem === "recentes"
      ? b.coletado_em.localeCompare(a.coletado_em)
      : b.engajamento - a.engajamento
  );

  return NextResponse.json({ itens: itens.slice(0, LIMITE) });
}

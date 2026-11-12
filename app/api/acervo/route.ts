import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  COLUNAS_COLETA,
  COLUNAS_RADAR,
  PLATAFORMAS,
  linhaColetaParaItem,
  linhaRadarParaItem,
  type LinhaRadar,
  type Plataforma,
} from "@/lib/acervo";
import type { ColetaItem } from "@/lib/types";

// Busca no acervo (coleta_item + memória do radar). Serve o "Trocar pela
// coleta" do editor (escopo = report) e o "Montar do acervo" (escopo = marca).
// A RLS de tenant vale nas duas tabelas: quem não é do tenant recebe lista
// vazia, não erro.
//
// GET /api/acervo?slug=<report> | marca=<id>  &q=&plataforma=&dias=&ordem=engajamento|recentes&ruido=0
//
// ruido=0 tira o que o classificador marcou como não sendo da marca
// (coleta_item.relevante = false): o meme de casal que a busca solta trouxe
// pro acervo de marca de sementes. Item ainda não classificado aparece. O
// radar não tem essa marcação e entra como sempre. Ver lib/relevancia.ts.

const LIMITE = 60;

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
  const marcaParam = params.get("marca");
  if (!slug && !marcaParam) {
    return NextResponse.json({ error: "Informe o report (slug) ou a marca." }, { status: 400 });
  }
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const plataformaParam = params.get("plataforma");
  const plataforma = PLATAFORMAS.includes(plataformaParam as Plataforma)
    ? (plataformaParam as Plataforma)
    : null;
  const dias = Number(params.get("dias")) || 0;
  const ordem = params.get("ordem") === "recentes" ? "recentes" : "engajamento";
  const semRuido = params.get("ruido") === "0";
  const desde = dias > 0 ? new Date(Date.now() - dias * 86_400_000).toISOString() : null;

  // Escopo: report com marca → acervo da marca inteira; report avulso → só o
  // que ele coletou; marca direta → acervo da marca.
  let marcaId: string | null = marcaParam;
  let reportId: string | null = null;
  if (slug) {
    const { data: report } = await supabase
      .from("reports")
      .select("id, marca_id")
      .eq("slug", slug)
      .maybeSingle();
    if (!report) {
      return NextResponse.json({ error: "Report não encontrado." }, { status: 404 });
    }
    marcaId = report.marca_id;
    reportId = report.marca_id ? null : report.id;
  }

  let coleta = supabase.from("coleta_item").select(COLUNAS_COLETA).limit(LIMITE);
  coleta = marcaId ? coleta.eq("marca_id", marcaId) : coleta.eq("report_id", reportId);
  if (plataforma) coleta = coleta.eq("plataforma", plataforma);
  if (desde) coleta = coleta.gte("coletado_em", desde);
  if (semRuido) coleta = coleta.not("relevante", "is", false);
  if (q) coleta = coleta.or(`texto.ilike.${padrao(q)},autor.ilike.${padrao(q)}`);
  coleta =
    ordem === "recentes"
      ? coleta.order("coletado_em", { ascending: false })
      : coleta.order("engajamento", { ascending: false });

  // O radar guarda Reddit, notícias, X e TikTok: entra como complemento,
  // nunca quando o filtro pede Instagram.
  const radarCabe =
    !!marcaId && (!plataforma || ["reddit", "news", "twitter", "tiktok"].includes(plataforma));
  async function buscarRadar(): Promise<LinhaRadar[]> {
    if (!radarCabe || !marcaId) return [];
    let radar = supabase
      .from("radar_raw_data")
      .select(COLUNAS_RADAR)
      .eq("marca_id", marcaId)
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

  const itens: ColetaItem[] = (resColeta.data ?? []).map((r) =>
    linhaColetaParaItem(r as Omit<ColetaItem, "origem">)
  );

  const vistos = new Set(itens.map((i) => i.url));
  for (const r of linhasRadar) {
    const item = linhaRadarParaItem(r);
    if (!item || vistos.has(item.url)) continue;
    vistos.add(item.url);
    itens.push(item);
  }

  itens.sort((a, b) =>
    ordem === "recentes"
      ? b.coletado_em.localeCompare(a.coletado_em)
      : b.engajamento - a.engajamento
  );

  return NextResponse.json({ itens: itens.slice(0, LIMITE) });
}

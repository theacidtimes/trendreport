import { ArrowUpRight, CalendarClock, Flame, TrendingUp } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import NewReportDialog from "./NewReportDialog";
import { type ReportCardData } from "./ReportsBrowser";
import HomeFeed, { type DropCardData } from "./HomeFeed";
import { PLATFORM_ICON, PLATFORM_LABEL, type Plataforma } from "@/lib/platforms";
import { checkIsAdmin } from "@/lib/admin";
import type { ReportRow } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = await checkIsAdmin(supabase);

  const { data: reports } = await supabase
    .from("reports")
    .select("id, slug, cliente, report, created_at, status")
    .order("created_at", { ascending: false });

  const { data: radarDrops } = await supabase
    .from("trends_radar")
    .select(
      "id, insight_titulo, descricao_fato, gancho_produto, status_hype, categoria_funil, indice_hype, created_at, marca:marcas(nome)"
    )
    .order("created_at", { ascending: false })
    .limit(12);

  const rows = (reports ?? []) as (Pick<
    ReportRow,
    "id" | "slug" | "cliente" | "report" | "created_at"
  > & { status: string })[];

  const thumbOf = (row: (typeof rows)[number]) =>
    row.report?.tendencias?.find((t) => t.imagem_url)?.imagem_url ?? null;

  const hypeValues = rows
    .map((r) => r.report?.meta?.indice_hype)
    .filter((v): v is number => typeof v === "number");
  const avgHype = hypeValues.length
    ? Math.round(hypeValues.reduce((a, b) => a + b, 0) / hypeValues.length)
    : null;

  // Insights derivados APENAS de dados reais já armazenados nos reports —
  // nenhum número aqui é inventado; tudo vem de report.fontes / tendencias / meta.
  const platformTotals: Record<Plataforma, number> = {
    instagram: 0,
    twitter: 0,
    tiktok: 0,
    reddit: 0,
    news: 0,
  };
  for (const r of rows) {
    const f = r.report?.fontes;
    if (!f) continue;
    platformTotals.instagram += f.instagram ?? 0;
    platformTotals.twitter += f.twitter ?? 0;
    platformTotals.tiktok += f.tiktok ?? 0;
    platformTotals.reddit += f.reddit ?? 0;
    platformTotals.news += f.news ?? 0;
  }
  const totalSignals = Object.values(platformTotals).reduce((a, b) => a + b, 0);
  const topPlatformEntry = (
    Object.entries(platformTotals) as [Plataforma, number][]
  ).sort((a, b) => b[1] - a[1])[0];
  const topPlatform =
    topPlatformEntry && topPlatformEntry[1] > 0 ? topPlatformEntry[0] : null;

  const hotTrends = rows
    .flatMap((r) =>
      (r.report?.tendencias ?? [])
        .filter((t) => t.status === "em_alta" || t.status === "subindo")
        .map((t) => ({
          titulo: t.titulo,
          status: t.status,
          slug: r.slug,
          cliente: r.cliente,
        }))
    )
    .slice(0, 4);

  const proximoGatilho = rows[0]?.report?.meta?.proximo_gatilho ?? null;
  const TopPlatformIcon = topPlatform ? PLATFORM_ICON[topPlatform] : null;

  // Dados serializáveis dos cards — a filtragem/ordenação por cliente e data
  // acontece client-side no ReportsBrowser (sem recarregar a página).
  const cards: ReportCardData[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    cliente: r.cliente,
    createdAt: r.created_at,
    status: r.status,
    indiceHype: r.report?.meta?.indice_hype ?? 0,
    hypeMotivo: r.report?.meta?.hype_motivo ?? "",
    imagemUrl: thumbOf(r),
    corMarca: r.report?.meta?.cor_marca ?? null,
  }));

  // Drops preditivos (trends_radar) para os 2 bentos do topo. O join marca:marcas
  // pode vir como objeto ou array conforme a inferência do Supabase — normalizamos.
  type RadarRow = {
    id: string;
    insight_titulo: string;
    descricao_fato: string;
    gancho_produto: string;
    status_hype: DropCardData["statusHype"];
    categoria_funil: DropCardData["categoriaFunil"];
    indice_hype: number;
    created_at: string;
    marca: { nome: string } | { nome: string }[] | null;
  };
  const drops: DropCardData[] = ((radarDrops ?? []) as RadarRow[]).map((d) => ({
    id: d.id,
    marcaNome: (Array.isArray(d.marca) ? d.marca[0]?.nome : d.marca?.nome) ?? null,
    insightTitulo: d.insight_titulo,
    descricaoFato: d.descricao_fato,
    ganchoProduto: d.gancho_produto,
    statusHype: d.status_hype,
    categoriaFunil: d.categoria_funil,
    indiceHype: d.indice_hype ?? 0,
    createdAt: d.created_at,
  }));

  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const activePlatforms = Object.values(platformTotals).filter(
    (v) => v > 0
  ).length;

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user?.email} isAdmin={isAdmin} />

      <main className="md:pl-20">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-12 md:py-16 flex flex-col gap-12 md:gap-16">
          {/* MASTHEAD */}
          <header className="animate-fade-up flex flex-col gap-6 border-b border-hairline pb-10">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="kicker">cccaramelo · Intelligence Desk</span>
              <span className="h-px w-8 bg-hairline" />
              <span className="kicker text-muted-2">{hoje}</span>
            </div>
            <h1 className="headline max-w-3xl text-balance">
              O que o mundo está sinalizando agora.
            </h1>
            <p className="standfirst max-w-prose text-pretty">
              {rows.length > 0
                ? `${rows.length} ${
                    rows.length === 1 ? "report ativo" : "reports ativos"
                  }, ${totalSignals} sinais monitorados${
                    activePlatforms > 0
                      ? ` em ${activePlatforms} ${
                          activePlatforms === 1 ? "plataforma" : "plataformas"
                        }`
                      : ""
                  }.`
                : "Seu primeiro report abre a leitura do momento cultural. Comece pelo briefing."}
            </p>

            {/* Index strip — figuras editoriais, sem KPI boxes */}
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-hairline">
              <div className="bg-surface px-5 py-6 flex flex-col gap-2">
                <span className="kicker text-muted-2">Reports</span>
                <span className="font-sans text-white font-medium text-4xl md:text-5xl tabular-nums leading-none">
                  {String(rows.length).padStart(2, "0")}
                </span>
              </div>
              <div className="bg-surface px-5 py-6 flex flex-col gap-2">
                <span className="kicker text-muted-2">Sinais monitorados</span>
                <span className="font-sans text-white font-medium text-4xl md:text-5xl tabular-nums leading-none">
                  {totalSignals}
                </span>
              </div>
              <div className="bg-surface px-5 py-6 flex flex-col gap-3 col-span-2 sm:col-span-1">
                <span className="kicker text-muted-2">Hype médio</span>
                {avgHype !== null ? (
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-baseline gap-1">
                      <span className="font-sans text-white font-medium text-4xl md:text-5xl tabular-nums leading-none">
                        {avgHype}
                      </span>
                      <span className="text-muted-2 text-sm">/100</span>
                    </div>
                    <div className="signal-track">
                      <div
                        className="signal-fill"
                        style={{ width: `${avgHype}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="font-sans text-muted-2 font-medium text-4xl leading-none">
                    —
                  </span>
                )}
              </div>
            </div>
          </header>

          {/* BENTO — módulos editoriais assimétricos */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* CTA — abre o briefing num modal na própria página */}
            <NewReportDialog />

            {/* Plataforma em destaque — maior volume real coletado */}
            <div className="rounded-2xl bg-surface border border-border p-6 flex flex-col justify-between gap-6 min-h-[11rem] shadow-card">
              <div className="flex items-center gap-2 text-muted-2">
                <TrendingUp className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                <span className="kicker">Plataforma em destaque</span>
              </div>
              {topPlatform && TopPlatformIcon ? (
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full border border-border bg-surface-2 grid place-items-center shrink-0">
                    <TopPlatformIcon
                      className="w-5 h-5 text-white"
                      strokeWidth={2}
                    />
                  </span>
                  <div className="flex flex-col">
                    <span className="font-sans text-white font-semibold text-lg leading-tight">
                      {PLATFORM_LABEL[topPlatform]}
                    </span>
                    <span className="text-muted text-xs tabular-nums">
                      {platformTotals[topPlatform]} sinais coletados
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-muted text-sm">
                  Ainda sem dados coletados.
                </span>
              )}
            </div>

            {/* Em alta agora — tendências reais com status em_alta/subindo */}
            <div className="lg:col-span-3 rounded-2xl bg-surface border border-border p-6 md:p-8 flex flex-col gap-6 shadow-card">
              <div className="flex items-center gap-2 text-muted-2">
                <Flame className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                <span className="kicker">Em alta agora</span>
              </div>
              {hotTrends.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10">
                  {hotTrends.map((t, i) => (
                    <Link
                      key={`${t.slug}-${i}`}
                      href={`/dashboard/${t.slug}`}
                      className="group flex items-center gap-3 py-3.5 border-b border-hairline hover:border-border transition-colors"
                    >
                      <span
                        className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                          t.status === "em_alta" ? "bg-lime" : "bg-purple"
                        }`}
                      />
                      <span className="flex-1 min-w-0 truncate text-white text-[15px]">
                        {t.titulo}
                      </span>
                      <span className="shrink-0 text-muted-2 text-[11px] truncate max-w-[6rem]">
                        {t.cliente}
                      </span>
                      <ArrowUpRight
                        className="w-3.5 h-3.5 text-muted-2 shrink-0 group-hover:text-white transition-colors"
                        strokeWidth={2}
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <span className="text-muted text-sm">
                  Nenhuma tendência em alta nos reports atuais.
                </span>
              )}
            </div>

            {/* Próximo gatilho — do report mais recente */}
            {proximoGatilho?.evento && (
              <div className="lg:col-span-3 rounded-2xl bg-surface border border-border p-6 md:p-8 flex items-start gap-4 shadow-card">
                <span className="w-10 h-10 rounded-full border border-border bg-surface-2 grid place-items-center shrink-0">
                  <CalendarClock className="w-4 h-4 text-white" strokeWidth={2} />
                </span>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <span className="kicker text-muted-2">
                    Próximo gatilho{" "}
                    {proximoGatilho.data ? `· ${proximoGatilho.data}` : ""}
                  </span>
                  <span className="font-serif text-white text-xl md:text-2xl leading-snug">
                    {proximoGatilho.evento}
                  </span>
                  {proximoGatilho.destaque && (
                    <span className="text-muted text-sm leading-relaxed">
                      {proximoGatilho.destaque}
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>

          <HomeFeed cards={cards} drops={drops} />
        </div>
      </main>
    </div>
  );
}

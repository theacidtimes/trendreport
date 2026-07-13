import { ArrowUpRight, Flame, Radio, TrendingUp } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import NewReportDialog from "./NewReportDialog";
import { type ReportCardData } from "./ReportsBrowser";
import HomeFeed, { type DropCardData } from "./HomeFeed";
import { PLATFORM_ICON, PLATFORM_LABEL, type Plataforma } from "@/lib/platforms";
import { checkIsAdmin } from "@/lib/admin";
import type { ReportRow } from "@/lib/types";

function HypeGauge({ value }: { value: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative w-48 h-48 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="hypeGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4a2e63" />
            <stop offset="100%" stopColor="#a063e8" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(245,243,239,0.08)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#hypeGradient)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-white font-medium text-5xl tabular-nums leading-none">
          {value}
        </span>
        <span className="text-muted-2 text-xs font-medium mt-1">/100</span>
      </div>
    </div>
  );
}

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

  // Métricas do RADAR — motor always-on, populado por cron independente de report.
  // O topo da home reflete o que o radar está captando agora, não agregados de report,
  // então nunca fica vazio esperando o primeiro relatório. Tudo é count real; nada inventado.
  const seteDiasAtras = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const [signalsTotalRes, redditRes, newsRes, twitterRes, dropsWeekRes] =
    await Promise.all([
      supabase.from("radar_raw_data").select("*", { count: "exact", head: true }),
      supabase
        .from("radar_raw_data")
        .select("*", { count: "exact", head: true })
        .eq("fonte", "reddit"),
      supabase
        .from("radar_raw_data")
        .select("*", { count: "exact", head: true })
        .eq("fonte", "news"),
      supabase
        .from("radar_raw_data")
        .select("*", { count: "exact", head: true })
        .eq("fonte", "twitter"),
      supabase
        .from("trends_radar")
        .select("*", { count: "exact", head: true })
        .gte("created_at", seteDiasAtras),
    ]);

  const radarSignalsTotal = signalsTotalRes.count ?? 0;
  const radarDropsWeek = dropsWeekRes.count ?? 0;

  const radarPlatforms = (
    [
      ["reddit", redditRes.count ?? 0],
      ["news", newsRes.count ?? 0],
      ["twitter", twitterRes.count ?? 0],
    ] as [Plataforma, number][]
  ).sort((a, b) => b[1] - a[1]);
  const topRadarPlatform = radarPlatforms[0][1] > 0 ? radarPlatforms[0] : null;
  const TopPlatformIcon = topRadarPlatform
    ? PLATFORM_ICON[topRadarPlatform[0]]
    : null;

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

  // Pulso do radar = hype médio dos drops ativos (em alta / subindo); cai pra
  // média geral dos drops recentes se nenhum estiver ativo.
  const activeDrops = drops.filter(
    (d) => d.statusHype === "em_alta" || d.statusHype === "subindo"
  );
  const pulseBase = activeDrops.length ? activeDrops : drops;
  const radarPulse = pulseBase.length
    ? Math.round(
        pulseBase.reduce((a, d) => a + d.indiceHype, 0) / pulseBase.length
      )
    : null;
  const liveDrops = drops.slice(0, 4);

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user?.email} isAdmin={isAdmin} />

      <main className="md:pl-20">
        <div className="max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-14 flex flex-col gap-4">
          {/* PULSO AO VIVO — área nobre alimentada pelo RADAR (sempre populada) */}
          <div className="animate-fade-up flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="kicker text-muted-2">O que o radar está vendo agora</span>
              <h2 className="font-serif text-white font-medium text-2xl md:text-3xl leading-tight">
                Pulso ao vivo
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* CTA — abre o briefing num modal na própria página (sem trocar de rota) */}
                <NewReportDialog />

                {/* Sinais monitorados — count real de radar_raw_data */}
                <div className="rounded-3xl bg-surface border border-border p-6 flex flex-col justify-between gap-4 min-h-[9rem] shadow-card">
                  <div className="flex items-center gap-2 text-muted-2">
                    <Radio className="w-4 h-4 text-lime shrink-0" strokeWidth={2.2} />
                    <span className="kicker">Sinais monitorados</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-serif text-white font-medium text-4xl tabular-nums leading-none">
                      {radarSignalsTotal.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-muted text-xs mt-1.5">
                      posts, threads e notícias captados pelo radar
                    </span>
                  </div>
                </div>

                {/* Plataforma em destaque — top fonte do radar */}
                <div className="rounded-3xl bg-surface border border-border p-6 flex flex-col justify-between gap-4 min-h-[9rem] shadow-card">
                  <div className="flex items-center gap-2 text-muted-2">
                    <TrendingUp className="w-4 h-4 text-lime shrink-0" strokeWidth={2.2} />
                    <span className="kicker">Plataforma em destaque</span>
                  </div>
                  {topRadarPlatform && TopPlatformIcon ? (
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-full border border-border bg-surface-2 grid place-items-center shrink-0">
                        <TopPlatformIcon className="w-5 h-5 text-white" strokeWidth={2} />
                      </span>
                      <div className="flex flex-col">
                        <span className="font-serif text-white font-medium text-xl leading-tight">
                          {PLATFORM_LABEL[topRadarPlatform[0]]}
                        </span>
                        <span className="text-muted text-xs tabular-nums">
                          {topRadarPlatform[1].toLocaleString("pt-BR")} sinais
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted text-sm">Radar ainda sem sinais captados</span>
                  )}
                </div>

                {/* Radar ao vivo — drops recentes do radar */}
                <div className="sm:col-span-2 rounded-3xl bg-surface border border-border p-6 flex flex-col gap-4 shadow-card">
                  <div className="flex items-center gap-2 text-muted-2">
                    <Flame className="w-4 h-4 text-lime shrink-0" strokeWidth={2.2} />
                    <span className="kicker">Radar ao vivo</span>
                  </div>
                  {liveDrops.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {liveDrops.map((d) => (
                        <Link
                          key={d.id}
                          href="/dashboard/radar"
                          className="group flex items-center gap-2 rounded-xl bg-surface-2 border border-border px-3 py-2.5 hover:border-white/20 transition-colors"
                        >
                          <span
                            className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                              d.statusHype === "em_alta"
                                ? "bg-lime"
                                : d.statusHype === "subindo"
                                ? "bg-purple"
                                : "bg-muted"
                            }`}
                          />
                          <span className="flex-1 min-w-0 truncate text-white text-sm">
                            {d.insightTitulo}
                          </span>
                          {d.marcaNome && (
                            <span className="shrink-0 text-muted-2 text-[11px] truncate max-w-[6rem]">
                              {d.marcaNome}
                            </span>
                          )}
                          <span className="shrink-0 text-muted text-[11px] tabular-nums">
                            {d.indiceHype}
                          </span>
                          <ArrowUpRight
                            className="w-3.5 h-3.5 text-muted-2 shrink-0 group-hover:text-white transition-colors"
                            strokeWidth={2.5}
                          />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted text-sm">
                      Nenhum drop capturado ainda. O radar preenche esta seção conforme raspa sinais.
                    </span>
                  )}
                </div>
              </div>

              {/* RIGHT: stats do radar */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                <div className="flex-1 rounded-3xl bg-black border border-border p-6 flex flex-col gap-2 min-h-[16rem] shadow-card">
                  <span className="kicker text-muted-2">Drops esta semana</span>
                  <div className="flex-1 flex items-center justify-center">
                    <span
                      className="font-serif font-medium tabular-nums text-transparent bg-clip-text text-[6.5rem] md:text-[8rem] leading-none"
                      style={{
                        backgroundImage:
                          "linear-gradient(160deg, #a063e8 0%, #4a2e63 60%, #181818 100%)",
                      }}
                    >
                      {radarDropsWeek}
                    </span>
                  </div>
                  <span className="text-muted text-xs">sinais que viraram oportunidade</span>
                </div>
                <div className="flex-1 rounded-3xl bg-surface border border-border p-6 flex flex-col gap-2 min-h-[16rem] shadow-card">
                  <span className="kicker text-muted-2">Pulso do radar</span>
                  <div className="flex-1 flex items-center justify-center">
                    {radarPulse !== null ? (
                      <HypeGauge value={radarPulse} />
                    ) : (
                      <span className="font-serif text-muted-2 font-medium text-4xl tabular-nums">
                        —
                      </span>
                    )}
                  </div>
                  <span className="text-muted text-xs text-center">
                    hype médio dos drops ativos
                  </span>
                </div>
              </div>
            </div>
          </div>

          <HomeFeed
            cards={cards}
            drops={drops}
            reportsTotal={rows.length}
            reportsAvgHype={avgHype}
          />
        </div>
      </main>
    </div>
  );
}

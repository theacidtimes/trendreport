import { ArrowUpRight, CalendarClock, Flame, Radio, TrendingUp } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import NewReportDialog from "./NewReportDialog";
import ReportsBrowser, { type ReportCardData } from "./ReportsBrowser";
import { PLATFORM_ICON, PLATFORM_LABEL, type Plataforma } from "@/lib/platforms";
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
            <stop offset="0%" stopColor="#660099" />
            <stop offset="100%" stopColor="#81d300" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="9" />
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
        <span className="font-sans text-black font-bold text-5xl tabular-nums leading-none">
          {value}
        </span>
        <span className="text-black/40 text-xs font-medium mt-1">/100</span>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reports } = await supabase
    .from("reports")
    .select("id, slug, cliente, report, created_at, status")
    .order("created_at", { ascending: false });

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

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user?.email} />

      <main className="md:pl-64">
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-4">
          {/* HERO CLUSTER: insight bentos + stats */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* LEFT: bento de insights derivados dos reports */}
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* CTA — abre o briefing num modal na própria página (sem trocar de rota) */}
              <NewReportDialog />

              {/* Sinais monitorados — soma real de report.fontes */}
              <div className="rounded-3xl bg-surface border border-border p-6 flex flex-col justify-between gap-4 min-h-[9rem]">
                <div className="flex items-center gap-2 text-muted">
                  <Radio className="w-4 h-4 text-lime shrink-0" strokeWidth={2.2} />
                  <span className="text-xs uppercase tracking-[0.14em] font-medium">
                    Sinais monitorados
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="font-sans text-white font-bold text-4xl tabular-nums leading-none">
                    {totalSignals}
                  </span>
                  <span className="text-muted text-xs mt-1">posts, tweets e threads coletados</span>
                </div>
              </div>

              {/* Plataforma em destaque — maior volume real coletado */}
              <div className="rounded-3xl bg-surface border border-border p-6 flex flex-col justify-between gap-4 min-h-[9rem]">
                <div className="flex items-center gap-2 text-muted">
                  <TrendingUp className="w-4 h-4 text-lime shrink-0" strokeWidth={2.2} />
                  <span className="text-xs uppercase tracking-[0.14em] font-medium">
                    Plataforma em destaque
                  </span>
                </div>
                {topPlatform && TopPlatformIcon ? (
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-purple-mid flex items-center justify-center shrink-0">
                      <TopPlatformIcon className="w-5 h-5 text-white" strokeWidth={2} />
                    </span>
                    <div className="flex flex-col">
                      <span className="font-sans text-white font-bold text-xl leading-tight">
                        {PLATFORM_LABEL[topPlatform]}
                      </span>
                      <span className="text-muted text-xs tabular-nums">
                        {platformTotals[topPlatform]} sinais
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-muted text-sm">Ainda sem dados coletados</span>
                )}
              </div>

              {/* Em alta agora — tendências reais com status em_alta/subindo */}
              <div className="sm:col-span-2 rounded-3xl bg-surface border border-border p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-muted">
                  <Flame className="w-4 h-4 text-lime shrink-0" strokeWidth={2.2} />
                  <span className="text-xs uppercase tracking-[0.14em] font-medium">
                    Em alta agora
                  </span>
                </div>
                {hotTrends.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {hotTrends.map((t, i) => (
                      <Link
                        key={`${t.slug}-${i}`}
                        href={`/dashboard/${t.slug}`}
                        className="group flex items-center gap-2 rounded-xl bg-black/30 border border-border px-3 py-2.5 hover:border-lime/40 transition-colors"
                      >
                        <span
                          className={`shrink-0 w-1.5 h-1.5 rounded-full ${
                            t.status === "em_alta" ? "bg-lime" : "bg-purple"
                          }`}
                        />
                        <span className="flex-1 min-w-0 truncate text-white text-sm">
                          {t.titulo}
                        </span>
                        <span className="shrink-0 text-muted text-[11px] truncate max-w-[6rem]">
                          {t.cliente}
                        </span>
                        <ArrowUpRight
                          className="w-3.5 h-3.5 text-muted shrink-0 group-hover:text-lime transition-colors"
                          strokeWidth={2.5}
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
                <div className="sm:col-span-2 rounded-3xl bg-surface border border-border p-6 flex items-start gap-3">
                  <span className="w-9 h-9 rounded-full bg-purple-mid flex items-center justify-center shrink-0">
                    <CalendarClock className="w-4 h-4 text-lime" strokeWidth={2.2} />
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-muted text-xs uppercase tracking-[0.14em] font-medium">
                      Próximo gatilho {proximoGatilho.data ? `· ${proximoGatilho.data}` : ""}
                    </span>
                    <span className="text-white font-medium">{proximoGatilho.evento}</span>
                    {proximoGatilho.destaque && (
                      <span className="text-muted text-sm">{proximoGatilho.destaque}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: stats */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="flex-1 rounded-3xl bg-black border border-border p-6 flex flex-col gap-4 min-h-[16rem]">
                <span className="text-muted text-xs uppercase tracking-[0.14em] font-medium">
                  Total de reports
                </span>
                <div className="flex-1 flex items-center justify-center">
                  <span
                    className="font-sans font-bold tabular-nums text-transparent bg-clip-text text-[9rem] md:text-[11rem] leading-none"
                    style={{
                      backgroundImage:
                        "linear-gradient(160deg, #a855f7 0%, #660099 55%, #1a0030 100%)",
                    }}
                  >
                    {rows.length}
                  </span>
                </div>
              </div>
              <div className="flex-1 rounded-3xl bg-white p-6 flex flex-col gap-4 min-h-[16rem]">
                <span className="text-black/50 text-xs uppercase tracking-[0.14em] font-medium">
                  Hype médio
                </span>
                <div className="flex-1 flex items-center justify-center">
                  {avgHype !== null ? (
                    <HypeGauge value={avgHype} />
                  ) : (
                    <span className="font-sans text-black/30 font-bold text-4xl tabular-nums">
                      —
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <ReportsBrowser cards={cards} />
        </div>
      </main>
    </div>
  );
}

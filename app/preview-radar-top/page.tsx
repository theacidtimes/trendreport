import { ArrowUpRight, Flame, MessagesSquare, Radio, TrendingUp } from "lucide-react";
import NewReportDialog from "@/app/dashboard/NewReportDialog";

// Gauge recolorido para superfície escura (sem mais o card branco gritante).
function PulseGauge({ value }: { value: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="relative w-40 h-40 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="pulseGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4a2e63" />
            <stop offset="100%" stopColor="#a063e8" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(245,243,239,0.08)" strokeWidth="9" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="url(#pulseGrad)" strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-serif text-white font-medium text-5xl tabular-nums leading-none">{value}</span>
        <span className="text-muted-2 text-xs font-medium mt-1">/100</span>
      </div>
    </div>
  );
}

const LIVE = [
  { s: "em_alta", t: "Wepinko explode no TikTok", m: "Vivo", h: 82 },
  { s: "subindo", t: "Calor recorde vira meme em Houston", m: "Vivo", h: 67 },
  { s: "subindo", t: "Vini Jr camisa 7 repercute", m: "Vivo", h: 61 },
  { s: "estabilizando", t: "Fibra em casa nas buscas", m: "Claro", h: 44 },
];

function dot(s: string) {
  if (s === "em_alta") return "bg-lime";
  if (s === "subindo") return "bg-purple";
  return "bg-muted";
}

export default function PreviewRadarTop() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-6xl mx-auto px-6 md:px-10 py-10 md:py-14 flex flex-col gap-10">

        {/* ZONA 1 — RADAR AO VIVO + CTA (área nobre) */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="kicker text-muted-2">O que o radar está vendo agora</span>
            <h2 className="font-serif text-white font-medium text-2xl md:text-3xl leading-tight">Pulso ao vivo</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NewReportDialog />

              <div className="rounded-3xl bg-surface border border-border p-6 flex flex-col justify-between gap-4 min-h-[9rem] shadow-card">
                <div className="flex items-center gap-2 text-muted-2">
                  <Radio className="w-4 h-4 text-lime shrink-0" strokeWidth={2.2} />
                  <span className="kicker">Sinais monitorados</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-serif text-white font-medium text-4xl tabular-nums leading-none">3.482</span>
                  <span className="text-muted text-xs mt-1.5">posts, threads e notícias captados pelo radar</span>
                </div>
              </div>

              <div className="rounded-3xl bg-surface border border-border p-6 flex flex-col justify-between gap-4 min-h-[9rem] shadow-card">
                <div className="flex items-center gap-2 text-muted-2">
                  <TrendingUp className="w-4 h-4 text-lime shrink-0" strokeWidth={2.2} />
                  <span className="kicker">Plataforma em destaque</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full border border-border bg-surface-2 grid place-items-center shrink-0">
                    <MessagesSquare className="w-5 h-5 text-white" strokeWidth={2} />
                  </span>
                  <div className="flex flex-col">
                    <span className="font-serif text-white font-medium text-xl leading-tight">Reddit</span>
                    <span className="text-muted text-xs tabular-nums">1.240 sinais</span>
                  </div>
                </div>
              </div>

              {/* Radar ao vivo — funde "Em alta agora" + "Últimos sinais" numa lista só */}
              <div className="sm:col-span-2 rounded-3xl bg-surface border border-border p-6 flex flex-col gap-4 shadow-card">
                <div className="flex items-center gap-2 text-muted-2">
                  <Flame className="w-4 h-4 text-lime shrink-0" strokeWidth={2.2} />
                  <span className="kicker">Radar ao vivo</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {LIVE.map((d, i) => (
                    <div key={i} className="group flex items-center gap-2 rounded-xl bg-surface-2 border border-border px-3 py-2.5">
                      <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${dot(d.s)}`} />
                      <span className="flex-1 min-w-0 truncate text-white text-sm">{d.t}</span>
                      <span className="shrink-0 text-muted-2 text-[11px]">{d.m}</span>
                      <span className="shrink-0 text-muted text-[11px] tabular-nums">{d.h}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-2 shrink-0" strokeWidth={2.5} />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT — stats do RADAR (não mais de report) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="flex-1 rounded-3xl bg-black border border-border p-6 flex flex-col gap-2 min-h-[16rem] shadow-card">
                <span className="kicker text-muted-2">Drops esta semana</span>
                <div className="flex-1 flex items-center justify-center">
                  <span
                    className="font-serif font-medium tabular-nums text-transparent bg-clip-text text-[6.5rem] md:text-[8rem] leading-none"
                    style={{ backgroundImage: "linear-gradient(160deg, #a063e8 0%, #4a2e63 60%, #181818 100%)" }}
                  >
                    18
                  </span>
                </div>
                <span className="text-muted text-xs">sinais que viraram oportunidade</span>
              </div>
              <div className="flex-1 rounded-3xl bg-surface border border-border p-6 flex flex-col gap-2 min-h-[16rem] shadow-card">
                <span className="kicker text-muted-2">Pulso do radar</span>
                <div className="flex-1 flex items-center justify-center">
                  <PulseGauge value={68} />
                </div>
                <span className="text-muted text-xs text-center">hype médio dos drops ativos</span>
              </div>
            </div>
          </div>
        </div>

        {/* ZONA 2 — SEUS REPORTS (arquivo) com stats de report rebaixados aqui */}
        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex flex-col gap-1.5">
              <span className="kicker text-muted-2">Seu arquivo de entregas</span>
              <h2 className="font-serif text-white font-medium text-2xl md:text-3xl leading-tight">Seus reports</h2>
            </div>
            {/* stats de report descem pra cá, como faixa discreta */}
            <div className="flex items-center gap-5 text-sm">
              <span className="flex flex-col">
                <span className="kicker text-muted-2 text-[10px]">Total</span>
                <span className="font-serif text-white font-medium text-2xl tabular-nums leading-none">24</span>
              </span>
              <span className="w-px h-8 bg-border" />
              <span className="flex flex-col">
                <span className="kicker text-muted-2 text-[10px]">Hype médio</span>
                <span className="font-serif text-white font-medium text-2xl tabular-nums leading-none">72</span>
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-3xl bg-surface border border-border h-56 shadow-card" />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

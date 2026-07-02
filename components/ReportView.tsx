import { CalendarClock, Sparkle } from "lucide-react";
import type { TrendReport } from "@/lib/types";
import HypeMeter from "./HypeMeter";
import TrendCard from "./TrendCard";
import OpportunityCard from "./OpportunityCard";
import CopyBlock from "./CopyBlock";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-muted text-xs uppercase tracking-[0.14em] font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
      {children}
    </span>
  );
}

export default function ReportView({
  report,
  geradoEm,
}: {
  report: TrendReport;
  geradoEm?: string;
}) {
  const { meta, tendencias, oportunidades, copy } = report;
  const [primeira, ...restantes] = tendencias ?? [];

  return (
    <div className="bg-bg">
      {/* HEADER */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 pt-8 flex items-center justify-between gap-3 text-sm text-muted flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-2 text-white font-bold">
            <span className="w-5 h-5 rounded-full bg-lime flex items-center justify-center shrink-0">
              <Sparkle className="w-2.5 h-2.5 text-black" strokeWidth={2.5} fill="currentColor" />
            </span>
            cccaramelo trend report
          </span>
          <span className="text-border">·</span>
          <span>{meta.cliente}</span>
          <span className="text-border">·</span>
          <span>{meta.edicao}</span>
        </div>
        {geradoEm && <span className="text-xs">gerado em {geradoEm}</span>}
      </div>

      {/* HERO */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 pt-8 pb-10 flex flex-col gap-5">
        <h1 className="font-bold text-white text-[56px] md:text-[120px] leading-[0.9] tracking-[-0.03em] -mx-1">
          TRENDS
        </h1>
        <div className="flex flex-col gap-3">
          <span className="inline-block w-fit px-3 py-1 rounded-full border border-border text-muted text-xs uppercase tracking-[0.1em] font-medium">
            {meta.edicao}
          </span>
          <p className="text-muted text-lg max-w-2xl">{meta.hype_motivo}</p>
        </div>
      </div>

      {/* HYPE METER */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 pb-14">
        <HypeMeter indiceHype={meta.indice_hype} />
      </div>

      {/* MEMES EM ALTA */}
      {primeira && (
        <div className="max-w-6xl mx-auto px-5 md:px-10 pb-14 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Eyebrow>Cultura pop agora</Eyebrow>
            <h2 className="text-white font-bold text-2xl md:text-3xl tracking-[-0.01em]">
              Memes em alta
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-5">
            <TrendCard tendencia={primeira} large index={1} />
            <div className="flex flex-col gap-5">
              {restantes.map((t, i) => (
                <TrendCard key={i} tendencia={t} index={i + 2} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* OPORTUNIDADES */}
      <div className="bg-purple py-14">
        <div className="max-w-6xl mx-auto px-5 md:px-10 flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2 text-white/70 text-xs uppercase tracking-[0.14em] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
              Onde a marca entra
            </span>
            <h2 className="text-white font-bold text-2xl md:text-3xl tracking-[-0.01em]">
              Oportunidades × {meta.produto}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
            {(oportunidades ?? []).map((o, i) => (
              <OpportunityCard key={i} oportunidade={o} index={i + 1} />
            ))}
          </div>
        </div>
      </div>

      {/* COPY PRONTO */}
      <div className="bg-surface py-14">
        <div className="max-w-6xl mx-auto px-5 md:px-10 flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <Eyebrow>Pronto pra postar</Eyebrow>
            <h2 className="text-white font-bold text-2xl md:text-3xl tracking-[-0.01em]">
              Copy pronto
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {(copy ?? []).map((c, i) => (
              <CopyBlock key={i} copy={c} />
            ))}
          </div>
        </div>
      </div>

      {/* PRÓXIMO GATILHO */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-t border-border">
        <span className="flex items-center gap-3 text-white text-xl font-bold">
          <CalendarClock className="w-5 h-5 text-lime shrink-0" strokeWidth={2} />
          {meta.proximo_gatilho.evento}
        </span>
        <div className="flex items-center gap-3 text-lime font-bold text-xl">
          <span>{meta.proximo_gatilho.data}</span>
          <span className="text-border">·</span>
          <span>{meta.proximo_gatilho.destaque}</span>
        </div>
      </div>
    </div>
  );
}

import type { TrendReport } from "@/lib/types";
import HypeMeter from "./HypeMeter";
import TrendCard from "./TrendCard";
import OpportunityCard from "./OpportunityCard";
import CopyBlock from "./CopyBlock";

export default function ReportView({ report }: { report: TrendReport }) {
  const { meta, tendencias, oportunidades, copy } = report;
  const [primeira, ...restantes] = tendencias;

  return (
    <div className="bg-bg">
      {/* HEADER */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 pt-6 flex items-center gap-3 text-sm text-muted">
        <span className="text-white font-bold">cccaramelo trend report</span>
        <span>·</span>
        <span>{meta.cliente}</span>
        <span>·</span>
        <span>{meta.edicao}</span>
      </div>

      {/* HERO */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 pt-8 pb-10 flex flex-col gap-4">
        <h1 className="font-bold text-white text-[48px] md:text-[120px] leading-[0.9] tracking-[-0.02em] -mx-1">
          TRENDS
        </h1>
        <div className="flex flex-col gap-2">
          <span className="inline-block w-fit px-3 py-1 rounded-full border border-border text-muted text-xs uppercase tracking-[0.08em] font-medium">
            {meta.edicao}
          </span>
          <p className="text-muted text-lg">{meta.hype_motivo}</p>
        </div>
      </div>

      {/* HYPE METER */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 pb-14">
        <HypeMeter indiceHype={meta.indice_hype} />
      </div>

      {/* MEMES EM ALTA */}
      {primeira && (
        <div className="max-w-6xl mx-auto px-5 md:px-10 pb-14 flex flex-col gap-6">
          <h2 className="text-white font-bold text-2xl uppercase tracking-wide">
            Memes em alta
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6">
            <TrendCard tendencia={primeira} large />
            <div className="flex flex-col gap-6">
              {restantes.map((t, i) => (
                <TrendCard key={i} tendencia={t} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* OPORTUNIDADES */}
      <div className="bg-purple py-14">
        <div className="max-w-6xl mx-auto px-5 md:px-10 flex flex-col gap-8">
          <h2 className="text-white font-bold text-2xl uppercase tracking-wide">
            Oportunidades × {meta.produto}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {oportunidades.map((o, i) => (
              <OpportunityCard key={i} oportunidade={o} />
            ))}
          </div>
        </div>
      </div>

      {/* COPY PRONTO */}
      <div className="bg-surface py-14">
        <div className="max-w-6xl mx-auto px-5 md:px-10 flex flex-col gap-8">
          <h2 className="text-white font-bold text-2xl uppercase tracking-wide">
            Copy pronto
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {copy.map((c, i) => (
              <CopyBlock key={i} copy={c} />
            ))}
          </div>
        </div>
      </div>

      {/* PRÓXIMO GATILHO */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 py-14 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-t border-border">
        <span className="text-white text-xl font-bold">
          {meta.proximo_gatilho.evento}
        </span>
        <div className="flex items-center gap-3 text-lime font-bold text-xl">
          <span>{meta.proximo_gatilho.data}</span>
          <span>·</span>
          <span>{meta.proximo_gatilho.destaque}</span>
        </div>
      </div>
    </div>
  );
}

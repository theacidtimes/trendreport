import { CalendarClock, Clock, Sparkle } from "lucide-react";
import type { TrendReport } from "@/lib/types";
import HypeMeter from "./HypeMeter";
import TrendCard from "./TrendCard";
import SocialPostCard from "./SocialPostCard";
import OpportunityCard from "./OpportunityCard";
import CopyBlock from "./CopyBlock";
import NetworkRadar from "./NetworkRadar";
import DataSourceTracker from "./DataSourceTracker";
import QuoteCard from "./QuoteCard";
import PostMentionCard from "./PostMentionCard";
import BriefingRecap from "./BriefingRecap";
import Logo from "./Logo";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-muted text-xs uppercase tracking-[0.14em] font-medium font-body">
      <span className="w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
      {children}
    </span>
  );
}

export default function ReportView({
  report,
  geradoEm,
  standalone = true,
  briefing,
}: {
  report: TrendReport;
  geradoEm?: string;
  standalone?: boolean;
  briefing?: Record<string, unknown> | string | null;
}) {
  const { meta, tendencias = [], oportunidades, copy, radar, fontes } = report;
  const corMarca = meta.cor_marca || "#660099";

  const featuredPostIndex = tendencias
    .slice(1)
    .findIndex((t) => t.imagem_url && t.post_url);

  const quotes = (radar ?? [])
    .flatMap((item) =>
      (item.sinais ?? [])
        .filter((s) => s.autor && s.url)
        .map((s) => ({ plataforma: item.plataforma, autor: s.autor as string, texto: s.tema, url: s.url }))
    )
    .slice(0, 4);

  return (
    <div className="bg-bg font-body">
      {/* HEADER */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 pt-8 flex items-center justify-between gap-3 text-sm text-muted flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {standalone && (
            <>
              <span className="flex items-center gap-2">
                <Logo size="xs" />
                <span className="text-white font-bold">trend report</span>
              </span>
              <span className="text-border">·</span>
            </>
          )}
          <span>{meta.cliente}</span>
          <span className="text-border">·</span>
          <span>{meta.edicao}</span>
        </div>
        {geradoEm && (
          <span className="flex items-center gap-1.5 text-xs bg-surface border border-border rounded-full px-3 py-1.5">
            <Clock className="w-3 h-3 shrink-0" strokeWidth={2.5} />
            gerado em {geradoEm}
          </span>
        )}
      </div>

      {/* RECAP DO BRIEFING */}
      {briefing && (
        <div className="max-w-6xl mx-auto px-5 md:px-10 pt-4">
          <BriefingRecap briefing={briefing} />
        </div>
      )}

      {/* HERO CLUSTER: hero + hype gauge + próximo gatilho */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 pt-8 pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div
            className="lg:col-span-7 rounded-3xl p-8 md:p-12 flex flex-col justify-between gap-5 min-h-[280px]"
            style={{ backgroundImage: `linear-gradient(135deg, ${corMarca}, #000000)` }}
          >
            <span className="inline-block w-fit px-3 py-1 rounded-full bg-black/25 backdrop-blur text-white/80 text-xs uppercase tracking-[0.1em] font-medium">
              {meta.edicao}
            </span>
            <div className="flex flex-col gap-4">
              <h1 className="font-sans font-bold text-white text-[32px] md:text-[48px] leading-[1.05] tracking-[-0.02em]">
                {meta.titulo_social || `Trends · ${meta.cliente}`}
              </h1>
              <p className="text-white/70 text-base md:text-lg max-w-2xl">{meta.hype_motivo}</p>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-3xl bg-black border border-border p-6 md:p-8 flex items-center justify-center">
            <HypeMeter indiceHype={meta.indice_hype} />
          </div>

          <div className="lg:col-span-12 rounded-3xl bg-surface border border-border p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <span className="flex items-center gap-3 text-white text-lg md:text-xl font-body font-bold">
              <CalendarClock className="w-5 h-5 text-lime shrink-0" strokeWidth={2} />
              {meta.proximo_gatilho.evento}
            </span>
            <div className="flex items-center gap-3 text-lime font-bold text-lg md:text-xl font-body">
              <span>{meta.proximo_gatilho.data}</span>
              <span className="text-border">·</span>
              <span>{meta.proximo_gatilho.destaque}</span>
            </div>
          </div>
        </div>
      </div>

      {/* FONTES DOS DADOS */}
      {fontes && (
        <div className="max-w-6xl mx-auto px-5 md:px-10 pb-14">
          <DataSourceTracker fontes={fontes} />
        </div>
      )}

      {/* RADAR DAS REDES */}
      {radar && radar.length > 0 && (
        <div className="max-w-6xl mx-auto px-5 md:px-10 pb-14 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Eyebrow>O que cada rede está falando</Eyebrow>
            <h2 className="font-sans text-white font-bold text-2xl md:text-3xl tracking-[-0.01em]">
              Radar das redes
            </h2>
          </div>
          <NetworkRadar radar={radar} />
        </div>
      )}

      {/* VOZES REAIS */}
      {quotes.length > 0 && (
        <div className="max-w-6xl mx-auto px-5 md:px-10 pb-14 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Eyebrow>Direto da fonte, sem filtro</Eyebrow>
            <h2 className="font-sans text-white font-bold text-2xl md:text-3xl tracking-[-0.01em]">
              Vozes reais
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quotes.map((q, i) =>
              q.plataforma === "instagram" ? (
                <PostMentionCard key={i} autor={q.autor} texto={q.texto} url={q.url} />
              ) : (
                <QuoteCard key={i} plataforma={q.plataforma} autor={q.autor} texto={q.texto} url={q.url} />
              )
            )}
          </div>
        </div>
      )}

      {/* MEMES EM ALTA */}
      {tendencias.length > 0 && (
        <div className="max-w-6xl mx-auto px-5 md:px-10 pb-14 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <Eyebrow>Cultura pop agora</Eyebrow>
            <h2 className="font-sans text-white font-bold text-2xl md:text-3xl tracking-[-0.01em]">
              Memes em alta
            </h2>
          </div>
          <div className="flex flex-col gap-5">
            <TrendCard tendencia={tendencias[0]} index={0} large />
            {tendencias.length > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {tendencias.slice(1).map((t, i) =>
                  i === featuredPostIndex ? (
                    <SocialPostCard key={i} tendencia={t} />
                  ) : (
                    <TrendCard key={i} tendencia={t} index={i + 1} />
                  )
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* OPORTUNIDADES */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 pb-14 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 text-muted text-xs uppercase tracking-[0.14em] font-medium">
            <Sparkle className="w-3 h-3 text-lime shrink-0" strokeWidth={2.2} />
            Onde a marca entra
          </span>
          <h2 className="font-sans text-white font-bold text-2xl md:text-3xl tracking-[-0.01em]">
            Oportunidades × {meta.produto}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(oportunidades ?? []).map((o, i) => (
            <OpportunityCard key={i} oportunidade={o} index={i + 1} />
          ))}
        </div>
      </div>

      {/* INSIGHTS CRIATIVOS */}
      <div className="max-w-6xl mx-auto px-5 md:px-10 pb-14 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <Eyebrow>Ponto de partida pra criação</Eyebrow>
          <h2 className="font-sans text-white font-bold text-2xl md:text-3xl tracking-[-0.01em]">
            Insights criativos
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(copy ?? []).map((c, i) => (
            <CopyBlock key={i} copy={c} />
          ))}
        </div>
      </div>
    </div>
  );
}

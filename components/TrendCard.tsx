import { ArrowUpRight, Flame, Snowflake, Sparkles, Waves } from "lucide-react";
import type { Tendencia } from "@/lib/types";
import { PLATFORM_ICON } from "@/lib/platforms";
import SmartImage from "./SmartImage";

const STATUS_LABEL: Record<Tendencia["status"], string> = {
  em_alta: "EM ALTA",
  subindo: "SUBINDO",
  estabilizando: "ESTABILIZANDO",
  esfriando: "ESFRIANDO",
};

const STATUS_ICON: Record<Tendencia["status"], typeof Flame> = {
  em_alta: Flame,
  subindo: Waves,
  estabilizando: Waves,
  esfriando: Snowflake,
};

function StatusBadge({ status }: { status: Tendencia["status"] }) {
  const base =
    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] uppercase font-medium tracking-wide w-fit";
  const Icon = STATUS_ICON[status];

  if (status === "em_alta") {
    return (
      <span className={`${base} bg-lime text-black`}>
        <Icon className="w-3 h-3" strokeWidth={2.5} />
        {STATUS_LABEL[status]}
      </span>
    );
  }

  if (status === "subindo") {
    return (
      <span className={`${base} bg-white text-black`}>
        <Icon className="w-3 h-3" strokeWidth={2.5} />
        {STATUS_LABEL[status]}
      </span>
    );
  }

  return (
    <span className={`${base} border border-white/25 text-white/70`}>
      <Icon className="w-3 h-3" strokeWidth={2.5} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function TrendCard({
  tendencia,
  large = false,
  index,
}: {
  tendencia: Tendencia;
  large?: boolean;
  index?: number;
}) {
  const hasImage = Boolean(tendencia.imagem_url);
  const PlatformIcon = tendencia.plataforma ? PLATFORM_ICON[tendencia.plataforma] : null;
  // TikTok cobre vem no formato vertical nativo (9:16) — esticar num banner
  // horizontal largo cropa/isola o conteúdo do meme. Em vez disso montamos um
  // bento na horizontal: coluna de imagem estreita e vertical ao lado do texto.
  const isVertical = tendencia.plataforma === "tiktok";
  const splitBento = isVertical && hasImage;

  return (
    <div
      className={`group flex ${
        splitBento ? "flex-col sm:flex-row" : "flex-col"
      } ${splitBento && !large ? "self-start" : ""} rounded-3xl overflow-hidden border border-border bg-purple transition-colors hover:border-lime/40`}
    >
      {/* IMAGE */}
      <div
        className={
          splitBento
            ? `relative shrink-0 overflow-hidden bg-black flex items-center justify-center w-full aspect-[3/4] sm:aspect-auto sm:self-stretch ${
                large ? "sm:w-40 md:w-56 lg:w-72" : "sm:w-28 md:w-32"
              }`
            : `relative shrink-0 overflow-hidden bg-black ${large ? "h-72 md:h-96" : "h-52"} ${
                hasImage ? "" : "flex items-center justify-center"
              }`
        }
      >
        {hasImage && (
          <SmartImage
            src={tendencia.imagem_url}
            className={
              splitBento
                ? "w-full h-full object-cover"
                : "absolute inset-0 w-full h-full object-cover object-top"
            }
          />
        )}

        {!hasImage && PlatformIcon && (
          <PlatformIcon className="w-8 h-8 text-white/30" strokeWidth={1.5} />
        )}

        {typeof index === "number" && (
          <span className="absolute top-3 left-3 bg-black/50 backdrop-blur rounded-full w-6 h-6 flex items-center justify-center text-white/80 font-bold text-[11px] tabular-nums">
            {String(index).padStart(2, "0")}
          </span>
        )}

        {PlatformIcon && hasImage && (
          <span className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <PlatformIcon className="w-3.5 h-3.5 text-white" strokeWidth={2} />
          </span>
        )}
      </div>

      {/* TEXT */}
      <div className={`flex flex-col gap-2.5 p-5 font-body ${splitBento ? "sm:flex-1 sm:justify-center" : ""}`}>
        <StatusBadge status={tendencia.status} />

        <h3
          className={`text-white leading-tight ${
            large
              ? "font-serif font-medium text-2xl md:text-3xl"
              : "font-body font-bold text-lg tracking-[-0.01em]"
          }`}
        >
          {tendencia.titulo}
        </h3>

        <p className="text-white/70 text-sm leading-relaxed">{tendencia.descricao}</p>

        <div className="flex items-start gap-2 bg-black/20 border border-white/10 rounded-xl px-4 py-3">
          <Sparkles className="w-3.5 h-3.5 text-lime shrink-0 mt-0.5" strokeWidth={2.2} />
          <p className="text-lime italic text-sm leading-relaxed">{tendencia.gancho_produto}</p>
        </div>

        {tendencia.post_url && (
          <a
            href={tendencia.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-white text-xs uppercase tracking-wide font-medium border border-white/20 rounded-lg px-4 py-2 w-fit flex items-center gap-1.5 hover:border-lime hover:text-lime transition-colors"
          >
            Ver post
            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </a>
        )}
      </div>
    </div>
  );
}

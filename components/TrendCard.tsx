import {
  ArrowUpRight,
  AtSign,
  Camera,
  Flame,
  Music2,
  Newspaper,
  Snowflake,
  Waves,
} from "lucide-react";
import type { Tendencia } from "@/lib/types";

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

const PLATFORM_ICON: Record<NonNullable<Tendencia["plataforma"]>, typeof Camera> = {
  instagram: Camera,
  twitter: AtSign,
  tiktok: Music2,
  news: Newspaper,
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
      <span className={`${base} bg-purple text-white`}>
        <Icon className="w-3 h-3" strokeWidth={2.5} />
        {STATUS_LABEL[status]}
      </span>
    );
  }

  return (
    <span className={`${base} border border-muted/50 text-muted bg-surface`}>
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

  return (
    <div
      className="group flex flex-col rounded-xl overflow-hidden border border-border bg-surface transition-colors hover:border-lime/40"
    >
      {/* IMAGE */}
      <div
        className={`relative shrink-0 bg-surface-2 ${large ? "h-64 md:h-80" : "h-40"} ${
          hasImage ? "" : "flex items-center justify-center"
        }`}
        style={
          hasImage
            ? {
                backgroundImage: `url(${tendencia.imagem_url})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {!hasImage && PlatformIcon && (
          <PlatformIcon className="w-8 h-8 text-muted/40" strokeWidth={1.5} />
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
      <div className="flex flex-col gap-2.5 p-5 font-body">
        <StatusBadge status={tendencia.status} />

        <h3
          className={`font-sans font-bold text-white tracking-[-0.01em] leading-tight ${
            large ? "text-xl md:text-2xl" : "text-lg"
          }`}
        >
          {tendencia.titulo}
        </h3>

        <p className="text-muted text-sm leading-relaxed">{tendencia.descricao}</p>

        <p className="text-lime italic text-sm leading-relaxed">
          {tendencia.gancho_produto}
        </p>

        {tendencia.post_url && (
          <a
            href={tendencia.post_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 text-white text-xs uppercase tracking-wide font-medium border border-border rounded-lg px-4 py-2 w-fit flex items-center gap-1.5 hover:border-lime hover:text-lime transition-colors"
          >
            Ver post
            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </a>
        )}
      </div>
    </div>
  );
}

import { ArrowUpRight, Sparkles } from "lucide-react";
import type { Tendencia } from "@/lib/types";
import { PLATFORM_ICON, PLATFORM_LABEL, PLATFORM_ACCENT } from "@/lib/platforms";
import SmartImage from "./SmartImage";

export default function SocialPostCard({ tendencia }: { tendencia: Tendencia }) {
  const plataforma = tendencia.plataforma;
  const PlatformIcon = plataforma ? PLATFORM_ICON[plataforma] : null;
  const accent = plataforma ? PLATFORM_ACCENT[plataforma] : "#660099";
  const handle = tendencia.autor ? `@${tendencia.autor}` : plataforma ? PLATFORM_LABEL[plataforma] : "Post";
  const initial = (tendencia.autor ?? tendencia.titulo ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="flex flex-col rounded-3xl overflow-hidden border border-border bg-black">
      {/* POST CHROME */}
      <div className="flex items-center gap-3 px-5 py-4">
        <span
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-body font-bold text-sm text-white"
          style={{ backgroundColor: accent }}
        >
          {initial}
        </span>
        <div className="flex flex-col min-w-0 font-body">
          <span className="text-white text-sm font-semibold truncate">{handle}</span>
          {plataforma && (
            <span className="flex items-center gap-1 text-muted text-xs">
              {PlatformIcon && <PlatformIcon className="w-3 h-3" strokeWidth={2.2} />}
              {PLATFORM_LABEL[plataforma]}
            </span>
          )}
        </div>
      </div>

      {/* IMAGE */}
      {tendencia.imagem_url && plataforma === "tiktok" && (
        <div className="relative w-full aspect-[4/5] bg-black flex items-center justify-center">
          <SmartImage src={tendencia.imagem_url} className="h-full w-auto object-contain" />
        </div>
      )}

      {tendencia.imagem_url && plataforma !== "tiktok" && (
        <div className="relative w-full aspect-[4/5] bg-surface-2">
          <SmartImage
            src={tendencia.imagem_url}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        </div>
      )}

      {/* CAPTION */}
      <div className="flex flex-col gap-3 p-5 font-body">
        <p className="text-white/80 text-sm leading-relaxed line-clamp-4">
          {tendencia.descricao}
        </p>

        <div className="flex items-start gap-2 bg-purple/20 border border-purple/40 rounded-xl px-4 py-3">
          <Sparkles className="w-3.5 h-3.5 text-lime shrink-0 mt-0.5" strokeWidth={2.2} />
          <p className="text-lime text-xs italic leading-relaxed">{tendencia.gancho_produto}</p>
        </div>

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

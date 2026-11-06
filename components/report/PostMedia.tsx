"use client";

import { useState } from "react";
import { ArrowUpRight, Play } from "lucide-react";
import type { Plataforma } from "@/lib/platforms";
import { PLATFORM_LABEL } from "@/lib/platforms";
import SmartImage from "../SmartImage";
import { imagemSubidaAMao, urlDoPlayer } from "@/lib/reportMidia";

export default function PostMedia({
  imagem,
  postUrl,
  plataforma,
  autor,
  alt,
  formato = "largo",
}: {
  imagem?: string | null;
  postUrl?: string | null;
  plataforma?: Plataforma;
  autor?: string | null;
  alt: string;
  // "largo" = foto de abertura 16:9; "vertical" = 4:5/9:16, pra coluna lateral.
  formato?: "largo" | "vertical";
}) {
  const player = urlDoPlayer(postUrl);
  const ilustrativa = imagemSubidaAMao(imagem);
  const [tocando, setTocando] = useState(false);
  if (!imagem && !player) return null;

  const proporcao = tocando
    ? "aspect-[9/16] max-h-[78vh] mx-auto"
    : formato === "vertical"
      ? "aspect-[4/5]"
      : "aspect-[4/3] md:aspect-[16/9]";

  return (
    <figure className="m-0">
      <div className={`relative w-full overflow-hidden bg-surface-2 ${proporcao}`}>
        {tocando && player ? (
          <iframe
            src={player}
            title={`Vídeo de ${autor ?? (plataforma ? PLATFORM_LABEL[plataforma] : "post")}`}
            className="absolute inset-0 w-full h-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <>
            <SmartImage src={imagem} alt={alt} className="absolute inset-0 w-full h-full object-cover" />
            {player && (
              <button
                type="button"
                onClick={() => setTocando(true)}
                className="absolute inset-0 flex items-center justify-center group"
                aria-label="Assistir ao vídeo"
              >
                <span className="w-16 h-16 rounded-full bg-black/60 backdrop-blur border border-white/30 flex items-center justify-center group-hover:bg-lime group-hover:border-lime transition-colors">
                  <Play className="w-6 h-6 text-white group-hover:text-black ml-1" strokeWidth={2} fill="currentColor" />
                </span>
              </button>
            )}
          </>
        )}
      </div>
      {(autor || plataforma || postUrl) && (
        <figcaption className="mt-2 pt-2 border-t border-border flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {ilustrativa && !tocando && <span className="kicker text-muted-2">Imagem ilustrativa · Fonte:</span>}
          {autor && <span className="text-white/80">{autor}</span>}
          {plataforma && <span>{PLATFORM_LABEL[plataforma]}</span>}
          {postUrl && (
            <a
              href={postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-lime underline underline-offset-4 hover:text-white"
            >
              Ver post original
              <ArrowUpRight className="w-3 h-3" strokeWidth={2.5} />
            </a>
          )}
        </figcaption>
      )}
    </figure>
  );
}

"use client";

import { useState } from "react";
import { ArrowUpRight, Play } from "lucide-react";
import { PLATFORM_ICON, PLATFORM_LABEL, type Plataforma } from "@/lib/platforms";
import { embedDoPost } from "@/lib/reportMidia";

export type PostDestaque = { plataforma: Plataforma; autor: string; texto: string; url: string };

// Os posts que sustentam a leitura, trazidos pra dentro da página. TikTok e
// Instagram viram um tile na proporção do próprio conteúdo, que toca ao clicar
// (o player da rede só carrega no clique); Reddit, notícia e tweet viram card
// de texto de altura livre. O tema do radar é resumo do modelo, não fala do
// post: por isso sem aspas.
function Rodape({ p, claro, rotulo }: { p: PostDestaque; claro?: boolean; rotulo: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${claro ? "text-black/60" : "text-muted"}`}>
      <span className={claro ? "text-black font-medium" : "text-white/80 font-medium"}>{p.autor}</span>
      <a
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1 underline underline-offset-4 ${
          claro ? "text-black hover:text-purple" : "text-lime hover:text-white"
        }`}
      >
        {rotulo}
        <ArrowUpRight className="w-3 h-3" strokeWidth={2.5} />
      </a>
    </div>
  );
}

function Tile({ p, embed }: { p: PostDestaque; embed: { src: string; proporcao: string } }) {
  const [tocando, setTocando] = useState(false);
  const Icone = PLATFORM_ICON[p.plataforma];
  return (
    // Teto de largura: em duas colunas um 9:16 ficaria com mais de 600px de altura.
    <div className="max-w-[340px] mx-auto">
      <div
        className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-surface-3 via-surface-2 to-black"
        style={{ aspectRatio: embed.proporcao }}
      >
        {tocando ? (
          <iframe
            src={embed.src}
            title={`${PLATFORM_LABEL[p.plataforma]}: ${p.texto}`}
            className="absolute inset-0 w-full h-full border-0 bg-black"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setTocando(true)}
            className="group absolute inset-0 text-left"
            aria-label={`Assistir: ${p.texto}`}
          >
            <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur px-2.5 py-1 kicker text-white">
              <Icone className="w-3 h-3" strokeWidth={2.2} />
              {PLATFORM_LABEL[p.plataforma]}
            </span>
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-16 h-16 rounded-full bg-black/60 backdrop-blur border border-white/30 flex items-center justify-center group-hover:bg-lime group-hover:border-lime transition-colors">
                <Play className="w-6 h-6 text-white group-hover:text-black ml-1" strokeWidth={2} fill="currentColor" />
              </span>
            </span>
            <span className="absolute inset-x-0 bottom-0 p-4 pt-12 bg-gradient-to-t from-black/85 to-transparent">
              <span className="block font-serif text-lg leading-tight text-white">{p.texto}</span>
            </span>
          </button>
        )}
      </div>
      <div className="pt-2.5 px-1">
        <Rodape p={p} rotulo="Ver post original" />
      </div>
    </div>
  );
}

function CardTexto({ p }: { p: PostDestaque }) {
  const Icone = PLATFORM_ICON[p.plataforma];
  const claro = p.plataforma !== "news";
  return (
    <article
      className={`rounded-3xl p-6 flex flex-col gap-4 ${
        claro ? "bg-white text-black" : "bg-surface border border-border text-white"
      }`}
    >
      <span className={`kicker inline-flex items-center gap-2 ${claro ? "text-black/50" : "text-muted"}`}>
        <Icone className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
        {PLATFORM_LABEL[p.plataforma]}
      </span>
      <p className="font-serif text-xl md:text-2xl leading-snug m-0">{p.texto}</p>
      <Rodape p={p} claro={claro} rotulo={p.plataforma === "news" ? "Ler matéria" : p.plataforma === "reddit" ? "Ver discussão" : "Ver post"} />
    </article>
  );
}

export default function PostsEmDestaque({ posts }: { posts: PostDestaque[] }) {
  return (
    <div style={{ columns: "240px", columnGap: "1rem" }}>
      {posts.map((p, i) => {
        const embed = embedDoPost(p.url);
        return (
          <div key={i} className="mb-4 break-inside-avoid">
            {embed ? <Tile p={p} embed={embed} /> : <CardTexto p={p} />}
          </div>
        );
      })}
    </div>
  );
}

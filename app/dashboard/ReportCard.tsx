"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, Flame, Sparkle } from "lucide-react";

export default function ReportCard({
  index,
  slug,
  cliente,
  createdAt,
  indiceHype,
  hypeMotivo,
  imagemUrl,
}: {
  index: number;
  slug: string;
  cliente: string;
  createdAt: string;
  indiceHype: number;
  hypeMotivo: string;
  imagemUrl: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}/r/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const dataFormatada = new Date(createdAt).toLocaleDateString("pt-BR");

  return (
    <Link
      href={`/dashboard/${slug}`}
      className="group flex flex-col rounded-xl overflow-hidden border border-border bg-surface transition-colors hover:border-lime/40"
    >
      {/* IMAGE */}
      <div
        className={`relative h-36 shrink-0 bg-surface-2 ${
          imagemUrl ? "" : "flex items-center justify-center"
        }`}
        style={
          imagemUrl
            ? {
                backgroundImage: `url(${imagemUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {!imagemUrl && <Sparkle className="w-6 h-6 text-lime/50" strokeWidth={1.5} />}

        <span className="absolute top-3 left-3 bg-black/50 backdrop-blur rounded-full w-6 h-6 flex items-center justify-center text-white/80 font-bold text-[11px] tabular-nums">
          {String(index).padStart(2, "0")}
        </span>

        <div className="absolute top-3 right-3 flex items-center gap-1 text-lime font-bold text-sm tabular-nums bg-black/50 backdrop-blur rounded-full px-2.5 py-1">
          <Flame className="w-3 h-3 shrink-0" strokeWidth={2.5} />
          {indiceHype}
        </div>
      </div>

      {/* TEXT */}
      <div className="flex flex-col gap-2 p-5 font-body">
        <span className="font-sans font-bold text-lg text-white">{cliente}</span>
        <span className="text-muted text-xs">{dataFormatada}</span>
        {hypeMotivo && (
          <p className="text-muted text-sm leading-relaxed line-clamp-2">{hypeMotivo}</p>
        )}

        <div className="flex items-center gap-2 pt-2">
          <span className="text-white text-xs uppercase tracking-wide font-medium border border-border rounded-lg px-4 py-2 flex items-center gap-1.5 group-hover:border-lime group-hover:text-lime transition-colors">
            Ver
            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </span>

          <button
            onClick={(e) => {
              e.preventDefault();
              handleCopy();
            }}
            className="text-black bg-lime text-xs uppercase tracking-wide font-bold rounded-lg px-4 py-2 flex items-center gap-1.5 hover:brightness-110 transition-[filter]"
          >
            {copied ? (
              <>
                Copiado
                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
              </>
            ) : (
              <>
                Copiar link
                <Copy className="w-3.5 h-3.5" strokeWidth={2.5} />
              </>
            )}
          </button>
        </div>
      </div>
    </Link>
  );
}

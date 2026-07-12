"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Clock,
  Copy,
  Flame,
  Loader2,
  Pencil,
  Sparkle,
} from "lucide-react";
import SmartImage from "@/components/SmartImage";

const TILE_BG = ["bg-surface", "bg-purple", "bg-white"];

export default function ReportCard({
  index,
  slug,
  cliente,
  createdAt,
  status,
  indiceHype,
  hypeMotivo,
  imagemUrl,
  corMarca,
}: {
  index: number;
  slug: string;
  cliente: string;
  createdAt: string;
  status: string;
  indiceHype: number;
  hypeMotivo: string;
  imagemUrl: string | null;
  corMarca: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const bg = TILE_BG[(index - 1) % TILE_BG.length];
  const isLight = bg === "bg-white";

  async function handleCopy() {
    const url = `${window.location.origin}/r/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const dataFormatada = new Date(createdAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link
      href={`/dashboard/${slug}`}
      className={`group flex flex-col rounded-3xl overflow-hidden border border-border transition-colors hover:border-white/20 shadow-card ${bg}`}
    >
      {/* IMAGE */}
      <div
        className={`relative h-48 shrink-0 overflow-hidden bg-purple-mid ${
          imagemUrl ? "" : "flex items-center justify-center"
        }`}
      >
        {imagemUrl && (
          <SmartImage
            src={imagemUrl}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        )}

        {!imagemUrl && <Sparkle className="w-6 h-6 text-white/30" strokeWidth={1.5} />}

        <span className="absolute top-3 left-3 bg-black/50 backdrop-blur rounded-full w-6 h-6 flex items-center justify-center text-white/80 font-bold text-[11px] tabular-nums">
          {String(index).padStart(2, "0")}
        </span>

        <div className="absolute top-3 right-3 flex items-center gap-1 text-lime font-bold text-sm tabular-nums bg-black/50 backdrop-blur rounded-full px-2.5 py-1">
          <Flame className="w-3 h-3 shrink-0" strokeWidth={2.5} />
          {indiceHype}
        </div>

        {status !== "published" && (
          <span
            className={`absolute bottom-3 left-3 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide backdrop-blur rounded-full px-2.5 py-1 ${
              status === "pending"
                ? "bg-black/50 text-white/80"
                : status === "error"
                  ? "bg-red-500/80 text-white"
                  : "bg-lime text-black"
            }`}
          >
            {status === "pending" ? (
              <>
                <Loader2 className="w-3 h-3 shrink-0 animate-spin" strokeWidth={2.5} />
                Gerando
              </>
            ) : status === "error" ? (
              "Erro"
            ) : (
              <>
                <Pencil className="w-3 h-3 shrink-0" strokeWidth={2.5} />
                Em revisão
              </>
            )}
          </span>
        )}
      </div>

      {/* TEXT */}
      <div className="flex flex-col gap-2 p-5 font-body">
        <span
          className="w-fit font-body font-bold text-white text-base rounded-lg px-3 py-1.5"
          style={{
            backgroundImage: `linear-gradient(135deg, ${corMarca || "#660099"}, #000000)`,
          }}
        >
          {cliente}
        </span>
        <span
          className={`flex items-center gap-1.5 text-xs ${isLight ? "text-black/50" : "text-muted"}`}
        >
          <Clock className="w-3 h-3 shrink-0" strokeWidth={2.5} />
          {dataFormatada}
        </span>
        {hypeMotivo && (
          <p
            className={`text-sm leading-relaxed line-clamp-2 ${
              isLight ? "text-black/70" : "text-muted"
            }`}
          >
            {hypeMotivo}
          </p>
        )}

        <div className="flex items-center gap-2 pt-2">
          <span
            className={`text-xs uppercase tracking-wide font-medium border rounded-lg px-4 py-2 flex items-center gap-1.5 group-hover:border-lime group-hover:text-lime transition-colors ${
              isLight ? "border-black/15 text-black" : "border-white/20 text-white"
            }`}
          >
            {status === "ready" ? "Revisar" : "Ver"}
            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </span>

          {status === "published" && (
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
          )}
        </div>
      </div>
    </Link>
  );
}

"use client";

import { useState } from "react";
import { Check, Copy, Camera, Clapperboard } from "lucide-react";
import type { CopyItem } from "@/lib/types";

export default function CopyBlock({ copy }: { copy: CopyItem }) {
  const [copied, setCopied] = useState(false);

  const fullText = `${copy.texto}\n\n${copy.hashtags
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ")}`;

  const Icon = copy.tipo === "feed" ? Camera : Clapperboard;

  async function handleCopy() {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-black border border-border rounded-3xl p-6 flex flex-col gap-4 hover:border-lime/40 transition-colors font-body">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-lime text-xs uppercase tracking-[0.1em] font-medium">
          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
          {copy.tipo === "feed" ? "Feed" : "Stories"}
        </span>
        <button
          onClick={handleCopy}
          className="text-black bg-lime text-xs uppercase tracking-wide font-bold rounded-lg px-3.5 py-2 flex items-center gap-1.5 hover:brightness-110 transition-[filter] shrink-0"
        >
          {copied ? (
            <>
              Copiado
              <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
            </>
          ) : (
            <>
              Copiar
              <Copy className="w-3.5 h-3.5" strokeWidth={2.5} />
            </>
          )}
        </button>
      </div>

      <pre className="whitespace-pre-wrap font-mono text-sm text-white/90">
        {fullText}
      </pre>
    </div>
  );
}

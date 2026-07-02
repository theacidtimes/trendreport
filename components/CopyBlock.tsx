"use client";

import { useState } from "react";
import type { CopyItem } from "@/lib/types";

export default function CopyBlock({ copy }: { copy: CopyItem }) {
  const [copied, setCopied] = useState(false);

  const fullText = `${copy.texto}\n\n${copy.hashtags
    .map((h) => (h.startsWith("#") ? h : `#${h}`))
    .join(" ")}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-bg border border-border rounded-xl p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-lime text-xs uppercase tracking-[0.08em] font-medium">
          {copy.tipo === "feed" ? "FEED" : "STORIES"}
        </span>
        <button
          onClick={handleCopy}
          className="text-black bg-lime text-xs uppercase tracking-wide font-bold rounded-lg px-4 py-2"
        >
          {copied ? "COPIADO ✓" : "COPIAR"}
        </button>
      </div>

      <pre className="whitespace-pre-wrap font-mono text-sm text-white/90">
        {fullText}
      </pre>
    </div>
  );
}

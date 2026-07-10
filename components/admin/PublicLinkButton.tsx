"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

export default function PublicLinkButton({ marcaId }: { marcaId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/painel/${marcaId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-2 rounded-full border border-border text-muted hover:text-white hover:border-lime/40 text-sm font-medium px-3.5 h-9 transition-colors"
    >
      {copied ? (
        <Check className="w-4 h-4 text-lime" strokeWidth={2.2} />
      ) : (
        <Link2 className="w-4 h-4" strokeWidth={2} />
      )}
      {copied ? "Copiado" : "Link público"}
    </button>
  );
}

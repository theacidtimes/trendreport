"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

export default function CopyLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}/r/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="fixed bottom-6 right-6 md:right-8 z-50 bg-lime text-black font-bold text-sm uppercase tracking-wide rounded-lg px-6 py-4 shadow-lime hover:brightness-110 transition-[filter] md:w-auto w-[calc(100%-3rem)] flex items-center justify-center gap-2"
    >
      {copied ? (
        <>
          Copiado
          <Check className="w-4 h-4" strokeWidth={2.5} />
        </>
      ) : (
        <>
          Copiar link
          <Link2 className="w-4 h-4" strokeWidth={2.5} />
        </>
      )}
    </button>
  );
}

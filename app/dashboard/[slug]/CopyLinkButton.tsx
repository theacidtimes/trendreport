"use client";

import { useState } from "react";

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
      className="fixed bottom-6 right-6 md:right-8 z-50 bg-lime text-black font-bold text-sm uppercase tracking-wide rounded-lg px-6 py-4 shadow-lg md:w-auto w-[calc(100%-3rem)]"
    >
      {copied ? "COPIADO ✓" : "COPIAR LINK"}
    </button>
  );
}

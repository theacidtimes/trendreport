"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Pencil } from "lucide-react";

export default function PublishedActions({ slug }: { slug: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [reverting, setReverting] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}/r/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleEditAgain() {
    setReverting(true);
    const res = await fetch(`/api/reports/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ready" }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      setReverting(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 md:right-8 z-50 flex items-center gap-2 w-[calc(100%-3rem)] md:w-auto">
      <button
        onClick={handleEditAgain}
        disabled={reverting}
        className="flex-1 md:flex-none bg-surface border border-border text-white font-semibold text-sm tracking-[-0.01em] rounded-full px-5 py-4 hover:border-white/20 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
      >
        <Pencil className="w-4 h-4" strokeWidth={2.5} />
        {reverting ? "Abrindo..." : "Editar novamente"}
      </button>
      <button
        onClick={handleCopy}
        className="flex-1 md:flex-none bg-lime text-black font-semibold text-sm tracking-[-0.01em] rounded-full px-6 py-4 shadow-lime hover:brightness-105 transition-[filter] flex items-center justify-center gap-2"
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
    </div>
  );
}

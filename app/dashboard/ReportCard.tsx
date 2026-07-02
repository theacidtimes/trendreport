"use client";

import { useState } from "react";
import Link from "next/link";

export default function ReportCard({
  slug,
  cliente,
  createdAt,
  indiceHype,
}: {
  slug: string;
  cliente: string;
  createdAt: string;
  indiceHype: number;
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
    <div className="bg-surface rounded-xl p-6 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex flex-col gap-1">
        <span className="font-bold text-xl text-white">{cliente}</span>
        <span className="text-muted text-sm">{dataFormatada}</span>
      </div>

      <div className="flex items-center gap-6">
        <span className="text-lime font-bold text-2xl">{indiceHype}</span>

        <Link
          href={`/dashboard/${slug}`}
          className="text-white text-xs uppercase tracking-wide font-medium border border-border rounded-lg px-4 py-2 hover:border-lime transition-colors"
        >
          VER
        </Link>

        <button
          onClick={handleCopy}
          className="text-black bg-lime text-xs uppercase tracking-wide font-bold rounded-lg px-4 py-2"
        >
          {copied ? "COPIADO ✓" : "COPIAR LINK"}
        </button>
      </div>
    </div>
  );
}

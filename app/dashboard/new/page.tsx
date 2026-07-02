"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PLACEHOLDER = `data: "2026-07-01"
cliente: "Vivo Fibra"
tom: "irreverente, cultura pop brasileira"

contexto: >
  Brasil 3x0 Escócia ontem. Vini Jr fez 2 gols.
  Próximo jogo: 29/06, Houston, 14h. Calor de 33°C.

memes_que_vi:
  - "Wepinko (Vini Jr + Virginia Fonseca)"
  - "Pausa de hidratação da FIFA"

quero: >
  Conectar o calor extremo com Fibra em casa.
  Publicar antes do jogo de segunda.`;

export default function NewReportPage() {
  const router = useRouter();
  const [briefing, setBriefing] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!briefing.trim()) {
      setError("Cole o briefing antes de gerar.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing }),
      });

      const data = await res.json();

      if (!res.ok) {
        const base = data.error ?? "Erro ao gerar relatório.";
        setError(data.detail ? `${base} — ${data.detail}` : base);
        setLoading(false);
        return;
      }

      router.push(`/dashboard/${data.slug}`);
    } catch {
      setError("Erro de rede ao gerar relatório.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl flex flex-col gap-4"
      >
        <span className="text-muted uppercase text-xs tracking-[0.08em] font-medium">
          BRIEFING
        </span>

        <textarea
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
          placeholder={PLACEHOLDER}
          className="bg-surface border border-border text-white text-[15px] rounded-xl p-4 min-h-[200px] md:min-h-[320px] resize-y outline-none focus:border-lime transition-colors font-mono"
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-lime text-black font-bold text-base uppercase h-14 rounded-lg w-full flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <>
              ANALISANDO
              <span className="animate-pulse text-purple">●</span>
            </>
          ) : (
            "GERAR RELATÓRIO →"
          )}
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>
    </div>
  );
}

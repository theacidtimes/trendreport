"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, TriangleAlert } from "lucide-react";
import TypingDots from "./TypingDots";

export default function ComposerBar() {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 224)}px`;
  }

  async function handleSubmit() {
    if (!text.trim() || loading) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        const base = data.error ?? "Erro ao gerar relatório.";
        setError(data.detail ? `${base} — ${data.detail}` : base);
        setLoading(false);
        return;
      }

      // Navega direto pro loader real de /dashboard/[slug] (ligado ao progresso
      // de verdade da geração) — sem animação de "concluído" falsa aqui.
      router.push(`/dashboard/${data.slug}`);
    } catch {
      setError("Erro de rede ao gerar relatório.");
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative bg-surface border border-border rounded-2xl focus-within:border-lime transition-colors shadow-card">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          disabled={loading}
          onChange={(e) => {
            setText(e.target.value);
            autoGrow();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Cole o briefing ou descreva o momento cultural que você quer explorar…"
          className={`w-full bg-transparent text-white text-[15px] placeholder:text-muted/70 resize-none outline-none px-5 pt-4 pr-16 max-h-56 overflow-y-auto disabled:opacity-50 ${
            loading ? "pb-1" : "pb-4"
          }`}
        />

        <div className="flex items-center justify-between px-5 pb-3 pt-1 min-h-[14px]">
          {loading ? (
            <span className="flex items-center gap-2 text-lime text-xs uppercase tracking-wide font-medium font-body">
              Gerando
              <TypingDots />
            </span>
          ) : (
            <span />
          )}
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim() || loading}
          aria-label="Gerar relatório"
          className="absolute right-3 bottom-3 w-9 h-9 rounded-full bg-lime text-black flex items-center justify-center shadow-lime hover:brightness-110 transition-[filter] disabled:opacity-30 disabled:pointer-events-none"
        >
          {loading ? <TypingDots className="text-black" /> : <ArrowUp className="w-4 h-4" strokeWidth={2.5} />}
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm flex items-center gap-2">
          <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
          {error}
        </p>
      )}
    </div>
  );
}

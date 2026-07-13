"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, ArrowUp, CheckCircle2 } from "lucide-react";
import type { BriefingPatch } from "@/components/briefing/useBriefingState";

type Msg = { role: "user" | "assistant"; content: string };

const GREETING =
  "Oi! Sou seu copiloto de briefing. Vou te guiar por perguntas rápidas e preencher os campos à esquerda conforme você responde. Pra começar: qual é o cliente ou marca desse post?";

export default function BriefingAssistant({
  fields,
  applyPatch,
  disabled,
}: {
  fields: Required<BriefingPatch>;
  applyPatch: (p: BriefingPatch) => void;
  disabled?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy || disabled) return;

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/briefing-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "erro");

      if (data.patch) applyPatch(data.patch as BriefingPatch);
      if (data.pronto) setReady(true);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.message || "Pode me contar mais?" },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Ops, tive um problema pra responder. Pode tentar de novo?",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-[440px] lg:h-[576px] rounded-2xl border border-border bg-surface/50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <span className="w-7 h-7 rounded-lg bg-purple/15 border border-purple/25 grid place-items-center text-purple shrink-0">
          <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
        </span>
        <div className="flex flex-col">
          <span className="text-white text-[13px] font-medium leading-tight">
            Copiloto de briefing
          </span>
          <span className="text-muted-2 text-[11px] leading-tight">
            Pergunta e preenche pra você
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "self-end max-w-[85%] rounded-2xl rounded-br-sm bg-purple/15 border border-purple/20 text-white text-[13px] leading-relaxed px-3.5 py-2.5"
                : "self-start max-w-[90%] rounded-2xl rounded-bl-sm bg-surface-2 border border-border text-white/90 text-[13px] leading-relaxed px-3.5 py-2.5"
            }
          >
            {m.content}
          </div>
        ))}

        {busy && (
          <div className="self-start rounded-2xl rounded-bl-sm bg-surface-2 border border-border px-3.5 py-3 flex items-center gap-1.5">
            <span className="typing-dot w-1.5 h-1.5 rounded-full bg-muted" />
            <span
              className="typing-dot w-1.5 h-1.5 rounded-full bg-muted"
              style={{ animationDelay: "0.15s" }}
            />
            <span
              className="typing-dot w-1.5 h-1.5 rounded-full bg-muted"
              style={{ animationDelay: "0.3s" }}
            />
          </div>
        )}

        {ready && !busy && (
          <div className="self-start flex items-center gap-1.5 text-lime text-[12px] font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
            Briefing pronto. É só revisar e gerar o relatório.
          </div>
        )}
      </div>

      <div className="border-t border-border p-2.5 shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-surface focus-within:border-purple/50 transition-colors px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={busy || disabled}
            rows={1}
            placeholder="Responda aqui..."
            className="flex-1 bg-transparent text-white text-[13px] outline-none resize-none max-h-24 placeholder:text-muted/60 disabled:opacity-60 font-body leading-relaxed py-0.5"
          />
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || busy || disabled}
            aria-label="Enviar"
            className="shrink-0 w-8 h-8 rounded-lg bg-purple text-white grid place-items-center hover:brightness-110 transition disabled:opacity-40 disabled:pointer-events-none"
          >
            <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

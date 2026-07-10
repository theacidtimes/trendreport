"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { toggleLinkedin } from "@/app/dashboard/radar/actions";
import type { Marca } from "@/lib/types";

// As lanes default (reddit, tiktok, x, news) são sempre ligadas e travadas — o cadeado
// deixa explícito que fazem parte do composto e não se mexem. LinkedIn é a única ligável.
const LOCKED = ["Reddit", "TikTok", "X", "Notícias"];

function Switch({
  on,
  disabled,
  onClick,
  label,
}: {
  on: boolean;
  disabled?: boolean;
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative shrink-0 w-9 h-5 rounded-full transition-all duration-200 disabled:cursor-default ${
        on
          ? "bg-lime shadow-[0_0_0_1px_rgba(129,211,0,0.45)]"
          : "bg-surface-2 border border-border hover:border-lime/50 cursor-pointer"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-all duration-200 ${
          on ? "translate-x-4 bg-black" : "bg-muted"
        }`}
      />
    </button>
  );
}

export default function ActorsBar({ marca }: { marca: Marca }) {
  const [ln, setLn] = useState(Boolean(marca.yaml_conhecimento?.linkedin_ativo));
  const [loading, setLoading] = useState(false);

  async function toggleLn() {
    if (loading) return;
    setLoading(true);
    const next = !ln;
    setLn(next);
    try {
      await toggleLinkedin(marca.id, next);
    } catch {
      setLn(!next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-surface border border-border p-5 flex flex-col gap-3">
      <span className="text-muted text-xs uppercase tracking-[0.12em] font-medium">
        Actors
      </span>
      <div className="flex flex-wrap items-center gap-2.5">
        {LOCKED.map((label) => (
          <div
            key={label}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2/40 px-3 py-2"
          >
            <span className="text-sm text-white">{label}</span>
            <Lock className="w-3 h-3 text-muted/50 shrink-0" strokeWidth={2.2} />
            <Switch on disabled label={`${label} sempre ativo`} />
          </div>
        ))}

        <div
          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors ${
            ln ? "border-lime/40 bg-lime/5" : "border-border bg-surface-2/40"
          } ${loading ? "opacity-60" : ""}`}
        >
          <span className="text-sm text-white">LinkedIn</span>
          <Switch
            on={ln}
            disabled={loading}
            onClick={toggleLn}
            label={ln ? "Desligar LinkedIn" : "Ligar LinkedIn"}
          />
        </div>
      </div>
    </div>
  );
}

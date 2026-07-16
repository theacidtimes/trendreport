"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toggleModulo } from "@/app/console/actions";
import type { ModuloNome } from "@/lib/types";

const MODULOS: { id: ModuloNome; label: string }[] = [
  { id: "radar", label: "Radar" },
  { id: "reports", label: "Reports" },
  { id: "dados_semanticos", label: "Dados semânticos" },
];

export default function ModuloToggles({
  tenantId,
  ativos,
}: {
  tenantId: string;
  ativos: Record<ModuloNome, boolean>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<ModuloNome | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function onToggle(m: ModuloNome, next: boolean) {
    setErro(null);
    setBusy(m);
    startTransition(async () => {
      try {
        await toggleModulo(tenantId, m, next);
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao alterar o módulo.");
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-4 shadow-card">
      <h2 className="kicker text-muted-2">Módulos</h2>
      <ul className="flex flex-col gap-2">
        {MODULOS.map((m) => {
          const on = ativos[m.id] ?? false;
          const loading = pending && busy === m.id;
          return (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className={on ? "text-white" : "text-muted-2"}>
                {m.label}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                disabled={pending}
                onClick={() => onToggle(m.id, !on)}
                className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-60 ${
                  on ? "bg-lime" : "bg-surface-3"
                }`}
              >
                <span
                  className={`absolute top-0.5 grid place-items-center h-5 w-5 rounded-full bg-white transition-transform ${
                    on ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                >
                  {loading && (
                    <Loader2
                      className="w-3 h-3 animate-spin text-black/60"
                      strokeWidth={2.4}
                    />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {erro && <p className="text-red-400 text-xs">{erro}</p>}
    </div>
  );
}

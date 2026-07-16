"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, Ban } from "lucide-react";
import { lancarAssinatura, cancelarAssinatura } from "@/app/console/actions";
import type { Assinatura } from "@/lib/types";

const PLANO_LABEL: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AssinaturaControls({
  tenantId,
  atual,
  ciclos,
}: {
  tenantId: string;
  atual: Assinatura | null;
  ciclos: number;
}) {
  const router = useRouter();
  const [plano, setPlano] = useState<string>(atual?.plano_tipo ?? "mensal");
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setErro(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro na assinatura.");
      }
    });
  }

  const ativa = atual?.status === "ativa";

  return (
    <div className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-4 shadow-card">
      <h2 className="kicker text-muted-2">Assinatura</h2>

      {atual ? (
        <dl className="flex flex-col gap-2.5 text-sm">
          <Row label="Plano">
            {PLANO_LABEL[atual.plano_tipo] ?? atual.plano_tipo}
          </Row>
          <Row label="Status">{atual.status}</Row>
          <Row label="Início">{formatDate(atual.data_inicio)}</Row>
          <Row label="Vigente até">{formatDate(atual.data_fim)}</Row>
          <Row label="Renovação automática">
            {atual.auto_renovacao ? "Sim" : "Não"}
          </Row>
        </dl>
      ) : (
        <p className="text-muted text-sm">Nenhuma assinatura registrada.</p>
      )}

      <div className="flex flex-col gap-2 pt-3 border-t border-border">
        <span className="text-muted text-[11px] uppercase tracking-wide">
          Lançar novo ciclo
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={plano}
            onChange={(e) => setPlano(e.target.value)}
            disabled={pending}
            className="rounded-xl bg-surface-2 border border-border px-3 py-2 text-white text-sm outline-none focus:border-white/30 transition-colors disabled:opacity-60"
          >
            <option value="mensal">Mensal</option>
            <option value="trimestral">Trimestral</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
          </select>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => lancarAssinatura(tenantId, plano))}
            className="inline-flex items-center gap-2 rounded-xl bg-purple text-white text-sm font-medium px-3.5 py-2 hover:bg-purple/90 disabled:opacity-60 transition-colors"
          >
            {pending ? (
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />
            ) : (
              <RefreshCw className="w-4 h-4" strokeWidth={2.2} />
            )}
            {atual ? "Renovar / trocar" : "Lançar"}
          </button>
          {ativa && (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => cancelarAssinatura(tenantId))}
              className="inline-flex items-center gap-2 rounded-xl border border-border text-muted hover:text-red-400 hover:border-red-400/40 text-sm font-medium px-3.5 py-2 disabled:opacity-60 transition-colors"
            >
              <Ban className="w-4 h-4" strokeWidth={2.2} />
              Cancelar
            </button>
          )}
        </div>
        <p className="text-muted-2 text-[11px]">
          Lançar expira o ciclo ativo e inicia um novo (a vigência deriva do
          plano). {ciclos} ciclo{ciclos === 1 ? "" : "s"} no histórico.
        </p>
      </div>

      {erro && <p className="text-red-400 text-xs">{erro}</p>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-white font-medium">{children}</dd>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Recarga de créditos — só renderizada pra super-admin ACID (a própria função
// recarga_creditos trava em is_acid_admin() no banco, isto aqui é UX). Credita
// volume no tenant atual. Billing real (cartão/débito/transferência) é Fase 4;
// por ora o ACID lança o volume à mão conforme o contrato fechado.
export default function RecargaForm({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [qtd, setQtd] = useState("");
  const [motivo, setMotivo] = useState<"recarga" | "ajuste">("recarga");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const n = parseInt(qtd, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setErro("Quantidade deve ser um inteiro positivo.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.rpc("recarga_creditos", {
      p_tenant: tenantId,
      p_qtd: n,
      p_motivo: motivo,
    });
    setLoading(false);
    if (error) {
      setErro(error.message);
      return;
    }
    setQtd("");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1">
        <span className="kicker text-muted-2">Recarga ACID</span>
        <p className="text-muted text-xs leading-relaxed">
          Lança volume de créditos neste tenant. Uso interno da ACID conforme o
          contrato. Cobrança automática (cartão / débito mensal / transferência)
          entra na Fase 4.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-muted text-[11px] uppercase tracking-wide">
            Quantidade
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
            placeholder="ex. 500"
            className="rounded-xl bg-surface-2 border border-border px-3 py-2 text-white text-sm tabular-nums outline-none focus:border-white/30 transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-muted text-[11px] uppercase tracking-wide">
            Motivo
          </label>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value as "recarga" | "ajuste")}
            className="rounded-xl bg-surface-2 border border-border px-3 py-2 text-white text-sm outline-none focus:border-white/30 transition-colors"
          >
            <option value="recarga">Recarga</option>
            <option value="ajuste">Ajuste</option>
          </select>
        </div>
      </div>

      {erro && <p className="text-red-400 text-xs">{erro}</p>}

      <button
        type="submit"
        disabled={loading}
        className="self-start inline-flex items-center gap-2 rounded-xl bg-purple text-white text-sm font-medium px-4 py-2 hover:bg-purple/90 disabled:opacity-60 transition-colors"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.2} />
        ) : (
          <Plus className="w-4 h-4" strokeWidth={2.4} />
        )}
        Creditar
      </button>
    </form>
  );
}

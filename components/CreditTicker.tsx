"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Resumo = { saldo: number; creditado: number; consumido: number };

// Ticker fixo de consumo de créditos. Visível pra QUALQUER usuário do tenant
// (todos veem quanto têm). Admin: clicável, leva ao extrato. Não-admin: só
// display, sem clique. Resolve o próprio tenant via jwt_tenant_id() na RPC.
export default function CreditTicker({ isAdmin = false }: { isAdmin?: boolean }) {
  const [resumo, setResumo] = useState<Resumo | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("credito_resumo");
      if (!ativo || error) return;
      const row = Array.isArray(data) ? data[0] : data;
      if (row) setResumo(row as Resumo);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  // Nada até carregar (evita flicker/número errado).
  if (!resumo) return null;

  const pctUsado =
    resumo.creditado > 0
      ? Math.min(100, Math.round((resumo.consumido / resumo.creditado) * 100))
      : 0;

  // Cor escala com o consumo: calmo < 70, atenção 70–89, alerta >= 90.
  const tone =
    pctUsado >= 90
      ? "text-red-400"
      : pctUsado >= 70
        ? "text-amber-400"
        : "text-white";

  const label = `${pctUsado}% usado`;
  const title = `${resumo.saldo} de ${resumo.creditado} créditos disponíveis`;

  const inner = (
    <span
      title={title}
      className={`inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/90 backdrop-blur px-3 py-1.5 text-xs font-semibold shadow-elevated ${tone} ${
        isAdmin ? "transition-colors hover:border-white/25" : ""
      }`}
    >
      {/* Pictograma NEUTRO da plataforma (Acid Fabric) — nunca o logo do tenant,
          que é white-label. Herda a cor do tom (fica no alerta junto do número). */}
      <LayoutGrid className="w-3.5 h-3.5 shrink-0 opacity-70" strokeWidth={2.2} />
      <span className="tabular-nums">{label}</span>
    </span>
  );

  const positionClasses =
    "fixed z-50 bottom-4 right-4 md:bottom-auto md:top-4 md:right-6 print:hidden";

  if (isAdmin) {
    return (
      <Link
        href="/dashboard/admin/creditos"
        aria-label={`Créditos: ${label}. Ver extrato.`}
        className={positionClasses}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div aria-label={`Créditos: ${label}`} className={positionClasses}>
      {inner}
    </div>
  );
}

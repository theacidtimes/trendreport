"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutGrid, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Resumo = { saldo: number; creditado: number; consumido: number };

// Ticker fixo de consumo de créditos. Visível pra QUALQUER usuário do tenant
// (todos veem quanto têm). Admin: clicável, leva ao extrato. Não-admin: só
// display, sem clique. Resolve o próprio tenant via jwt_tenant_id() na RPC.
// A partir de 20% restante (Fase 3B) aparece um aviso de recarga perto do ticker.
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
  const pctRestante = 100 - pctUsado;

  const esgotado = resumo.saldo <= 0;
  // Aviso a partir de 20% restante (só faz sentido se já houve recarga).
  const baixo = resumo.creditado > 0 && pctRestante <= 20;

  // Cor: esgotado = alerta; acabando = atenção; senão neutro.
  const tone = esgotado
    ? "text-red-400"
    : baixo
      ? "text-amber-400"
      : "text-white";

  const label = esgotado ? "Sem créditos" : `${pctUsado}% usado`;
  const title = `${resumo.saldo} de ${resumo.creditado} créditos disponíveis`;

  const aviso = esgotado
    ? "Sem créditos. Recarregue ou fale com o admin."
    : `Créditos acabando (${pctRestante}% restante). Recarregue ou fale com o admin.`;

  const pill = (
    <span
      title={title}
      className={`inline-flex items-center gap-2 rounded-full border bg-surface-2/90 backdrop-blur px-3 py-1.5 text-xs font-semibold shadow-elevated ${tone} ${
        esgotado
          ? "border-red-400/40"
          : baixo
            ? "border-amber-400/40"
            : "border-border"
      } ${isAdmin ? "transition-colors hover:border-white/25" : ""}`}
    >
      {/* Pictograma NEUTRO da plataforma (Acid Fabric) — nunca o logo do tenant,
          que é white-label. Herda a cor do tom (fica no alerta junto do número). */}
      <LayoutGrid className="w-3.5 h-3.5 shrink-0 opacity-70" strokeWidth={2.2} />
      <span className="tabular-nums">{label}</span>
    </span>
  );

  // Caption de aviso perto do ticker, só quando acabando/esgotado.
  const caption =
    esgotado || baixo ? (
      <span
        className={`inline-flex items-center gap-1.5 max-w-[15rem] rounded-lg border px-2.5 py-1.5 text-[11px] leading-tight bg-surface-2/90 backdrop-blur shadow-elevated ${
          esgotado
            ? "border-red-400/40 text-red-300"
            : "border-amber-400/40 text-amber-200"
        }`}
      >
        <AlertTriangle className="w-3 h-3 shrink-0" strokeWidth={2.2} />
        {aviso}
      </span>
    ) : null;

  const positionClasses =
    "fixed z-50 bottom-4 right-4 md:bottom-auto md:top-4 md:right-6 print:hidden flex flex-col items-end gap-1.5";

  const ariaLabel = `Créditos: ${label}.${esgotado || baixo ? ` ${aviso}` : ""}${
    isAdmin ? " Ver extrato." : ""
  }`;

  if (isAdmin) {
    return (
      <Link href="/dashboard/admin/creditos" aria-label={ariaLabel} className={positionClasses}>
        {pill}
        {caption}
      </Link>
    );
  }

  return (
    <div aria-label={ariaLabel} className={positionClasses}>
      {pill}
      {caption}
    </div>
  );
}

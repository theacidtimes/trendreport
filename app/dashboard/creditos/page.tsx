import { redirect } from "next/navigation";
import { Coins, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { checkIsAdmin, checkIsAcidAdmin } from "@/lib/admin";
import Sidebar from "@/components/Sidebar";
import RecargaForm from "@/components/creditos/RecargaForm";
import type { CreditoLedger, Tenant } from "@/lib/types";

const MOTIVO_LABEL: Record<CreditoLedger["motivo"], string> = {
  report: "Report gerado",
  radar_run: "Varredura de radar",
  recarga: "Recarga",
  ajuste: "Ajuste",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function CreditosPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [isAdmin, isAcidAdmin] = await Promise.all([
    checkIsAdmin(supabase),
    checkIsAcidAdmin(supabase),
  ]);

  // Resolve o tenant do usuário via a própria associação (self-read na policy).
  const { data: tu } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const tenantId = tu?.tenant_id as string | undefined;

  // Saldo (cache em tenants) + extrato (RLS já escopa ao tenant do usuário).
  const { data: tenantRow } = tenantId
    ? await supabase
        .from("tenants")
        .select("id, nome, saldo_creditos")
        .eq("id", tenantId)
        .maybeSingle()
    : { data: null };
  const tenant = tenantRow as Pick<Tenant, "id" | "nome" | "saldo_creditos"> | null;

  const { data: ledgerData } = tenantId
    ? await supabase
        .from("creditos_ledger")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };
  const ledger = (ledgerData ?? []) as CreditoLedger[];

  const consumidos = ledger
    .filter((l) => l.delta < 0)
    .reduce((s, l) => s + Math.abs(l.delta), 0);

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user?.email} isAdmin={isAdmin} />

      <main className="md:pl-20">
        <div className="max-w-4xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2 kicker text-muted-2">
              <Coins className="w-3.5 h-3.5 text-lime shrink-0" strokeWidth={2.5} />
              Consumo e volume
            </span>
            <h1 className="font-serif text-white font-medium text-3xl md:text-4xl leading-tight">
              Créditos
            </h1>
            <p className="text-muted text-sm max-w-2xl leading-relaxed">
              Cada unidade de trabalho consome 1 crédito: um report gerado ou
              uma varredura de radar por marca. Aqui está o saldo do tenant e o
              extrato de cada lançamento.
            </p>
          </div>

          {/* Cartões de resumo */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-1 shadow-card">
              <span className="text-white text-3xl font-bold tabular-nums">
                {tenant?.saldo_creditos ?? 0}
              </span>
              <span className="text-muted text-[11px] uppercase tracking-wide">
                Saldo atual
              </span>
            </div>
            <div className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-1 shadow-card">
              <span className="text-white text-3xl font-bold tabular-nums">
                {consumidos}
              </span>
              <span className="text-muted text-[11px] uppercase tracking-wide">
                Consumidos (100 últimos)
              </span>
            </div>
            <div className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-1 shadow-card">
              <span className="text-white text-3xl font-bold tabular-nums">
                {ledger.length}
              </span>
              <span className="text-muted text-[11px] uppercase tracking-wide">
                Lançamentos
              </span>
            </div>
          </section>

          {isAcidAdmin && tenantId && <RecargaForm tenantId={tenantId} />}

          {/* Extrato */}
          <section className="flex flex-col gap-3">
            <h2 className="kicker text-muted-2">Extrato</h2>
            {ledger.length === 0 ? (
              <div className="rounded-3xl bg-surface border border-border p-10 text-center text-muted text-sm">
                Nenhum lançamento ainda.
              </div>
            ) : (
              <ul className="flex flex-col rounded-3xl bg-surface border border-border overflow-hidden divide-y divide-border">
                {ledger.map((l) => {
                  const isDebit = l.delta < 0;
                  return (
                    <li
                      key={l.id}
                      className="flex items-center gap-4 px-5 py-3.5"
                    >
                      <span
                        className={`grid place-items-center w-8 h-8 rounded-full shrink-0 ${
                          isDebit
                            ? "bg-red-500/10 text-red-400"
                            : "bg-lime/10 text-lime"
                        }`}
                      >
                        {isDebit ? (
                          <ArrowDownRight className="w-4 h-4" strokeWidth={2.4} />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" strokeWidth={2.4} />
                        )}
                      </span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-white text-sm font-medium truncate">
                          {MOTIVO_LABEL[l.motivo]}
                        </span>
                        <span className="text-muted text-xs">
                          {formatDateTime(l.created_at)}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-bold tabular-nums shrink-0 ${
                          isDebit ? "text-red-400" : "text-lime"
                        }`}
                      >
                        {isDebit ? "" : "+"}
                        {l.delta}
                      </span>
                      <span className="text-muted text-xs tabular-nums shrink-0 w-16 text-right">
                        {l.saldo_after}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

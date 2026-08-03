import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { checkIsAcidAdmin } from "@/lib/admin";
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

  // A rota já é protegida pelo admin/layout (checkIsAdmin). Aqui só resolvemos
  // o tenant do usuário e checamos o super-admin ACID (pra liberar a recarga).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAcidAdmin = await checkIsAcidAdmin(supabase);

  // Resolve o tenant do usuário via a própria associação (self-read na policy).
  const { data: tu } = user
    ? await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
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

  // Consumo REAL dos últimos 30 dias, direto do banco. Antes esta tela somava
  // os débitos das 100 últimas linhas do extrato e chamava de "consumidos" —
  // um número que dizia mais sobre o limite da query do que sobre o consumo:
  // ao passar de 100 lançamentos ele congelava e passava a mentir pra baixo.
  const { data: usoData } = await supabase.rpc("meus_custos", { p_dias: 30 });
  const uso = (Array.isArray(usoData) ? usoData[0] : null) as {
    varreduras: number;
    reports: number;
    creditos_gastos: number;
    sinais_captados: number;
    drops_gerados: number;
    saldo_creditos: number;
  } | null;

  const saldo = tenant?.saldo_creditos ?? 0;
  const gastos30d = uso?.creditos_gastos ?? 0;
  // Autonomia no ritmo atual. Só faz sentido se houve consumo na janela.
  const diasRestantes =
    gastos30d > 0 ? Math.floor(saldo / (gastos30d / 30)) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="kicker text-muted-2">Consumo e volume</span>
        <h1 className="font-serif text-white font-medium text-3xl md:text-4xl leading-tight">
          Créditos
        </h1>
        <p className="text-muted text-sm max-w-2xl leading-relaxed">
          Cada unidade de trabalho consome 1 crédito: um report gerado ou uma
          varredura de radar por marca. Aqui está o saldo do tenant e o extrato
          de cada lançamento.
        </p>
      </div>

      {/* Cartões de resumo */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card
          value={saldo}
          label="Saldo atual"
          tone={saldo <= 0 ? "critico" : "neutral"}
        />
        <Card value={gastos30d} label="Consumidos · 30d" />
        <Card
          value={
            diasRestantes === null
              ? "—"
              : diasRestantes > 365
                ? "365+"
                : `${diasRestantes}d`
          }
          label="Autonomia no ritmo atual"
          tone={
            diasRestantes !== null && diasRestantes <= 15 ? "critico" : "neutral"
          }
        />
        <Card value={ledger.length} label="Lançamentos" />
      </section>

      {/* O que os créditos viraram. Crédito é abstrato; entrega não é —
          esta faixa é o que torna a contagem "realista" pro cliente. */}
      {uso && (
        <section className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-3 shadow-card">
          <span className="kicker text-muted-2">
            O que isso virou · últimos 30 dias
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Mini value={uso.varreduras} label="varreduras" />
            <Mini value={uso.reports} label="reports" />
            <Mini value={uso.sinais_captados} label="sinais captados" />
            <Mini value={uso.drops_gerados} label="drops gerados" />
          </div>
        </section>
      )}

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
                <li key={l.id} className="flex items-center gap-4 px-5 py-3.5">
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
  );
}

function Card({
  value,
  label,
  tone = "neutral",
}: {
  value: number | string;
  label: string;
  tone?: "neutral" | "critico";
}) {
  return (
    <div className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-1 shadow-card">
      <span
        className={`text-3xl font-bold tabular-nums ${
          tone === "critico" ? "text-red-400" : "text-white"
        }`}
      >
        {value}
      </span>
      <span className="text-muted text-[11px] uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

function Mini({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-white text-xl font-bold tabular-nums">
        {value.toLocaleString("pt-BR")}
      </span>
      <span className="text-muted-2 text-[11px] uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, HelpCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// CUSTO REAL POR TENANT (US$) — a contrapartida financeira da tela de Saúde.
//
// Desde que o cartão corporativo da ACID passou a bancar o plano da Apify, todo
// tenant consome de um bolso só. Crédito continua contando unidade de trabalho;
// esta tela conta DINHEIRO. As duas visões divergem de propósito: uma varredura
// de uma marca com agenda cultural cheia custa o dobro de outra e as duas
// debitam 1 crédito. A diferença entre as duas colunas é a margem.
//
// A linha "NAO ATRIBUIDO" não é bug: é gasto que existe na fatura e que a gente
// ainda não sabe ligar a um tenant (reports usam o endpoint síncrono da Apify,
// que não devolve run id). Preferimos mostrar o buraco a fingir que o total
// fecha. Ver scripts/backfill-custos.ts.

export const dynamic = "force-dynamic";

interface CustoRow {
  tenant_id: string | null;
  nome: string;
  custo_apify: number;
  custo_anthropic: number;
  custo_total: number;
  varreduras: number;
  reports: number;
  creditos_gastos: number;
  custo_por_credito: number | null;
  saldo_creditos: number;
}

interface DetalheRow {
  tenant_nome: string;
  marca_nome: string;
  origem: string;
  provedor: string;
  detalhe: string;
  eventos: number;
  custo_usd: number;
}

const PERIODOS = [7, 30, 60, 90];

const usd = (n: number) =>
  `$${Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default async function CustosPage({
  searchParams,
}: {
  searchParams: { dias?: string };
}) {
  const dias = PERIODOS.includes(Number(searchParams.dias))
    ? Number(searchParams.dias)
    : 30;

  const supabase = createClient();
  const [{ data: custosData }, { data: detalheData }] = await Promise.all([
    supabase.rpc("acid_custos_tenants", { p_dias: dias }),
    supabase.rpc("acid_custos_detalhe", { p_dias: dias }),
  ]);

  const rows = ((custosData ?? []) as CustoRow[])
    .map((r) => ({
      ...r,
      custo_apify: Number(r.custo_apify),
      custo_anthropic: Number(r.custo_anthropic),
      custo_total: Number(r.custo_total),
      custo_por_credito:
        r.custo_por_credito === null ? null : Number(r.custo_por_credito),
    }))
    .sort((a, b) => b.custo_total - a.custo_total);

  const detalhe = ((detalheData ?? []) as DetalheRow[])
    .map((d) => ({ ...d, custo_usd: Number(d.custo_usd) }))
    .slice(0, 15);

  const total = rows.reduce((s, r) => s + r.custo_total, 0);
  const naoAtribuido = rows
    .filter((r) => !r.tenant_id)
    .reduce((s, r) => s + r.custo_total, 0);
  // Projeção mensal simples a partir da janela escolhida. É estimativa: serve
  // pra dimensionar o plano, não pra fechar contabilidade.
  const projecaoMes = (total / dias) * 30;

  // PASSIVO EM CRÉDITO: crédito vendido/creditado e ainda não queimado é conta
  // que a ACID vai pagar depois, ao preço de custo daquele tenant. Não aparece
  // em lugar nenhum da contabilidade hoje e é o número que estoura o plano da
  // Apify quando vários clientes resolvem consumir no mesmo mês.
  const passivo = rows.reduce(
    (s, r) =>
      s + (r.custo_por_credito ? r.saldo_creditos * r.custo_por_credito : 0),
    0
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="kicker text-purple">Console Acid Fabric</span>
        <h1 className="font-serif text-white font-medium text-3xl md:text-4xl leading-tight">
          Custos
        </h1>
        <p className="text-muted text-sm max-w-2xl leading-relaxed">
          Quanto cada tenant custa de verdade no cartão da ACID. Crédito conta
          unidade de trabalho; aqui conta dólar. A diferença entre os dois é a
          sua margem.
        </p>
      </header>

      {/* Período */}
      <nav className="flex items-center gap-2">
        {PERIODOS.map((d) => (
          <Link
            key={d}
            href={`/console/custos?dias=${d}`}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              d === dias
                ? "border-purple/40 bg-purple/15 text-purple"
                : "border-border bg-surface text-muted hover:text-white"
            }`}
          >
            {d} dias
          </Link>
        ))}
      </nav>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStat value={usd(total)} label={`Gasto em ${dias} dias`} />
        <SummaryStat value={usd(projecaoMes)} label="Projeção / mês" />
        <SummaryStat
          value={usd(naoAtribuido)}
          label="Não atribuído"
          tone={naoAtribuido > total * 0.15 ? "alerta" : "neutral"}
        />
        <SummaryStat
          value={usd(passivo)}
          label="Passivo em crédito"
          tone={passivo > projecaoMes ? "alerta" : "neutral"}
        />
      </section>

      {/* Por tenant */}
      <section className="flex flex-col gap-3">
        <h2 className="kicker text-muted-2">Por tenant</h2>
        {rows.length === 0 ? (
          <Vazio texto="Sem custo registrado nesta janela." />
        ) : (
          <div className="rounded-3xl bg-surface border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="text-muted-2 text-[11px] uppercase tracking-wide border-b border-border">
                  <Th className="text-left">Tenant</Th>
                  <Th>Apify</Th>
                  <Th>LLM</Th>
                  <Th>Total</Th>
                  <Th>Varred.</Th>
                  <Th>Reports</Th>
                  <Th>US$/créd.</Th>
                  <Th>Saldo</Th>
                  <Th>Saldo vale</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const orfao = !r.tenant_id;
                  return (
                    <tr
                      key={r.tenant_id ?? "orfao"}
                      className="hover:bg-surface-2/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        {orfao ? (
                          <span className="flex items-center gap-1.5 text-amber-400 text-xs font-medium">
                            <HelpCircle className="w-3.5 h-3.5" strokeWidth={2.2} />
                            Não atribuído
                          </span>
                        ) : (
                          <Link
                            href={`/console/tenants/${r.tenant_id}`}
                            className="group flex items-center gap-1.5 text-white font-medium hover:text-purple transition-colors"
                          >
                            {r.nome}
                            <ArrowUpRight
                              className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              strokeWidth={2.2}
                            />
                          </Link>
                        )}
                      </td>
                      <Td>{usd(r.custo_apify)}</Td>
                      <Td>{usd(r.custo_anthropic)}</Td>
                      <Td className="text-white font-semibold">
                        {usd(r.custo_total)}
                      </Td>
                      <Td>{orfao ? "—" : r.varreduras}</Td>
                      <Td>{orfao ? "—" : r.reports}</Td>
                      <Td>
                        {r.custo_por_credito === null
                          ? "—"
                          : usd(r.custo_por_credito)}
                      </Td>
                      <Td
                        className={
                          !orfao && r.saldo_creditos <= 0 ? "text-red-400" : ""
                        }
                      >
                        {orfao ? "—" : r.saldo_creditos}
                      </Td>
                      <Td className="text-amber-400/90">
                        {orfao || r.custo_por_credito === null
                          ? "—"
                          : usd(r.saldo_creditos * r.custo_por_credito)}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-muted-2 text-xs leading-relaxed max-w-2xl">
          <strong className="text-muted">US$/créd.</strong> é o custo real médio
          de cada crédito queimado por aquele tenant na janela. É o número pra
          precificar o crédito — se ele passar do que você cobra, o cliente está
          sendo subsidiado.{" "}
          <strong className="text-muted">Saldo vale</strong> é o que os créditos
          parados vão custar à ACID quando forem queimados: conta já contratada,
          ainda não paga.
        </p>
      </section>

      {/* Onde o dinheiro vai */}
      <section className="flex flex-col gap-3">
        <h2 className="kicker text-muted-2">Onde o dinheiro vai · top 15</h2>
        {detalhe.length === 0 ? (
          <Vazio texto="Sem detalhe nesta janela." />
        ) : (
          <div className="rounded-3xl bg-surface border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-muted-2 text-[11px] uppercase tracking-wide border-b border-border">
                  <Th className="text-left">Tenant</Th>
                  <Th className="text-left">Marca</Th>
                  <Th className="text-left">Origem</Th>
                  <Th className="text-left">Fonte / modelo</Th>
                  <Th>Eventos</Th>
                  <Th>US$</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detalhe.map((d, i) => (
                  <tr
                    key={i}
                    className="hover:bg-surface-2/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-white text-xs truncate">
                      {d.tenant_nome}
                    </td>
                    <td className="px-4 py-3 text-muted text-xs truncate">
                      {d.marca_nome}
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">{d.origem}</td>
                    <td className="px-4 py-3 text-muted text-xs">{d.detalhe}</td>
                    <Td>{d.eventos}</Td>
                    <Td className="text-white font-semibold">
                      {usd(d.custo_usd)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {naoAtribuido > 0 && (
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 flex gap-3">
          <AlertTriangle
            className="w-5 h-5 text-amber-400 shrink-0 mt-0.5"
            strokeWidth={2.2}
          />
          <div className="text-sm text-amber-100/90 leading-relaxed">
            <strong className="text-amber-400">
              {usd(naoAtribuido)} sem dono.
            </strong>{" "}
            Gasto real na fatura da Apify que não dá pra ligar a um tenant: a
            geração de report usa o endpoint síncrono, que não devolve run id.
            Enquanto isso não mudar, esse valor é rateio — não custo de cliente.
          </div>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`px-4 py-3 font-medium text-right ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-4 py-3 text-right tabular-nums text-muted ${className}`}>
      {children}
    </td>
  );
}

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="rounded-3xl bg-surface border border-border p-8 text-center text-muted text-sm">
      {texto}
    </div>
  );
}

function SummaryStat({
  value,
  label,
  tone = "neutral",
}: {
  value: number | string;
  label: string;
  tone?: "neutral" | "alerta";
}) {
  return (
    <div className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-1 shadow-card">
      <span
        className={`text-2xl font-bold tabular-nums ${
          tone === "alerta" ? "text-amber-400" : "text-white"
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

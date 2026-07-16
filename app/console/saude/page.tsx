import Link from "next/link";
import {
  ArrowUpRight,
  Circle,
  AlertTriangle,
  Radar,
  CalendarClock,
  CreditCard,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

// Dashboard de saúde cross-tenant da ACID: lê a agregação única (acid_saude_tenants,
// gated is_acid_admin) e deriva os ALERTAS operacionais em TS. Sinais que a ACID
// precisa vigiar de longe: conta inativa, sem créditos (não gera nada), assinatura
// vencida/vencendo e radar parado (paga radar mas não roda). Read-only; ações ficam
// no drill-in de cada tenant.

interface SaudeRow {
  tenant_id: string;
  nome: string;
  tipo: string;
  status: string;
  saldo_creditos: number;
  seats: number;
  usuarios: number;
  marcas_total: number;
  marcas_ativas: number;
  ultima_run: string | null;
  runs_7d: number;
  drops_7d: number;
  assinatura_status: string | null;
  assinatura_fim: string | null;
  assinatura_plano: string | null;
}

type Severidade = "critico" | "alerta";
interface Alerta {
  chave: string;
  label: string;
  sev: Severidade;
}

const STATUS_TONE: Record<string, string> = {
  ativo: "fill-lime text-lime",
  suspenso: "fill-amber-400 text-amber-400",
  cancelado: "fill-muted/40 text-muted/40",
};

const DIA_MS = 86_400_000;

function diasAte(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const alvo = new Date(dateStr + "T00:00:00");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / DIA_MS);
}

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DIA_MS);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatRun(iso: string | null): string {
  if (!iso) return "nunca";
  const d = diasDesde(iso);
  if (d === null) return "—";
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

// Deriva os alertas de um tenant. Ordem = prioridade visual.
function alertasDe(t: SaudeRow): Alerta[] {
  const out: Alerta[] = [];
  if (t.status === "cancelado")
    out.push({ chave: "cancelado", label: "Cancelado", sev: "critico" });
  else if (t.status === "suspenso")
    out.push({ chave: "suspenso", label: "Suspenso", sev: "critico" });

  if (t.saldo_creditos <= 0)
    out.push({ chave: "sem_creditos", label: "Sem créditos", sev: "critico" });

  const dFim = diasAte(t.assinatura_fim);
  const assinaturaExpirada =
    !t.assinatura_status ||
    t.assinatura_status === "expirada" ||
    t.assinatura_status === "cancelada" ||
    (dFim !== null && dFim < 0);
  if (assinaturaExpirada)
    out.push({
      chave: "assinatura_vencida",
      label: "Assinatura vencida",
      sev: "critico",
    });
  else if (dFim !== null && dFim <= 30)
    out.push({
      chave: "assinatura_vencendo",
      label: `Vence em ${dFim}d`,
      sev: "alerta",
    });

  // Paga radar (tem marca ativa) mas não rodou na última semana.
  if (t.marcas_ativas > 0 && t.runs_7d === 0)
    out.push({ chave: "radar_parado", label: "Radar parado", sev: "critico" });

  // Onboarded mas sem nenhuma marca cadastrada.
  if (t.marcas_total === 0)
    out.push({ chave: "sem_marcas", label: "Sem marcas", sev: "alerta" });

  return out;
}

export default async function SaudePage() {
  const supabase = createClient();
  const { data } = await supabase.rpc("acid_saude_tenants");
  const rows = (data ?? []) as SaudeRow[];

  const comAlertas = rows
    .map((t) => ({ t, alertas: alertasDe(t) }))
    .filter((x) => x.alertas.length > 0)
    .sort((a, b) => {
      const crit = (x: Alerta[]) => x.filter((a) => a.sev === "critico").length;
      return crit(b.alertas) - crit(a.alertas) || b.alertas.length - a.alertas.length;
    });

  const nCriticos = rows.filter((t) =>
    alertasDe(t).some((a) => a.sev === "critico")
  ).length;
  const nVencendo = rows.filter((t) => {
    const d = diasAte(t.assinatura_fim);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const nRadarParado = rows.filter(
    (t) => t.marcas_ativas > 0 && t.runs_7d === 0
  ).length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="kicker text-purple">Console Acid Fabric</span>
        <h1 className="font-serif text-white font-medium text-3xl md:text-4xl leading-tight">
          Saúde
        </h1>
        <p className="text-muted text-sm max-w-2xl leading-relaxed">
          O pulso do ecossistema: quem precisa de atenção agora. Contas inativas,
          sem créditos, assinatura vencendo ou radar parado.
        </p>
      </header>

      {/* Resumo topo */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStat value={rows.length} label="Tenants" tone="neutral" />
        <SummaryStat value={nCriticos} label="Com alerta crítico" tone="critico" />
        <SummaryStat value={nVencendo} label="Assinatura ≤ 30d" tone="alerta" />
        <SummaryStat value={nRadarParado} label="Radar parado" tone="critico" />
      </section>

      {/* Precisam de atenção */}
      <section className="flex flex-col gap-3">
        <h2 className="kicker text-muted-2">Precisam de atenção</h2>
        {comAlertas.length === 0 ? (
          <div className="rounded-3xl bg-surface border border-border p-8 flex items-center justify-center gap-2.5 text-muted text-sm">
            <ShieldCheck className="w-5 h-5 text-lime" strokeWidth={2} />
            Tudo em ordem. Nenhum tenant com alertas.
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {comAlertas.map(({ t, alertas }) => (
              <li key={t.tenant_id}>
                <Link
                  href={`/console/tenants/${t.tenant_id}`}
                  className="group flex flex-col gap-3 rounded-3xl bg-surface border border-border hover:border-white/20 p-5 transition-colors h-full shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex items-center gap-2 text-white text-base font-bold truncate">
                      <Circle
                        className={`w-2 h-2 shrink-0 ${
                          STATUS_TONE[t.status] ?? "fill-muted/40 text-muted/40"
                        }`}
                      />
                      {t.nome}
                    </span>
                    <ArrowUpRight
                      className="w-4 h-4 shrink-0 text-muted group-hover:text-white transition-colors"
                      strokeWidth={2.2}
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {alertas.map((a) => (
                      <AlertChip key={a.chave} alerta={a} />
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-auto pt-3 border-t border-border">
                    <Stat value={t.saldo_creditos} label="créditos" />
                    <Stat value={`${t.usuarios}/${t.seats}`} label="seats" />
                    <Stat
                      value={`${t.marcas_ativas}/${t.marcas_total}`}
                      label="marcas on"
                    />
                    <Stat value={t.drops_7d} label="drops 7d" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Todos os tenants — visão compacta */}
      <section className="flex flex-col gap-3">
        <h2 className="kicker text-muted-2">Todos os tenants · {rows.length}</h2>
        {rows.length === 0 ? (
          <div className="rounded-3xl bg-surface border border-border p-8 text-center text-muted text-sm">
            Nenhum tenant provisionado ainda.
          </div>
        ) : (
          <div className="rounded-3xl bg-surface border border-border overflow-hidden">
            <ul className="divide-y divide-border">
              {rows.map((t) => {
                const parado = t.marcas_ativas > 0 && t.runs_7d === 0;
                return (
                  <li key={t.tenant_id}>
                    <Link
                      href={`/console/tenants/${t.tenant_id}`}
                      className="grid grid-cols-2 sm:grid-cols-6 items-center gap-3 px-5 py-3.5 hover:bg-surface-2/40 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-white text-sm font-medium truncate sm:col-span-2">
                        <Circle
                          className={`w-2 h-2 shrink-0 ${
                            STATUS_TONE[t.status] ?? "fill-muted/40 text-muted/40"
                          }`}
                        />
                        {t.nome}
                      </span>
                      <MiniCol
                        icon={CreditCard}
                        value={String(t.saldo_creditos)}
                        alerta={t.saldo_creditos <= 0}
                      />
                      <MiniCol
                        icon={Radar}
                        value={formatRun(t.ultima_run)}
                        alerta={parado}
                      />
                      <MiniCol
                        icon={CalendarClock}
                        value={formatDate(t.assinatura_fim)}
                        alerta={(() => {
                          const d = diasAte(t.assinatura_fim);
                          return d === null || d < 0 || d <= 30;
                        })()}
                      />
                      <span className="hidden sm:block text-muted-2 text-xs tabular-nums text-right">
                        {t.drops_7d} drops · {t.runs_7d} runs
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function AlertChip({ alerta }: { alerta: Alerta }) {
  const critico = alerta.sev === "critico";
  const Icon = critico ? AlertTriangle : CalendarClock;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        critico
          ? "border-red-500/30 bg-red-500/10 text-red-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-400"
      }`}
    >
      <Icon className="w-3 h-3 shrink-0" strokeWidth={2.2} />
      {alerta.label}
    </span>
  );
}

function MiniCol({
  icon: Icon,
  value,
  alerta,
}: {
  icon: typeof Radar;
  value: string;
  alerta?: boolean;
}) {
  return (
    <span
      className={`flex items-center gap-1.5 text-xs tabular-nums truncate ${
        alerta ? "text-amber-400" : "text-muted"
      }`}
    >
      <Icon
        className={`w-3.5 h-3.5 shrink-0 ${alerta ? "text-amber-400" : "text-muted-2"}`}
        strokeWidth={2}
      />
      {value}
    </span>
  );
}

const TONE_CLASS: Record<string, string> = {
  neutral: "text-white",
  critico: "text-red-400",
  alerta: "text-amber-400",
};

function SummaryStat({
  value,
  label,
  tone = "neutral",
}: {
  value: number | string;
  label: string;
  tone?: "neutral" | "critico" | "alerta";
}) {
  const strong = tone !== "neutral" && Number(value) > 0;
  return (
    <div className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-1 shadow-card">
      <span
        className={`text-3xl font-bold tabular-nums ${
          strong ? TONE_CLASS[tone] : "text-white"
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

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-white text-base font-bold tabular-nums">{value}</span>
      <span className="text-muted text-[10px] uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

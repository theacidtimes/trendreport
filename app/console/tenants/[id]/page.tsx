import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Circle,
  Check,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type {
  Tenant,
  TenantModulo,
  Assinatura,
  Marca,
  CreditoLedger,
  ModuloNome,
} from "@/lib/types";

const TIPO_LABEL: Record<string, string> = {
  studio: "Estúdio",
  agency: "Agência",
  holding: "Holding",
  company: "Empresa",
};

const STATUS_TONE: Record<string, string> = {
  ativo: "fill-lime text-lime",
  suspenso: "fill-amber-400 text-amber-400",
  cancelado: "fill-muted/40 text-muted/40",
};

const MODULO_LABEL: Record<ModuloNome, string> = {
  radar: "Radar",
  reports: "Reports",
  dados_semanticos: "Dados semânticos",
};

const MODULOS_TODOS: ModuloNome[] = ["radar", "reports", "dados_semanticos"];

const PLANO_LABEL: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admins",
  editor: "Editores",
  viewer: "Viewers",
};

const MOTIVO_LABEL: Record<CreditoLedger["motivo"], string> = {
  report: "Report gerado",
  radar_run: "Varredura de radar",
  recarga: "Recarga",
  ajuste: "Ajuste",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function TenantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { id } = params;

  // is_acid_admin bypassa RLS — leitura cross-tenant. Tudo em paralelo.
  const [
    { data: tenantRow },
    { data: modulosRow },
    { data: assinaturasRow },
    { data: marcasRow },
    { data: usuariosRow },
    { data: ledgerRow },
  ] = await Promise.all([
    supabase.from("tenants").select("*").eq("id", id).maybeSingle(),
    supabase.from("tenant_modulos").select("*").eq("tenant_id", id),
    supabase
      .from("assinaturas")
      .select("*")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("marcas")
      .select("id, nome, yaml_conhecimento, status_varredura")
      .eq("tenant_id", id),
    supabase.from("tenant_users").select("role").eq("tenant_id", id),
    supabase
      .from("creditos_ledger")
      .select("*")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const tenant = tenantRow as Tenant | null;
  if (!tenant) notFound();

  const modulos = (modulosRow ?? []) as TenantModulo[];
  const assinaturas = (assinaturasRow ?? []) as Assinatura[];
  const marcas = (marcasRow ?? []) as Pick<
    Marca,
    "id" | "nome" | "yaml_conhecimento" | "status_varredura"
  >[];
  const usuarios = (usuariosRow ?? []) as { role: string }[];
  const ledger = (ledgerRow ?? []) as CreditoLedger[];

  const assinaturaAtual = assinaturas[0] ?? null;
  const roleCounts = usuarios.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});
  const moduloAtivo = (m: ModuloNome) =>
    modulos.find((x) => x.modulo === m)?.ativo ?? false;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/console"
          className="inline-flex items-center gap-1.5 text-muted hover:text-white transition-colors text-sm w-fit"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Tenants
        </Link>
        <header className="flex flex-col gap-2">
          <span className="kicker text-purple">Console Acid Fabric</span>
          <h1 className="flex items-center gap-3 font-serif text-white font-medium text-3xl md:text-4xl leading-tight">
            <Circle
              className={`w-3 h-3 shrink-0 ${
                STATUS_TONE[tenant.status] ?? "fill-muted/40 text-muted/40"
              }`}
            />
            {tenant.nome}
          </h1>
          <p className="text-muted text-sm">
            {TIPO_LABEL[tenant.tipo] ?? tenant.tipo} · {tenant.status} · desde{" "}
            {formatDate(tenant.created_at)}
            {tenant.cnpj ? ` · CNPJ ${tenant.cnpj}` : ""}
          </p>
        </header>
      </div>

      {/* Resumo */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryStat value={tenant.saldo_creditos} label="Créditos" />
        <SummaryStat
          value={`${usuarios.length}/${tenant.seats}`}
          label="Seats usados"
        />
        <SummaryStat value={marcas.length} label="Marcas" />
        <SummaryStat
          value={modulos.filter((m) => m.ativo).length}
          label="Módulos ativos"
        />
      </section>

      {/* Assinatura + Módulos */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-4 shadow-card">
          <h2 className="kicker text-muted-2">Assinatura</h2>
          {assinaturaAtual ? (
            <dl className="flex flex-col gap-2.5 text-sm">
              <Row label="Plano">
                {PLANO_LABEL[assinaturaAtual.plano_tipo] ??
                  assinaturaAtual.plano_tipo}
              </Row>
              <Row label="Status">{assinaturaAtual.status}</Row>
              <Row label="Início">
                {formatDate(assinaturaAtual.data_inicio)}
              </Row>
              <Row label="Vigente até">
                {formatDate(assinaturaAtual.data_fim)}
              </Row>
              <Row label="Renovação automática">
                {assinaturaAtual.auto_renovacao ? "Sim" : "Não"}
              </Row>
            </dl>
          ) : (
            <p className="text-muted text-sm">Nenhuma assinatura registrada.</p>
          )}
          {assinaturas.length > 1 && (
            <p className="text-muted-2 text-[11px] pt-2 border-t border-border">
              {assinaturas.length} ciclos no histórico.
            </p>
          )}
        </div>

        <div className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-4 shadow-card">
          <h2 className="kicker text-muted-2">Módulos</h2>
          <ul className="flex flex-col gap-2">
            {MODULOS_TODOS.map((m) => {
              const ativo = moduloAtivo(m);
              return (
                <li
                  key={m}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className={ativo ? "text-white" : "text-muted-2"}>
                    {MODULO_LABEL[m]}
                  </span>
                  <span
                    className={`grid place-items-center w-6 h-6 rounded-full shrink-0 ${
                      ativo
                        ? "bg-lime/10 text-lime"
                        : "bg-surface-2 text-muted-2"
                    }`}
                  >
                    {ativo ? (
                      <Check className="w-3.5 h-3.5" strokeWidth={2.6} />
                    ) : (
                      <Minus className="w-3.5 h-3.5" strokeWidth={2.6} />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Usuários por papel */}
      <section className="flex flex-col gap-3">
        <h2 className="kicker text-muted-2">Usuários · {usuarios.length}</h2>
        <div className="grid grid-cols-3 gap-3">
          {(["admin", "editor", "viewer"] as const).map((role) => (
            <SummaryStat
              key={role}
              value={roleCounts[role] ?? 0}
              label={ROLE_LABEL[role]}
            />
          ))}
        </div>
      </section>

      {/* Marcas */}
      <section className="flex flex-col gap-3">
        <h2 className="kicker text-muted-2">Marcas monitoradas · {marcas.length}</h2>
        {marcas.length === 0 ? (
          <div className="rounded-3xl bg-surface border border-border p-8 text-center text-muted text-sm">
            Nenhuma marca cadastrada.
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {marcas.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-3xl bg-surface border border-border p-4 shadow-card"
              >
                <Circle
                  className={`w-2 h-2 shrink-0 ${
                    m.status_varredura
                      ? "fill-lime text-lime"
                      : "fill-muted/40 text-muted/40"
                  }`}
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-white text-sm font-medium truncate">
                    {m.nome}
                  </span>
                  <span className="text-muted text-xs truncate">
                    {m.yaml_conhecimento?.produto || "—"}
                  </span>
                </div>
                <span className="ml-auto text-muted-2 text-[10px] uppercase tracking-wide shrink-0">
                  {m.status_varredura ? "on" : "off"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Extrato de créditos */}
      <section className="flex flex-col gap-3">
        <h2 className="kicker text-muted-2">Últimos lançamentos de crédito</h2>
        {ledger.length === 0 ? (
          <div className="rounded-3xl bg-surface border border-border p-8 text-center text-muted text-sm">
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

function SummaryStat({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  return (
    <div className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-1 shadow-card">
      <span className="text-white text-3xl font-bold tabular-nums">{value}</span>
      <span className="text-muted text-[11px] uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-white font-medium">{children}</dd>
    </div>
  );
}

import Link from "next/link";
import { ArrowUpRight, Circle, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ModuloNome } from "@/lib/types";

// ─── Rótulos ──────────────────────────────────────────────
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
  dados_semanticos: "Dados",
};

const PLANO_LABEL: Record<string, string> = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

// Shape do select com embeds (PostgREST devolve count como [{ count }]).
interface TenantOverview {
  id: string;
  nome: string;
  tipo: string;
  status: string;
  seats: number;
  saldo_creditos: number;
  created_at: string;
  tenant_modulos: { modulo: ModuloNome; ativo: boolean }[];
  assinaturas: {
    plano_tipo: string;
    data_fim: string;
    status: string;
    created_at: string;
  }[];
  tenant_users: { count: number }[];
  marcas: { count: number }[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function ConsolePage() {
  const supabase = createClient();

  // is_acid_admin bypassa RLS: enxerga todos os tenants. Embeds trazem módulos,
  // assinaturas e contagens de uma vez (sem N+1).
  const { data } = await supabase
    .from("tenants")
    .select(
      `id, nome, tipo, status, seats, saldo_creditos, created_at,
       tenant_modulos ( modulo, ativo ),
       assinaturas ( plano_tipo, data_fim, status, created_at ),
       tenant_users ( count ),
       marcas ( count )`
    )
    .order("created_at", { ascending: true });

  const tenants = (data ?? []) as unknown as TenantOverview[];

  const ativos = tenants.filter((t) => t.status === "ativo").length;
  const creditosTotais = tenants.reduce((s, t) => s + (t.saldo_creditos ?? 0), 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="kicker text-purple">Console Acid Fabric</span>
        <h1 className="font-serif text-white font-medium text-3xl md:text-4xl leading-tight">
          Tenants
        </h1>
        <p className="text-muted text-sm max-w-2xl leading-relaxed">
          Visão da ACID sobre todos os tenants licenciados: módulos, assinatura,
          seats e créditos. Somente leitura — provisionar e editar vem em breve.
        </p>
      </header>

      {/* Resumo topo */}
      <section className="grid grid-cols-3 gap-3">
        <SummaryStat value={tenants.length} label="Tenants" />
        <SummaryStat value={ativos} label="Ativos" />
        <SummaryStat value={creditosTotais} label="Créditos no ecossistema" />
      </section>

      {tenants.length === 0 ? (
        <div className="rounded-3xl bg-surface border border-border p-10 text-center text-muted text-sm">
          Nenhum tenant provisionado ainda.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tenants.map((t) => {
            const usuarios = t.tenant_users?.[0]?.count ?? 0;
            const marcas = t.marcas?.[0]?.count ?? 0;
            const modulos = (t.tenant_modulos ?? [])
              .filter((m) => m.ativo)
              .map((m) => m.modulo)
              .sort();
            const assinatura = [...(t.assinaturas ?? [])].sort((a, b) =>
              b.created_at.localeCompare(a.created_at)
            )[0];

            return (
              <li key={t.id}>
                <Link
                  href={`/console/tenants/${t.id}`}
                  className="group flex flex-col gap-4 rounded-3xl bg-surface border border-border hover:border-white/20 p-5 transition-colors h-full shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="flex items-center gap-2 text-white text-lg font-bold truncate">
                        <Circle
                          className={`w-2 h-2 shrink-0 ${
                            STATUS_TONE[t.status] ?? "fill-muted/40 text-muted/40"
                          }`}
                        />
                        {t.nome}
                      </span>
                      <span className="text-muted text-xs">
                        {TIPO_LABEL[t.tipo] ?? t.tipo}
                        {t.status !== "ativo" && ` · ${t.status}`}
                      </span>
                    </div>
                    <ArrowUpRight
                      className="w-4 h-4 shrink-0 text-muted group-hover:text-white transition-colors"
                      strokeWidth={2.2}
                    />
                  </div>

                  {/* Módulos ativos */}
                  <div className="flex flex-wrap gap-1.5">
                    {modulos.length === 0 ? (
                      <span className="text-muted-2 text-[11px]">
                        sem módulos ativos
                      </span>
                    ) : (
                      modulos.map((m) => (
                        <span
                          key={m}
                          className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted"
                        >
                          {MODULO_LABEL[m] ?? m}
                        </span>
                      ))
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-auto">
                    <Stat value={t.saldo_creditos} label="créditos" />
                    <Stat value={`${usuarios}/${t.seats}`} label="seats" />
                    <Stat value={marcas} label="marcas" />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] pt-3 border-t border-border">
                    <span className="flex items-center gap-1.5 text-muted/70">
                      <Building2 className="w-3 h-3 shrink-0" strokeWidth={2} />
                      {assinatura
                        ? `${PLANO_LABEL[assinatura.plano_tipo] ?? assinatura.plano_tipo} · ${assinatura.status}`
                        : "sem assinatura"}
                    </span>
                    {assinatura && (
                      <span className="text-muted-2 tabular-nums">
                        até {formatDate(assinatura.data_fim)}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
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

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-white text-xl font-bold tabular-nums">{value}</span>
      <span className="text-muted text-[10px] uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

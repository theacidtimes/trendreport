import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Circle, Cpu, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getClienteSummary, getDailyMetrics } from "@/lib/radar/metrics";
import MetricChart from "@/components/admin/MetricChart";
import ClienteExport from "@/components/admin/ClienteExport";
import MarcaDialog from "../MarcaDialog";
import type { Marca } from "@/lib/types";

function formatDateTime(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type StatCardProps = {
  label: string;
  total: number;
  d30: number;
  d7: number;
  peak?: number;
};

function StatCard({ label, total, d30, d7, peak }: StatCardProps) {
  return (
    <div className="rounded-2xl bg-surface border border-border p-5 flex flex-col gap-3">
      <span className="text-muted text-xs uppercase tracking-[0.12em] font-medium">
        {label}
      </span>
      <span className="text-white text-3xl font-bold tabular-nums leading-none">
        {total}
      </span>
      <div className="flex items-center gap-4 text-xs tabular-nums">
        <span className="text-muted">
          <span className="text-white font-semibold">{d7}</span> 7d
        </span>
        <span className="text-muted">
          <span className="text-white font-semibold">{d30}</span> 30d
        </span>
        {peak !== undefined && (
          <span className="text-purple-300 ml-auto">pico {peak}</span>
        )}
      </div>
    </div>
  );
}

export default async function ClienteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

  const { data: marcaData } = await supabase
    .from("marcas")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!marcaData) notFound();
  const marca = marcaData as Marca;

  const [summary, daily] = await Promise.all([
    getClienteSummary(supabase, marca.id, marca.nome),
    getDailyMetrics(supabase, marca.id, 30),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/admin/clientes"
          className="inline-flex items-center gap-1.5 text-muted hover:text-white text-xs font-medium transition-colors print:hidden w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.2} />
          Clientes
        </Link>

        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-white text-3xl font-bold tracking-[-0.01em]">
              <Circle
                className={`w-2.5 h-2.5 shrink-0 ${
                  marca.status_varredura
                    ? "fill-lime text-lime"
                    : "fill-muted/40 text-muted/40"
                }`}
              />
              {marca.nome}
            </span>
            <p className="text-muted text-sm">
              {marca.yaml_conhecimento?.produto || "—"}
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <MarcaDialog marca={marca} />
            <ClienteExport nome={marca.nome} summary={summary} daily={daily} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Dados captados"
          total={summary.captados_total}
          d30={summary.captados_30d}
          d7={summary.captados_7d}
          peak={summary.pico_captados}
        />
        <StatCard
          label="Drops gerados"
          total={summary.drops_total}
          d30={summary.drops_30d}
          d7={summary.drops_7d}
        />
        <StatCard
          label="Runs do agente"
          total={summary.runs_total}
          d30={summary.runs_30d}
          d7={summary.runs_7d}
        />
        <StatCard
          label="Relatórios"
          total={summary.reports_total}
          d30={summary.reports_30d}
          d7={summary.reports_7d}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <MetricChart metric="captados" data={daily} />
        <MetricChart metric="drops" data={daily} />
        <MetricChart metric="runs" data={daily} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl bg-surface border border-border p-5 flex flex-col gap-2">
          <span className="flex items-center gap-2 text-muted text-xs uppercase tracking-[0.12em] font-medium">
            <Zap className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
            Cadência
          </span>
          <span className="text-white text-sm tabular-nums">
            a cada {marca.intervalo_horas}h
          </span>
          <span className="text-muted text-xs">
            última varredura {formatDateTime(summary.ultima_run)}
          </span>
        </div>
        <div className="rounded-2xl bg-surface border border-border p-5 flex flex-col gap-2">
          <span className="flex items-center gap-2 text-muted text-xs uppercase tracking-[0.12em] font-medium">
            <Cpu className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
            Modelos usados
          </span>
          {summary.modelos.length === 0 ? (
            <span className="text-muted text-sm">—</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {summary.modelos.map((m) => (
                <span
                  key={m}
                  className="text-[11px] font-medium text-purple-300 border border-purple/40 bg-purple/10 rounded-lg px-2 py-0.5"
                >
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

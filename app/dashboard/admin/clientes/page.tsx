import Link from "next/link";
import { ArrowUpRight, Zap, Circle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getClienteSummary } from "@/lib/radar/metrics";
import type { Marca } from "@/lib/types";
import MarcaDialog from "./MarcaDialog";
import ClienteToggle from "@/components/radar/ClienteToggle";

function formatDate(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function ClientesPage() {
  const supabase = createClient();

  const { data } = await supabase
    .from("marcas")
    .select("*")
    .order("created_at", { ascending: false });

  const marcas = (data ?? []) as Marca[];

  const withSummary = await Promise.all(
    marcas.map(async (marca) => ({
      marca,
      summary: await getClienteSummary(supabase, marca.id, marca.nome),
    }))
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div className="flex flex-col gap-2">
            <span className="kicker text-muted-2">Gestão de marcas</span>
            <h1 className="font-serif text-white font-medium text-3xl md:text-4xl leading-tight">
              Clientes
            </h1>
            <p className="text-muted text-sm">
              Cada cliente nasce aqui com seu DNA e opera no Radar.{" "}
              {marcas.length} cadastrado{marcas.length === 1 ? "" : "s"}.
            </p>
          </div>
          <MarcaDialog />
        </div>
      </div>

      {withSummary.length === 0 ? (
        <div className="rounded-3xl bg-surface border border-border p-10 text-center text-muted text-sm">
          Nenhum cliente cadastrado ainda. Crie o primeiro com o DNA da marca.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {withSummary.map(({ marca, summary }) => (
            <li key={marca.id} className="relative">
              <div
                className="absolute bottom-4 right-5 z-10 flex items-center gap-2"
                title={marca.status_varredura ? "Captura ligada" : "Captura desligada"}
              >
                <span className="text-muted text-[10px] uppercase tracking-wide">
                  {marca.status_varredura ? "on" : "off"}
                </span>
                <ClienteToggle marca={marca} />
              </div>
              <Link
                href={`/dashboard/admin/clientes/${marca.id}`}
                className="group flex flex-col gap-4 rounded-3xl bg-surface border border-border hover:border-white/20 p-5 transition-colors h-full shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="flex items-center gap-2 text-white text-lg font-bold truncate">
                      <Circle
                        className={`w-2 h-2 shrink-0 ${
                          marca.status_varredura
                            ? "fill-lime text-lime"
                            : "fill-muted/40 text-muted/40"
                        }`}
                      />
                      {marca.nome}
                    </span>
                    <span className="text-muted text-xs truncate">
                      {marca.yaml_conhecimento?.produto || "—"}
                    </span>
                  </div>
                  <ArrowUpRight
                    className="w-4 h-4 shrink-0 text-muted group-hover:text-white transition-colors"
                    strokeWidth={2.2}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 mt-auto">
                  <div className="flex flex-col">
                    <span className="text-white text-xl font-bold tabular-nums">
                      {summary.captados_total}
                    </span>
                    <span className="text-muted text-[10px] uppercase tracking-wide">
                      captados
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white text-xl font-bold tabular-nums">
                      {summary.drops_total}
                    </span>
                    <span className="text-muted text-[10px] uppercase tracking-wide">
                      drops
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white text-xl font-bold tabular-nums">
                      {summary.runs_total}
                    </span>
                    <span className="text-muted text-[10px] uppercase tracking-wide">
                      runs
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-muted/70 text-[11px] pt-1 border-t border-border">
                  <Zap className="w-3 h-3 shrink-0" strokeWidth={2} />
                  última run {formatDate(summary.ultima_run)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

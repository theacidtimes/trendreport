"use client";

import { Download, Printer } from "lucide-react";
import { ClienteSummary, DailyMetric } from "@/lib/radar/metrics";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(
  nome: string,
  summary: ClienteSummary,
  daily: DailyMetric[]
): string {
  const rows: (string | number)[][] = [
    ["Cliente", nome],
    ["Gerado em", new Date().toLocaleString("pt-BR")],
    [],
    ["Métrica", "7d", "30d", "Total"],
    ["Dados captados", summary.captados_7d, summary.captados_30d, summary.captados_total],
    ["Drops gerados", summary.drops_7d, summary.drops_30d, summary.drops_total],
    ["Runs do agente", summary.runs_7d, summary.runs_30d, summary.runs_total],
    ["Relatórios", summary.reports_7d, summary.reports_30d, summary.reports_total],
    [],
    ["Pico de captados (run)", summary.pico_captados],
    ["Modelos usados", summary.modelos.join(" | ") || "—"],
    [],
    ["Série diária"],
    ["Dia", "Captados", "Drops", "Runs"],
    ...daily.map((d) => [d.dia, d.captados, d.drops, d.runs]),
  ];
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

export default function ClienteExport({
  nome,
  summary,
  daily,
}: {
  nome: string;
  summary: ClienteSummary;
  daily: DailyMetric[];
}) {
  function exportCsv() {
    const csv = buildCsv(nome, summary, daily);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-uso-${nome.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-center gap-2 print:hidden">
      <button
        type="button"
        onClick={exportCsv}
        className="inline-flex items-center gap-2 rounded-full border border-border text-muted hover:text-white hover:border-lime/40 text-sm font-medium px-3.5 h-9 transition-colors"
      >
        <Download className="w-4 h-4" strokeWidth={2} />
        CSV
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-full bg-lime text-black text-sm font-semibold px-3.5 h-9 hover:brightness-95 transition"
      >
        <Printer className="w-4 h-4" strokeWidth={2.2} />
        PDF
      </button>
    </div>
  );
}

import { DailyMetric } from "@/lib/radar/metrics";

type Metric = "captados" | "drops" | "runs";

const META: Record<Metric, { label: string; color: string }> = {
  captados: { label: "Dados captados", color: "#81D300" },
  drops: { label: "Drops gerados", color: "#B266FF" },
  runs: { label: "Runs do agente", color: "#660099" },
};

function fmtDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// Gráfico de barras diário em HTML puro — sem dependência de lib.
// A barra do pico fica em opacidade cheia; as demais atenuadas.
export default function MetricChart({
  metric,
  data,
}: {
  metric: Metric;
  data: DailyMetric[];
}) {
  const { label, color } = META[metric];
  const values = data.map((d) => d[metric]);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const first = data[0]?.dia;
  const last = data[data.length - 1]?.dia;

  return (
    <div className="rounded-2xl bg-surface border border-border p-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted text-xs uppercase tracking-[0.12em] font-medium">
          {label}
        </span>
        <span className="text-white text-lg font-bold tabular-nums">
          {total}
          <span className="text-muted text-xs font-normal ml-1">
            / {data.length}d
          </span>
        </span>
      </div>

      <div className="flex items-end gap-[2px] h-24">
        {data.map((d) => {
          const v = d[metric];
          const isPeak = v === max && max > 0;
          return (
            <div
              key={d.dia}
              title={`${fmtDay(d.dia)}: ${v}`}
              className="flex-1 rounded-t-[2px] transition-opacity"
              style={{
                height: `${(v / max) * 100}%`,
                minHeight: v > 0 ? 2 : 0,
                background: color,
                opacity: isPeak ? 1 : 0.5,
              }}
            />
          );
        })}
      </div>

      {first && last && (
        <div className="flex justify-between text-muted/70 text-[10px] tabular-nums">
          <span>{fmtDay(first)}</span>
          <span>pico {max}</span>
          <span>{fmtDay(last)}</span>
        </div>
      )}
    </div>
  );
}

import { ShieldCheck } from "lucide-react";
import type { FontesDados } from "@/lib/types";
import { PLATFORM_LABEL, PLATFORM_ICON, PLATFORM_ACCENT, type Plataforma } from "@/lib/platforms";

const ORDER: Plataforma[] = ["instagram", "tiktok", "twitter", "news", "reddit"];

export default function DataSourceTracker({ fontes }: { fontes: FontesDados }) {
  const total = ORDER.reduce((sum, p) => sum + (fontes[p] ?? 0), 0);

  return (
    <div className="rounded-3xl bg-surface border border-border p-6 md:p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="flex items-center gap-2 text-muted text-xs uppercase tracking-[0.14em] font-medium font-body">
          <ShieldCheck className="w-3.5 h-3.5 text-lime shrink-0" strokeWidth={2.2} />
          De onde vieram os dados
        </span>
        <span className="text-white/60 text-xs font-body">
          {total} sinais reais coletados nas fontes abaixo
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ORDER.map((p) => {
          const Icon = PLATFORM_ICON[p];
          const count = fontes[p] ?? 0;
          return (
            <div
              key={p}
              className="flex flex-col items-center gap-2 text-center rounded-2xl bg-black/30 border border-white/10 px-3 py-4"
            >
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${PLATFORM_ACCENT[p]}26` }}
              >
                <Icon className="w-4 h-4" style={{ color: PLATFORM_ACCENT[p] }} strokeWidth={2.2} />
              </span>
              <span className="font-body text-white font-bold text-xl tabular-nums leading-none">
                {count}
              </span>
              <span className="text-muted text-[11px] font-body leading-tight">{PLATFORM_LABEL[p]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

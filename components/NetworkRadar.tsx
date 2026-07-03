import { ArrowUpRight } from "lucide-react";
import type { RadarItem } from "@/lib/types";
import { PLATFORM_LABEL, PLATFORM_ICON, PLATFORM_ACCENT } from "@/lib/platforms";

const TILE_BG = ["bg-black", "bg-purple", "bg-white"];

function VolumeChart({ radar }: { radar: RadarItem[] }) {
  const counts = radar.map((r) => ({
    plataforma: r.plataforma,
    total: (r.sinais ?? []).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.total));

  return (
    <div className="flex flex-col gap-4 rounded-3xl bg-surface border border-border p-6">
      <span className="text-muted text-xs uppercase tracking-[0.14em] font-medium">
        Volume de sinais por rede
      </span>
      <div className="flex flex-col gap-3">
        {counts.map((c) => {
          const Icon = PLATFORM_ICON[c.plataforma];
          const accent = PLATFORM_ACCENT[c.plataforma];
          return (
            <div key={c.plataforma} className="flex items-center gap-3">
              <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} style={{ color: accent }} />
              <span className="text-white/70 text-xs w-20 shrink-0 truncate">
                {PLATFORM_LABEL[c.plataforma]}
              </span>
              <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${(c.total / max) * 100}%`, backgroundColor: accent }}
                />
              </div>
              <span className="text-white text-xs font-bold tabular-nums w-4 text-right">
                {c.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function NetworkRadar({ radar }: { radar: RadarItem[] }) {
  if (!radar || radar.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="sm:col-span-2 lg:col-span-1">
        <VolumeChart radar={radar} />
      </div>

      {radar.map((item, i) => {
        const Icon = PLATFORM_ICON[item.plataforma];
        const accent = PLATFORM_ACCENT[item.plataforma];
        const bg = TILE_BG[i % TILE_BG.length];
        const isLight = bg === "bg-white";

        return (
          <div
            key={item.plataforma}
            className={`flex flex-col gap-3 ${bg} border border-border rounded-3xl p-5`}
          >
            <span
              className={`flex items-center gap-2 font-bold text-sm ${
                isLight ? "text-black" : "text-white"
              }`}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${accent}22` }}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={2.2} style={{ color: accent }} />
              </span>
              {PLATFORM_LABEL[item.plataforma]}
            </span>
            <div className="flex flex-col gap-2">
              {(item.sinais ?? []).map((sinal, j) => (
                <div
                  key={j}
                  className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${
                    isLight ? "bg-black/5" : "bg-white/5"
                  }`}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span
                      className={`text-xs truncate ${isLight ? "text-black/70" : "text-white/70"}`}
                    >
                      {sinal.tema}
                    </span>
                    {sinal.autor && (
                      <span
                        className={`text-[11px] truncate ${
                          isLight ? "text-black/45" : "text-white/45"
                        }`}
                      >
                        @{sinal.autor}
                      </span>
                    )}
                  </div>
                  {sinal.url && (
                    <a
                      href={sinal.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`shrink-0 transition-colors ${
                        isLight ? "text-black/40 hover:text-purple" : "text-white/40 hover:text-lime"
                      }`}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

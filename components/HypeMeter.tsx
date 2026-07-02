import { Flame, Snowflake } from "lucide-react";

export default function HypeMeter({ indiceHype }: { indiceHype: number }) {
  const pct = Math.max(0, Math.min(100, indiceHype));

  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 bg-surface border border-border rounded-xl p-6 md:p-8">
      <div className="flex flex-col gap-3 w-full">
        <span className="text-muted text-xs uppercase tracking-[0.14em] font-medium">
          Índice de hype
        </span>
        <div className="w-full h-3 rounded-full bg-purple-mid overflow-hidden">
          <div
            className="h-full bg-lime rounded-full transition-all duration-700 ease-out shadow-lime"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-muted text-xs uppercase tracking-wide">
          <span className="flex items-center gap-1.5">
            <Snowflake className="w-3.5 h-3.5" strokeWidth={2} />
            Esfriando
          </span>
          <span className="flex items-center gap-1.5 text-lime">
            Fervendo
            <Flame className="w-3.5 h-3.5" strokeWidth={2} />
          </span>
        </div>
      </div>

      <div className="flex items-end gap-2 shrink-0 tabular-nums">
        <span className="text-white font-bold text-[100px] md:text-[180px] leading-[0.8]">
          {pct}
        </span>
        <span className="text-lime font-bold text-2xl md:text-4xl mb-2 md:mb-6">
          /100
        </span>
      </div>
    </div>
  );
}

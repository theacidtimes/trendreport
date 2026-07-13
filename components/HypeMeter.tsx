import { Flame, Snowflake } from "lucide-react";

export default function HypeMeter({ indiceHype }: { indiceHype: number }) {
  const pct = Math.max(0, Math.min(100, indiceHype));
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);

  return (
    <div className="flex flex-col items-center justify-center gap-6 h-full w-full">
      <span className="text-muted text-xs uppercase tracking-[0.14em] font-medium">
        Índice de hype
      </span>

      <div className="relative w-[200px] h-[200px] shrink-0">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="var(--purple-mid)"
            strokeWidth="14"
          />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="var(--lime)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center tabular-nums">
          <span className="font-serif text-white font-medium text-6xl leading-none">{pct}</span>
          <span className="text-lime font-bold text-sm mt-1">/100</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-muted text-xs uppercase tracking-wide">
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
  );
}

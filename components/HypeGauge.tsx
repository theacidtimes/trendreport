import { NumberTicker } from "@/components/ui/number-ticker";

// Anel de hype do dashboard (Pulso do radar), reusado na capa do report.
export default function HypeGauge({ value }: { value: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative w-48 h-48 shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <defs>
          <linearGradient id="hypeGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--purple-mid)" />
            <stop offset="100%" stopColor="var(--purple)" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(245,243,239,0.08)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="url(#hypeGradient)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <NumberTicker
          value={value}
          className="font-serif text-white font-medium text-5xl tabular-nums leading-none"
        />
        <span className="text-muted-2 text-xs font-medium mt-1">/100</span>
      </div>
    </div>
  );
}

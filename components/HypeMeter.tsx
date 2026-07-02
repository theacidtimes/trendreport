export default function HypeMeter({ indiceHype }: { indiceHype: number }) {
  const pct = Math.max(0, Math.min(100, indiceHype));

  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
      <div className="flex flex-col gap-2 w-full">
        <div className="w-full h-3 rounded-full bg-purple-mid overflow-hidden">
          <div
            className="h-full bg-lime rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-muted text-xs uppercase tracking-wide">
          <span>ESFRIANDO</span>
          <span>FERVENDO</span>
        </div>
      </div>

      <div className="flex items-end gap-2 shrink-0">
        <span className="text-white font-bold text-[100px] md:text-[200px] leading-[0.8]">
          {pct}
        </span>
        <span className="text-lime font-bold text-2xl md:text-4xl mb-2 md:mb-6">
          /100
        </span>
      </div>
    </div>
  );
}

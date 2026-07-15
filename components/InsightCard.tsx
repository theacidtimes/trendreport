import type { InsightCriativo } from "@/lib/types";

const TILE_BG = ["bg-surface", "bg-purple", "bg-black"];

export default function InsightCard({
  insight,
  index,
}: {
  insight: InsightCriativo;
  index: number;
}) {
  const bg = TILE_BG[(index - 1) % TILE_BG.length];

  return (
    <div className={`flex flex-col gap-3 rounded-3xl p-7 border border-border ${bg}`}>
      <span className="text-xs font-bold tabular-nums text-lime">
        {String(index).padStart(2, "0")}
      </span>
      <h3 className="font-serif font-medium text-white text-[22px] md:text-[26px] leading-tight text-balance">
        {insight.titulo}
      </h3>
      <p className="font-body text-base leading-relaxed text-white/75">
        {insight.texto}
      </p>
    </div>
  );
}

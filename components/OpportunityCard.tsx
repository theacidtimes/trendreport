import { Target } from "lucide-react";
import type { Oportunidade } from "@/lib/types";

const TILE_BG = ["bg-white", "bg-black", "bg-purple"];

export default function OpportunityCard({
  oportunidade,
  index,
}: {
  oportunidade: Oportunidade;
  index?: number;
}) {
  const bg = TILE_BG[((index ?? 1) - 1) % TILE_BG.length];
  const isLight = bg === "bg-white";

  return (
    <div
      className={`flex flex-col gap-4 rounded-3xl p-7 md:p-8 ${bg} ${
        isLight ? "border border-border" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        {typeof index === "number" && (
          <span
            className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${
              isLight ? "bg-black/10 text-black" : "border border-white/25 text-white/70"
            }`}
          >
            {String(index).padStart(2, "0")}
          </span>
        )}
        <span
          className={`ml-auto w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            isLight ? "bg-purple/10" : "bg-lime/15"
          }`}
        >
          <Target
            className={`w-4 h-4 ${isLight ? "text-purple" : "text-lime"}`}
            strokeWidth={2.2}
          />
        </span>
      </div>

      <span
        className={`text-xs uppercase tracking-[0.1em] font-medium ${
          isLight ? "text-purple" : "text-lime"
        }`}
      >
        {oportunidade.label}
      </span>

      <h3
        className={`font-serif font-medium text-[28px] md:text-[32px] leading-tight ${
          isLight ? "text-black" : "text-white"
        }`}
      >
        {oportunidade.titulo}
      </h3>

      <p className={`font-body text-base leading-relaxed ${isLight ? "text-black/70" : "text-white/80"}`}>
        {oportunidade.descricao}
      </p>
    </div>
  );
}

import type { Oportunidade } from "@/lib/types";

export default function OpportunityCard({
  oportunidade,
  index,
}: {
  oportunidade: Oportunidade;
  index?: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        {typeof index === "number" && (
          <span className="w-7 h-7 shrink-0 rounded-full border border-white/25 flex items-center justify-center text-white/70 text-xs font-bold tabular-nums">
            {String(index).padStart(2, "0")}
          </span>
        )}
        <span className="text-lime text-xs uppercase tracking-[0.1em] font-medium">
          {oportunidade.label}
        </span>
      </div>
      <h3 className="text-white font-bold text-[26px] md:text-[28px] tracking-[-0.01em]">
        {oportunidade.titulo}
      </h3>
      <p className="text-white/80 text-lg">{oportunidade.descricao}</p>
    </div>
  );
}

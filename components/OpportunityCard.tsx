import type { Oportunidade } from "@/lib/types";

export default function OpportunityCard({
  oportunidade,
}: {
  oportunidade: Oportunidade;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-lime text-xs uppercase tracking-[0.08em] font-medium">
        {oportunidade.label}
      </span>
      <h3 className="text-white font-bold text-[28px]">
        {oportunidade.titulo}
      </h3>
      <p className="text-white/80 text-lg">{oportunidade.descricao}</p>
    </div>
  );
}

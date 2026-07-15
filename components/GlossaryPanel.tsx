import type { GlossarioTermo } from "@/lib/types";

const CATEGORIA_STYLE: Record<GlossarioTermo["categoria"], string> = {
  sentimento: "bg-lime/15 text-lime border-lime/30",
  adjetivo: "bg-purple/20 text-white border-purple/40",
  vocabulario: "bg-white/10 text-white border-white/20",
  tema: "bg-black text-white/80 border-border",
};

const CATEGORIA_LABEL: Record<GlossarioTermo["categoria"], string> = {
  sentimento: "Sentimento",
  adjetivo: "Adjetivo",
  vocabulario: "Vocabulário",
  tema: "Tema",
};

const ORDEM: GlossarioTermo["categoria"][] = [
  "sentimento",
  "adjetivo",
  "vocabulario",
  "tema",
];

export default function GlossaryPanel({ termos }: { termos: GlossarioTermo[] }) {
  return (
    <div className="rounded-3xl bg-surface border border-border p-7 md:p-8 flex flex-col gap-6">
      {ORDEM.map((cat) => {
        const doGrupo = termos.filter((t) => t.categoria === cat);
        if (doGrupo.length === 0) return null;
        return (
          <div key={cat} className="flex flex-col gap-3">
            <span className="text-xs uppercase tracking-[0.1em] font-medium text-muted-2">
              {CATEGORIA_LABEL[cat]}
            </span>
            <div className="flex flex-wrap gap-2">
              {doGrupo.map((t, i) => (
                <span
                  key={i}
                  className={`text-sm font-medium rounded-full border px-3.5 py-1.5 ${CATEGORIA_STYLE[cat]}`}
                >
                  {t.termo}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

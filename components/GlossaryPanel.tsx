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

// Tamanho da pastilha por peso (1 a 5). Classes literais porque o JIT do
// Tailwind não enxerga nome de classe montado em runtime.
const PESO_STYLE: Record<number, string> = {
  1: "text-xs px-3 py-1 font-medium",
  2: "text-sm px-3.5 py-1.5 font-medium",
  3: "text-base px-4 py-1.5 font-medium",
  4: "text-xl px-5 py-2 font-semibold",
  5: "text-2xl px-6 py-2.5 font-semibold",
};

const PESO_PADRAO = 3;

// Reports gerados antes do campo `peso` não o trazem — nesses, toda pastilha
// cai no tamanho médio e o painel volta a ficar uniforme, como era antes.
function pesoDe(t: GlossarioTermo): number {
  const p = Math.round(Number(t.peso));
  if (!Number.isFinite(p) || p < 1 || p > 5) return PESO_PADRAO;
  return p;
}

export default function GlossaryPanel({ termos }: { termos: GlossarioTermo[] }) {
  return (
    <div className="rounded-3xl bg-surface border border-border p-7 md:p-8 flex flex-col gap-6">
      {ORDEM.map((cat) => {
        // Maiores primeiro: numa nuvem, o olho espera cair no termo dominante
        // antes de varrer o resto.
        const doGrupo = termos
          .filter((t) => t.categoria === cat)
          .sort((a, b) => pesoDe(b) - pesoDe(a));
        if (doGrupo.length === 0) return null;
        return (
          <div key={cat} className="flex flex-col gap-3">
            <span className="text-xs uppercase tracking-[0.1em] font-medium text-muted-2">
              {CATEGORIA_LABEL[cat]}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {doGrupo.map((t, i) => (
                <span
                  key={i}
                  className={`rounded-full border leading-none ${PESO_STYLE[pesoDe(t)]} ${CATEGORIA_STYLE[cat]}`}
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

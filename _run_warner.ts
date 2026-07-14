import * as yaml from "js-yaml";
import { generateReport } from "./lib/generateReport";

const briefing = {
  cliente: "Warner Bros Games",
  tom: "Nostalgia com hype. Resgata quem conhece a franquia mas talvez não esteja mais próximo, mantendo energia pra fãs de verdade.",
  data: "2026-07-13",
  contexto:
    "Warner Bros Games possui o canal Warner Play e detém grandes títulos como Mortal Kombat. Objetivo é estreitar a conversa e converter novos fãs para sua base, tanto gamers quanto pessoas que já jogaram ou ouviram sobre seus títulos. Proposta é juntar entretenimento com cultura pop para crescer a base e impulsionar vendas.",
  quero:
    "Engajamento, aumento de base e estreitar a relação com os títulos da Warner Bros Games em especial Mortal Kombat no médio e longo prazo.",
  memes_que_vi: [
    "Finish Him",
    "você poderia estar jogando agora",
    "nostalgia de arcade",
    "voltaram os 90s/2000s",
  ],
};

async function main() {
  const briefingYaml = yaml.dump(briefing);
  const result = await generateReport(briefingYaml, briefing, async (p) => {
    console.log("PROGRESSO:", JSON.stringify(p.sources_done));
  });

  if ("error" in result) {
    console.log("ERRO:", result.error);
    return;
  }

  console.log("FONTES:", JSON.stringify(result.report.fontes, null, 2));
  console.log("QTD_TENDENCIAS:", result.report.tendencias?.length ?? 0);
  for (const t of result.report.tendencias ?? []) {
    console.log(`- [${t.plataforma ?? "?"}] ${t.titulo}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exitCode = 1;
});

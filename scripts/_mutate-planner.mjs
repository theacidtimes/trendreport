// Testa o teste: aplica uma mutação por vez em planner.ts e verifica se
// check-planner-agenda.ts pega. Mutação que sobrevive = assert que não existe.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const ALVO = "lib/radar/planner.ts";
const CHECK = "scripts/check-planner-agenda.ts";
const original = readFileSync(ALVO, "utf8");

const mutacoes = [
  ["desempate: sem localeCompare (volta o cara-ou-coroa)",
   "return y.peso - x.peso || String(x.titulo).localeCompare(String(y.titulo))",
   "return y.peso - x.peso"],
  ["teto: sem o minimo de 1 (com 1 vaga a data some)",
   "Math.min(nVagas, Math.max(1, Math.floor(nVagas / 2)))",
   "Math.min(nVagas, Math.floor(nVagas / 2))"],
  ["teto: floor -> ceil (datada come mais da metade)",
   "Math.max(1, Math.floor(nVagas / 2))",
   "Math.max(1, Math.ceil(nVagas / 2))"],
  ["teto: metade -> tudo (perene perde a protecao)",
   "const escolhidas = datadas.slice(0, tetoDatadas)",
   "const escolhidas = datadas.slice(0, nVagas)"],
  ["ehDatada: || -> && (so janela completa conta como datada)",
   "return Boolean(a.janela_inicio || a.janela_fim)",
   "return Boolean(a.janela_inicio && a.janela_fim)"],
  ["ehDatada: invertida",
   "return Boolean(a.janela_inicio || a.janela_fim)",
   "return !(a.janela_inicio || a.janela_fim)"],
  ["sem o preenchimento da sobra (vaga fica vazia)",
   "escolhidas.push(...datadas.slice(tetoDatadas, tetoDatadas + (nVagas - escolhidas.length)))",
   ""],
  ["janela_fim: >= vira > (ultimo dia deixa de valer)",
   "(!a.janela_fim || a.janela_fim >= today)",
   "(!a.janela_fim || a.janela_fim > today)"],
  ["janela_inicio: <= vira < (primeiro dia deixa de valer)",
   "(!a.janela_inicio || a.janela_inicio <= today)",
   "(!a.janela_inicio || a.janela_inicio < today)"],
  ["distribuirVagas: ordena o array do chamador",
   "const datadas = vigentes.filter(ehDatada).sort(porPeso)",
   "const datadas = vigentes.sort(porPeso).filter(ehDatada)"],
  ["guarda: nVagas <= 0 vira < 0 (zero vaga devolve algo)",
   "if (nVagas <= 0) return []",
   "if (nVagas < 0) return []"],
  ["planLanes: volta ao corte cego por peso",
   "for (const a of diagnosticarAgenda(marca, agenda, now).escolhidas) {",
   "for (const a of selectAgenda(marca, agenda, now).sort((x, y) => y.peso - x.peso).slice(0, Math.round(clamp01(k.peso_cultural ?? PESO_CULTURAL_DEFAULT) * CAP_AGENDA_CLUSTERS))) {"],
  ["selectAgenda: nao filtra tenant",
   ".filter(a => a.tenant_id === null || a.tenant_id === marca.tenant_id)",
   ""],
  ["selectAgenda: nao filtra dominio assinado",
   ".filter(a => dominios.has(a.dominio))",
   ""],
  ["selectAgenda: ignora ativo",
   ".filter(a => a.ativo)",
   ""]
];

let pegas = 0;
for (const [nome, de, para] of mutacoes) {
  if (!original.includes(de)) {
    console.log(`?? NAO APLICADA  ${nome}`);
    continue;
  }
  writeFileSync(ALVO, original.replace(de, para));
  let morreu = false;
  try {
    execSync(`npx tsx ${CHECK}`, { stdio: "pipe" });
  } catch {
    morreu = true;
  }
  if (morreu) pegas++;
  console.log(`${morreu ? "PEGA    " : "SOBREVIVEU"}  ${nome}`);
}
writeFileSync(ALVO, original);
console.log(`\n${pegas}/${mutacoes.length} mutacoes pegas.`);

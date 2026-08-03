// Testa o teste: aplica uma mutação por vez e verifica se check-perfil-cultural.ts
// pega. Mutação que sobrevive = assert que não existe (ou que é vazio, que é pior,
// porque parece existir).
//
// Guardado no repo de propósito: é a documentação executável do que foi realmente
// testado. Uma lista de asserts diz o que alguém quis cobrir; isto diz o que a
// cobertura AGUENTA.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const CHECK = "scripts/check-perfil-cultural.ts";

const PERFIL = "lib/radar/perfilCultural.ts";
const DNA = "lib/marcaDNA.ts";
const PLANNER = "lib/radar/planner.ts";

const mutacoes = [
  // ── perfilCultural: o que volta do modelo ──
  [PERFIL, "normalizar: aceita dominio inventado (config que mente)",
   "(d): d is string => typeof d === 'string' && validos.has(d)",
   "(d): d is string => typeof d === 'string'"],
  [PERFIL, "normalizar: nao deduplica dominio",
   "Array.from(new Set(bruto.dominios.filter",
   "Array.from((bruto.dominios).filter"],
  [PERFIL, "normalizar: nao ordena (config vira ordem do modelo)",
   "dominios_culturais: dominios.sort()",
   "dominios_culturais: dominios"],
  [PERFIL, "normalizar: dominio com 0 vaga sobrevive (parece ligado, nao roda)",
   "if (!dominios.length || vagas === 0) return { ...SEM_AGENDA, justificativa }",
   "if (!dominios.length) return { ...SEM_AGENDA, justificativa }"],
  [PERFIL, "normalizar: vaga sem dominio sobrevive (custo pra agenda vazia)",
   "if (!dominios.length || vagas === 0) return { ...SEM_AGENDA, justificativa }",
   "if (vagas === 0) return { ...SEM_AGENDA, justificativa }"],
  [PERFIL, "normalizar: sem teto de vagas (custo estoura)",
   "Math.max(0, Math.min(CAP_AGENDA_CLUSTERS, Math.round(vagasCru)))",
   "Math.max(0, Math.round(vagasCru))"],
  [PERFIL, "normalizar: sem piso (vaga negativa vira peso negativo)",
   "Math.max(0, Math.min(CAP_AGENDA_CLUSTERS, Math.round(vagasCru)))",
   "Math.min(CAP_AGENDA_CLUSTERS, Math.round(vagasCru))"],
  [PERFIL, "normalizar: NaN passa pelo typeof e vira peso NaN",
   "typeof bruto.vagas === 'number' && Number.isFinite(bruto.vagas)",
   "typeof bruto.vagas === 'number'"],
  [PERFIL, "normalizar: aceita string numerica como vaga",
   "typeof bruto.vagas === 'number' && Number.isFinite(bruto.vagas) ? bruto.vagas : 0",
   "Number(bruto.vagas)"],
  [PERFIL, "normalizar: round -> floor (4 na tela vira 3 na varredura)",
   "Math.round(vagasCru)",
   "Math.floor(vagasCru)"],
  [PERFIL, "normalizar: peso deixa de bater com as vagas",
   "peso_cultural: vagas / CAP_AGENDA_CLUSTERS",
   "peso_cultural: vagas / (CAP_AGENDA_CLUSTERS + 1)"],
  [PERFIL, "normalizar: justificativa em branco vira string vazia (campo mudo)",
   "typeof bruto.justificativa === 'string' && bruto.justificativa.trim()",
   "typeof bruto.justificativa === 'string'"],
  [PERFIL, "vagasDoPeso: sem clamp (peso corrompido vira vaga fantasma)",
   "Math.round(Math.max(0, Math.min(1, peso)) * CAP_AGENDA_CLUSTERS)",
   "Math.round(peso * CAP_AGENDA_CLUSTERS)"],
  [PERFIL, "tool: dominios livres (modelo inventa 'lifestyle')",
   "items: { type: 'string', enum: dominiosDisponiveis }",
   "items: { type: 'string' }"],
  [PERFIL, "tool: teto de vagas divergente do planner",
   "maximum: CAP_AGENDA_CLUSTERS",
   "maximum: 10"],
  [PERFIL, "tool: minimo 1 (nao assinar deixa de ser resposta possivel)",
   "minimum: 0,",
   "minimum: 1,"],
  [PERFIL, "descreverMarca: vaza termo de busca na decisao de territorio",
   "`País: ${k.pais ?? 'BR'}`",
   "`Termos: ${(k.termos_busca ?? []).join('; ')}`"],
  [PERFIL, "descreverMarca: campo ausente vira 'undefined' no prompt",
   "`Universos culturais: ${(k.universos_culturais ?? []).join('; ') || '(não declarado)'}`",
   "`Universos culturais: ${k.universos_culturais!.join('; ')}`"],

  // ── marcaDNA: o apagão silencioso ──
  [DNA, "mesclarDNA: volta a reconstruir do zero (apaga o que a tela nao sabe)",
   "const out = { ...base } as unknown as Record<string, unknown>",
   "const out = {} as unknown as Record<string, unknown>"],
  [DNA, "mesclarDNA: undefined sobrescreve (form zera campo que nao tem)",
   "if (v !== undefined) out[k] = v",
   "out[k] = v"],
  [DNA, "mesclarDNA: muta a base recebida",
   "const out = { ...base } as unknown as Record<string, unknown>",
   "const out = base as unknown as Record<string, unknown>"],
  [DNA, "precisaDerivar: ignora o override do humano (desfaz o ajuste manual)",
   "if (patch.dominios_culturais !== undefined || patch.peso_cultural !== undefined) return false",
   ""],
  [DNA, "precisaDerivar: marca nova NAO deriva (o buraco original volta)",
   "if (base.peso_cultural == null && !(base.dominios_culturais?.length)) return true",
   ""],
  [DNA, "precisaDerivar: deriva a cada save (custo por clique)",
   "return ENTRADAS_DA_DERIVACAO.some(campo => {",
   "return true || ENTRADAS_DA_DERIVACAO.some(campo => {"],
  [DNA, "precisaDerivar: nunca re-deriva (DNA muda, perfil congela)",
   "return ENTRADAS_DA_DERIVACAO.some(campo => {",
   "return false && ENTRADAS_DA_DERIVACAO.some(campo => {"],
  [DNA, "precisaDerivar: pais deixa de ser entrada da decisao",
   "  'pais'\n]",
   "]"],
  [DNA, "precisaDerivar: produto deixa de ser entrada da decisao",
   "  'produto',\n",
   ""],
  [DNA, "mesmoValor: array comparado por referencia (re-deriva sempre)",
   "return x.length === y.length && x.every((v, i) => v === y[i])",
   "return x === y"],
  [DNA, "mesmoValor: so o tamanho conta (troca de conteudo nao re-deriva)",
   "return x.length === y.length && x.every((v, i) => v === y[i])",
   "return x.length === y.length"],

  // ── planner: país e diagnóstico ──
  [PLANNER, "selectAgenda: nao filtra pais (marca AU no calendario BR)",
   ".filter(a => !a.pais || String(a.pais).toUpperCase() === pais)",
   ""],
  [PLANNER, "selectAgenda: linha universal deixa de valer pra todos",
   ".filter(a => !a.pais || String(a.pais).toUpperCase() === pais)",
   ".filter(a => String(a.pais).toUpperCase() === pais)"],
  // ATENÇÃO: o `de` precisa do `.filter(a => !a.pais || ` na frente. Sem ele, o
  // trecho `String(a.pais).toUpperCase() === pais` é PREFIXO da linha equivalente
  // dentro do diagnosticarAgenda (`... === paisDaMarca(marca)`), que aparece antes
  // no arquivo — e `.replace()` troca a PRIMEIRA ocorrência. A mutação caía no
  // contador do log em vez de no filtro real e "sobrevivia" por endereço errado.
  [PLANNER, "selectAgenda: pais sem normalizar (SQL com 'br' nunca casa)",
   ".filter(a => !a.pais || String(a.pais).toUpperCase() === pais)",
   ".filter(a => !a.pais || a.pais === pais)"],
  [PLANNER, "paisDaMarca: default deixa de ser BR (silencia quem ja roda)",
   "return typeof p === 'string' && p.trim() ? p.trim().toUpperCase() : 'BR'",
   "return typeof p === 'string' && p.trim() ? p.trim().toUpperCase() : 'XX'"],
  [PLANNER, "paisDaMarca: nao normaliza caixa",
   "p.trim().toUpperCase()",
   "p.trim()"],
  [PLANNER, "diagnostico: 'legado' vira 'nao assina' (omissao virou decisao)",
   "estado: 'legado',",
   "estado: 'nao_assina',"],
  [PLANNER, "diagnostico: nao distingue agenda vazia de agenda sem linha",
   "if (!vigentes.length) {",
   "if (false) {"],
  [PLANNER, "diagnostico: dominio com 0 vaga passa como config valida",
   "if (vagas === 0) {",
   "if (false) {"],
  [PLANNER, "diagnostico: perde a justificativa no log (numero magico volta)",
   "const porque = k.justificativa_cultural ? ` — \"${k.justificativa_cultural}\"` : ''",
   "const porque = ''"],
  [PLANNER, "diagnostico: nao marca a datada vigente no log",
   "`${a.titulo}${ehDatada(a) ? '*' : ''}`",
   "`${a.titulo}`"],
  [PLANNER, "diagnostico: devolve linhas mesmo nos estados vazios",
   "const vazio = { vagas: 0, escolhidas: [] as PulsoCultural[] }",
   "const vazio = { vagas: 1, escolhidas: agenda.slice(0, 1) }"]
];

let pegas = 0;
const sobreviventes = [];
for (const [alvo, nome, de, para] of mutacoes) {
  const original = readFileSync(alvo, "utf8");
  if (!original.includes(de)) {
    console.log(`?? NAO APLICADA  ${nome}`);
    continue;
  }
  writeFileSync(alvo, original.replace(de, para));
  let morreu = false;
  try {
    execSync(`npx tsx ${CHECK}`, { stdio: "pipe" });
  } catch {
    morreu = true;
  }
  writeFileSync(alvo, original);
  if (morreu) pegas++;
  else sobreviventes.push(nome);
  console.log(`${morreu ? "PEGA    " : "SOBREVIVEU"}  ${nome}`);
}
console.log(`\n${pegas}/${mutacoes.length} mutacoes pegas.`);
if (sobreviventes.length) {
  console.log("\nSobreviventes (investigar um a um — pode ser assert faltando OU mutante equivalente):");
  for (const s of sobreviventes) console.log(`  - ${s}`);
}

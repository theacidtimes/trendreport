// Testa o teste: aplica uma mutação por vez em agendaLinha.ts e verifica se
// check-agenda.ts pega. Mutação que sobrevive = assert que não existe.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const ALVO = "lib/radar/agendaLinha.ts";
const CHECK = "scripts/check-agenda.ts";
const original = readFileSync(ALVO, "utf8");

const mutacoes = [
  ["dominio: nao tira acento (Saude != Saúde no Set)",
   ".replace(/[\\u0300-\\u036f]/g, '')",
   ""],
  ["dominio: nao baixa a caixa",
   ".toLowerCase()",
   ""],
  ["dominio: underscore vira hifen",
   ".replace(/[^a-z0-9]+/g, '_')",
   ".replace(/[^a-z0-9]+/g, '-')"],
  ["dominio: nao apara underscore das pontas",
   ".replace(/^_+|_+$/g, '')",
   ""],
  ["dominio: grava a grafia crua (normalizacao so na tela)",
   "const dominio = normalizarDominio(e.dominio ?? '')",
   "const dominio = (e.dominio ?? '').trim()"],

  ["data: sem round-trip pelo Date (2026-02-31 passa)",
   "return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v",
   "return !Number.isNaN(d.getTime())"],
  ["data: sem o guarda de Invalid Date",
   "return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v",
   "return d.toISOString().slice(0, 10) === v"],
  ["data: nao valida formato nenhum",
   "if (v && !dataValida(v)) {",
   "if (false) {"],

  ["janela: invertida deixa de ser recusada",
   "if (janela_inicio && janela_fim && janela_inicio > janela_fim) {",
   "if (false) {"],
  ["janela: > vira >= (janela de um dia so vira invalida)",
   "janela_inicio > janela_fim",
   "janela_inicio >= janela_fim"],
  ["janela: '' nao vira null",
   "  const t = (v ?? '').trim()\n  return t ? t : null",
   "  return (v ?? '').trim()"],

  ["termos: aceita termo de 1 caractere",
   "t.length >= 2",
   "t.length >= 1"],
  ["termos: nao deduplica (dois termos iguais, duas lanes)",
   "Array.from(\n    new Set((e.termos ?? []).map(t => t.trim()).filter(t => t.length >= 2))\n  )",
   "(e.termos ?? []).map(t => t.trim()).filter(t => t.length >= 2)"],
  ["termos: nao apara antes de deduplicar",
   "(e.termos ?? []).map(t => t.trim())",
   "(e.termos ?? [])"],
  ["termos: lista vazia deixa de ser recusada",
   "if (!termos.length) {",
   "if (false) {"],

  ["titulo: vazio deixa de ser recusado",
   "if (!titulo) {",
   "if (false) {"],
  ["titulo: nao apara",
   "const titulo = (e.titulo ?? '').trim()",
   "const titulo = (e.titulo ?? '')"],

  ["peso: sem faixa (0 e 99 passam)",
   "if (!Number.isFinite(peso) || peso < PESO_MIN || peso > PESO_MAX) {",
   "if (false) {"],
  ["peso: sem o guarda de NaN",
   "!Number.isFinite(peso) || peso < PESO_MIN",
   "peso < PESO_MIN"],
  ["peso: round vira ceil",
   "const peso = Math.round(Number(e.peso))",
   "const peso = Math.ceil(Number(e.peso))"],

  ["pais: nao sobe a caixa (br != BR no filtro do planner)",
   "paisBruto ? paisBruto.toUpperCase() : null",
   "paisBruto ? paisBruto : null"],
  ["pais: aceita qualquer tamanho (BRA passa)",
   "/^[A-Z]{2}$/.test(pais)",
   "/^[A-Z]+$/.test(pais)"],
  ["pais: sem validacao nenhuma",
   "if (pais && !/^[A-Z]{2}$/.test(pais)) {",
   "if (false) {"],

  ["ativo: undefined vaza como undefined",
   "ativo: Boolean(e.ativo)",
   "ativo: e.ativo"],

  ["estado: ignora o desligado",
   "if (!a.ativo) return 'desligada'",
   ""],
  ["estado: desligado passa a perder para encerrado",
   "  if (!a.ativo) return 'desligada'\n  const hoje = now.toISOString().slice(0, 10)",
   "  const hoje = now.toISOString().slice(0, 10)\n  if (a.janela_fim && a.janela_fim < hoje) return 'encerrada'\n  if (!a.ativo) return 'desligada'"],
  ["estado: primeiro dia da janela vira futura (erro de 1 dia)",
   "if (a.janela_inicio && a.janela_inicio > hoje) return 'futura'",
   "if (a.janela_inicio && a.janela_inicio >= hoje) return 'futura'"],
  ["estado: ultimo dia da janela vira encerrada (erro de 1 dia)",
   "if (a.janela_fim && a.janela_fim < hoje) return 'encerrada'",
   "if (a.janela_fim && a.janela_fim <= hoje) return 'encerrada'"],
  ["estado: janela futura deixa de ser detectada",
   "if (a.janela_inicio && a.janela_inicio > hoje) return 'futura'",
   ""],
  ["estado: janela encerrada deixa de ser detectada",
   "if (a.janela_fim && a.janela_fim < hoje) return 'encerrada'",
   ""],
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

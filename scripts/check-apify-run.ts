import {
  interpretarRun,
  ehFalhaDeSaldo,
  diagnosticarColeta,
  conciliarCusto,
  type ApifyRunLog,
} from "../lib/apify";
import { custosDaApify } from "../lib/generateReport";

// O refactor do runActor (run-sync → POST /runs + poll + dataset) NÃO PODE ser
// validado contra a Apify enquanto a conta estiver sem saldo. O que dá pra
// testar sem rede é justamente a parte que decide as coisas: quando parar de
// esperar, se o dado é confiável, quanto custou e o que virou lançamento.
//
// Todos os erros aqui são do tipo que não levanta exceção: um estado terminal
// classificado errado faz o poll rodar até o timeout; um custo perdido no
// filtro faz o /console/custos mentir pra baixo; uma falha de saldo não
// reconhecida devolve ao cliente "tente novamente em alguns minutos" quando a
// verdade é "a conta da ACID precisa ser recarregada".

let falhas = 0;
const check = (nome: string, ok: boolean, extra?: unknown) => {
  if (!ok) falhas++;
  console.log(`${ok ? "PASS" : "FALHA"}  ${nome}`);
  if (!ok) console.log("   ", JSON.stringify(extra));
};

// ── estados terminais ─────────────────────────────────────
// Errar aqui pra menos (não reconhecer um terminal) faz o poll insistir por
// 300s num run que já acabou — o report inteiro fica refém disso.
for (const s of ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"]) {
  check(`${s} e estado terminal`, interpretarRun({ status: s }).terminal, s);
}
// ...e errar pra mais (achar que RUNNING acabou) é pior: leríamos o dataset
// antes de o actor terminar de escrever e o report sairia com meia coleta.
for (const s of ["RUNNING", "READY", "ABORTING"]) {
  check(`${s} NAO e terminal`, !interpretarRun({ status: s }).terminal, s);
}
check(
  "run sem status nao e tratado como terminal",
  !interpretarRun({}).terminal
);
check("run nulo nao quebra e nao e terminal", !interpretarRun(null).terminal);

// Só SUCCEEDED autoriza ler o dataset. FAILED é terminal (paramos de esperar)
// mas não é sucesso (não há dado confiável pra ler).
check("apenas SUCCEEDED conta como ok", interpretarRun({ status: "SUCCEEDED" }).ok);
check("FAILED e terminal mas NAO e ok", !interpretarRun({ status: "FAILED" }).ok);

// ── custo ─────────────────────────────────────────────────
check(
  "usageTotalUsd numerico e lido",
  interpretarRun({ status: "SUCCEEDED", usageTotalUsd: 0.0412 }).custoUsd ===
    0.0412
);
// Zero falso é o pior caso: soma no total e o painel diz "saiu de graça",
// enquanto null deixa explícito que não foi medido.
check(
  "actor sem usageTotalUsd devolve null, nao 0",
  interpretarRun({ status: "SUCCEEDED" }).custoUsd === null
);
check(
  "usageTotalUsd nao-numerico devolve null",
  interpretarRun({
    status: "SUCCEEDED",
    usageTotalUsd: "0.04" as unknown as number,
  }).custoUsd === null
);
// Run que falhou ainda cobra a taxa de start (visto na fatura: FAILED a $0,04).
check(
  "run FAILED preserva o custo (a Apify cobra o start)",
  interpretarRun({ status: "FAILED", usageTotalUsd: 0.04 }).custoUsd === 0.04
);

// ── conciliação do custo pos-terminal ─────────────────────
// Medido na Apify real: no instante do SUCCEEDED o run marcava 0.0751 e
// assentou em 0.079. Como custos_uso tem unique (provedor, ref) com
// ignoreDuplicates, o primeiro valor gravado é o valor pra sempre — errar aqui
// subestima TODO run do sistema, em silêncio, pra sempre.
check(
  "custo que assentou pra cima substitui o parcial",
  conciliarCusto(0.0751, 0.079) === 0.079
);
// Cobrança é acumulada: evento cobrado não é estornado. Valor menor na
// releitura é ruído de leitura, e aceitá-lo abriria a porta pra gravar menos
// do que já sabíamos ter gasto.
check(
  "releitura MENOR nao reduz o custo ja conhecido",
  conciliarCusto(0.079, 0.0751) === 0.079
);
check("valores iguais ficam iguais", conciliarCusto(0.05, 0.05) === 0.05);
// Actor sem usageTotalUsd no terminal, mas com valor na releitura: é ganho
// líquido de informação, tem que entrar.
check("parcial null aceita o valor relido", conciliarCusto(null, 0.04) === 0.04);
// E o contrário: releitura falhou/veio vazia não pode apagar o que já tínhamos.
check("releitura null preserva o parcial", conciliarCusto(0.04, null) === 0.04);
// Zero é valor legítimo (run que não gerou evento cobrado), não "sem medida" —
// não pode ser confundido com null nem descartado por ser falsy.
check("zero e preservado, nao tratado como ausente", conciliarCusto(0, null) === 0);
check("zero na releitura nao apaga custo real", conciliarCusto(0.02, 0) === 0.02);
check("nenhum dos dois medido devolve null", conciliarCusto(null, null) === null);

// ── falha de saldo ────────────────────────────────────────
// A distinção que muda a mensagem entregue ao cliente.
check("HTTP 402 e falha de saldo por definicao", ehFalhaDeSaldo(402, ""));
check(
  "not-enough-usage-to-run-paid-actor e reconhecido",
  ehFalhaDeSaldo(403, '{"error":{"type":"not-enough-usage-to-run-paid-actor"}}')
);
check(
  "insufficient-credits e reconhecido",
  ehFalhaDeSaldo(403, '{"error":{"type":"insufficient-credits"}}')
);
check(
  "monthly-usage-hard-limit-exceeded e reconhecido",
  ehFalhaDeSaldo(403, '{"error":{"type":"monthly-usage-hard-limit-exceeded"}}')
);
// Falso positivo também custa: rotularia um bug nosso como problema de fatura
// e mandaria o operador recarregar a conta à toa.
check(
  "actor-not-found NAO e falha de saldo",
  !ehFalhaDeSaldo(404, '{"error":{"type":"actor-not-found"}}')
);
check(
  "erro de input NAO e falha de saldo",
  !ehFalhaDeSaldo(400, '{"error":{"type":"invalid-input","message":"bad field"}}')
);
check("corpo vazio com 500 NAO e falha de saldo", !ehFalhaDeSaldo(500, ""));

// ── log → lançamentos de custo ────────────────────────────
const log: ApifyRunLog = [
  // sucesso normal
  {
    fonte: "reddit",
    actorId: "trudax~reddit-scraper-lite",
    runId: "run_ok",
    status: "SUCCEEDED",
    custoUsd: 0.05,
    startedAt: "2026-07-30T10:00:00.000Z",
    itens: 20,
    falha: null,
  },
  // falhou, mas foi cobrado: precisa virar lançamento igual
  {
    fonte: "tiktok",
    actorId: "clockworks~tiktok-scraper",
    runId: "run_fail",
    status: "FAILED",
    custoUsd: 0.01,
    startedAt: "2026-07-30T10:01:00.000Z",
    itens: 0,
    falha: { motivo: "run_falhou", detalhe: "FAILED: x" },
  },
  // nem iniciou (sem saldo): sem run id, não há o que atribuir
  {
    fonte: "twitter",
    actorId: "apidojo~tweet-scraper",
    runId: null,
    status: "NAO_INICIOU",
    custoUsd: null,
    startedAt: null,
    itens: 0,
    falha: { motivo: "saldo", detalhe: "HTTP 402" },
  },
  // estourou nosso timeout: o valor de agora é PARCIAL
  {
    fonte: "instagram",
    actorId: "apify~instagram-scraper",
    runId: "run_lento",
    status: "RUNNING",
    custoUsd: null,
    startedAt: "2026-07-30T10:02:00.000Z",
    itens: 0,
    falha: { motivo: "timeout", detalhe: "passou de 300s" },
  },
];

const custos = custosDaApify(log);
check("so runs com id e custo viram lancamento", custos.length === 2, custos);
check(
  "run FAILED cobrado entra no custo",
  custos.some((c) => c.ref === "run_fail" && c.custoUsd === 0.01),
  custos
);
// Se o parcial entrasse, o unique (provedor, ref) do custos_uso congelaria o
// valor incompleto pra sempre — e justamente no run mais caro, o que demorou.
check(
  "run em timeout NAO entra (valor parcial travaria o final)",
  !custos.some((c) => c.ref === "run_lento"),
  custos
);
check(
  "run que nao iniciou NAO entra",
  !custos.some((c) => c.ref === "NAO_INICIOU" || c.ref === ""),
  custos
);
// ocorrido_em tem que ser a hora da Apify, não a de agora: sem isso o custo
// histórico apareceria todo como gasto de hoje.
check(
  "ocorridoEm vem do startedAt do run",
  custos.find((c) => c.ref === "run_ok")?.ocorridoEm ===
    "2026-07-30T10:00:00.000Z",
  custos.find((c) => c.ref === "run_ok")
);
check(
  "detalhe carrega a fonte (e o que abre o custo por rede na tela)",
  custos.find((c) => c.ref === "run_ok")?.detalhe === "reddit"
);

// ── diagnóstico da coleta ─────────────────────────────────
const diag = diagnosticarColeta(log);
check("semSaldo detecta a lane recusada por pagamento", diag.semSaldo, diag);
check("conta todos os runs", diag.runs === 4, diag);
check("conta as falhas", diag.falhas === 3, diag);
check("soma o custo ignorando os null", Math.abs(diag.custoUsd - 0.06) < 1e-9, diag);
check("soma os itens coletados", diag.itens === 20, diag);
check("resumo cita as fontes que falharam", diag.resumo.includes("twitter(saldo)"), diag.resumo);

// Coleta 100% saudável não pode acusar problema de fatura.
const diagOk = diagnosticarColeta([log[0]]);
check("coleta sem falha nao acusa semSaldo", !diagOk.semSaldo, diagOk);
check("coleta sem falha nao lista falhas no resumo", !diagOk.resumo.includes("falha"), diagOk.resumo);

console.log(
  falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falhou.`
);
process.exit(falhas === 0 ? 0 : 1);

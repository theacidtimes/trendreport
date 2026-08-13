import type {
  InstagramItem,
  NewsItem,
  RawData,
  RedditItem,
  TikTokItem,
  TwitterItem,
} from "./types";
import { escolherLegenda, type SubtitleLink } from "./legendas";

const APIFY_BASE = "https://api.apify.com/v2";

// ── Execução de actor na Apify ─────────────────────────────────────────────
//
// Antes daqui usava-se `run-sync-get-dataset-items`: uma chamada só, que
// dispara o actor e já devolve os itens. Simples, e errado por dois motivos
// que só ficaram visíveis quando o cartão da ACID passou a bancar o plano
// inteiro:
//
//  1. O endpoint síncrono NÃO devolve o id do run — conferido na doc, ele só
//     expõe headers de paginação (X-Apify-Pagination-*). Sem run id não há
//     `usageTotalUsd`, e sem isso o custo do report não tem como ser ligado a
//     um tenant. Era a maior fatia do "NAO ATRIBUIDO" em /console/custos.
//  2. Qualquer falha virava uma exceção genérica que o `catch { return [] }`
//     de cada lane engolia. "Não achei nada sobre esse tema" e "a conta da
//     Apify está sem saldo" produziam exatamente o mesmo resultado: lista
//     vazia, zero log. O report saía magro e ninguém ficava sabendo — nem
//     nós, nem o cliente que recebeu a peça.
//
// Agora: POST /runs (com waitForFinish) → poll até estado terminal → GET dos
// itens do dataset. Três chamadas em vez de uma; em troca vêm o run id, o
// status terminal explícito e o dólar gasto.

// Teto do parâmetro waitForFinish na API da Apify (confirmado na doc: a espera
// acontece no servidor deles e é limitada a 60s POR CHAMADA). Por isso o poll
// abaixo não dorme: ele repete o GET com waitForFinish, que bloqueia lá.
const WAIT_FOR_FINISH_MAX = 60;

// Orçamento total por actor. Deliberadamente igual ao teto que o
// run-sync-get-dataset-items já impunha (300s), pra que este refactor NÃO
// mude quanto tempo a geração de um report pode demorar. É o tipo de efeito
// colateral que passa despercebido em teste e aparece como job estourando na
// Action.
const RUN_TIMEOUT_MS = 300_000;

// Quantas respostas ruins seguidas do poll antes de desistir de um run que já
// foi pago. Erro no poll é problema da API, não do actor.
const MAX_ERROS_POLL = 3;
const PAUSA_APOS_ERRO_MS = 5_000;

const ESTADOS_TERMINAIS = new Set([
  "SUCCEEDED",
  "FAILED",
  "ABORTED",
  "TIMED-OUT",
]);

/**
 * Concilia o custo lido no instante em que o run virou terminal com o custo
 * relido depois. MEDIDO CONTRA A APIFY REAL (run vg1Xgg71RYrvfVg5i): no
 * momento em que o status virou SUCCEEDED o `usageTotalUsd` era 0.0751 e
 * segundos depois assentou em 0.079 — 5,2% a mais. A contabilidade de eventos
 * cobrados fecha DEPOIS do status, não junto com ele.
 *
 * Isso importa porque `custos_uso` tem unique (provedor, ref) com upsert
 * ignoreDuplicates: o primeiro valor gravado é o valor para sempre. Sem esta
 * conciliação, todo run do sistema entraria subestimado — o mesmo alçapão que
 * já tratamos no timeout, só que atingindo TODOS os runs, inclusive os que
 * deram certo.
 *
 * Fica com o MAIOR dos dois, nunca com o mais recente: cobrança só cresce
 * (eventos são acumulados), então um valor menor na releitura é ruído de
 * leitura, não desconto.
 */
export function conciliarCusto(
  parcial: number | null,
  relido: number | null
): number | null {
  if (parcial === null) return relido;
  if (relido === null) return parcial;
  return Math.max(parcial, relido);
}

/** Campos do objeto `run` da Apify que nos interessam. */
export type RunApify = {
  id?: string;
  status?: string;
  statusMessage?: string;
  defaultDatasetId?: string;
  usageTotalUsd?: number;
  startedAt?: string;
};

export type MotivoFalha = "saldo" | "timeout" | "run_falhou" | "http";

/** Uma linha por run disparado numa coleta. É a matéria-prima do custo. */
export type ApifyRunInfo = {
  fonte: SourceName;
  actorId: string;
  runId: string | null;
  status: string;
  /** null quando o run não chegou a estado terminal (valor seria parcial). */
  custoUsd: number | null;
  startedAt: string | null;
  itens: number;
  falha: { motivo: MotivoFalha; detalhe: string } | null;
};

export type ApifyRunLog = ApifyRunInfo[];

type ContextoColeta = { fonte: SourceName; log?: ApifyRunLog };

/**
 * Lê o objeto `run` da Apify. Puro de propósito: é a peça que decide se
 * paramos de esperar, se o dado é confiável e quanto custou — e é a única
 * parte disto que dá pra testar sem uma conta com saldo.
 */
export function interpretarRun(run: RunApify | null | undefined) {
  const status = run?.status ?? "DESCONHECIDO";
  return {
    status,
    terminal: ESTADOS_TERMINAIS.has(status),
    ok: status === "SUCCEEDED",
    datasetId: run?.defaultDatasetId ?? null,
    // Só número conta. `undefined` de actor que não reporta uso não pode virar
    // 0, senão o painel de custo soma um zero falso e diz que saiu de graça.
    custoUsd: typeof run?.usageTotalUsd === "number" ? run.usageTotalUsd : null,
    startedAt: run?.startedAt ?? null,
  };
}

// A Apify tem uma lista enorme de `error.type`, e os que significam "esta conta
// não pode pagar por este run" variam conforme o plano (crédito pré-pago,
// limite mensal, actor pago não alugado): `not-enough-usage-to-run-paid-actor`,
// `x402-payment-required`, `insufficient-*`, `monthly-usage-*`... Fixar códigos
// exatos aqui envelheceria mal. Casamos por fragmento — e, principalmente, o
// corpo bruto da resposta é SEMPRE logado, então se a heurística errar o
// diagnóstico continua no log, só sem o rótulo.
const FRAGMENTOS_DE_SALDO = [
  "insufficient",
  "not-enough",
  "usage-limit",
  "limit-exceeded",
  "payment-required",
  "payment-method",
  "monthly-usage",
  "credit",
];

export function ehFalhaDeSaldo(httpStatus: number, corpo: string): boolean {
  // 402 é literalmente "Payment Required"; não precisa de heurística.
  if (httpStatus === 402) return true;
  const t = String(corpo || "").toLowerCase();
  return FRAGMENTOS_DE_SALDO.some((f) => t.includes(f));
}

async function runActor<T>(
  actorId: string,
  input: Record<string, unknown>,
  ctx?: ContextoColeta
): Promise<T[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN não configurado");
  }

  // Sem ctx não há onde registrar, e nesse caso NÃO inventamos uma fonte
  // padrão: um rótulo chutado viraria custo atribuído à rede errada na tela,
  // que é pior do que custo não atribuído (este a gente vê; aquele, não).
  const registrar = (info: Omit<ApifyRunInfo, "fonte" | "actorId">) => {
    if (!ctx?.log) return;
    ctx.log.push({ fonte: ctx.fonte, actorId, ...info });
  };

  // 1) Dispara o run. waitForFinish=60 economiza uma volta inteira de poll:
  //    a maioria dos actors deste report termina dentro disso.
  const startRes = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?token=${token}&waitForFinish=${WAIT_FOR_FINISH_MAX}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  if (!startRes.ok) {
    const corpo = (await startRes.text()).slice(0, 500);
    const saldo = ehFalhaDeSaldo(startRes.status, corpo);
    registrar({
      runId: null,
      status: "NAO_INICIOU",
      custoUsd: null,
      startedAt: null,
      itens: 0,
      falha: {
        motivo: saldo ? "saldo" : "http",
        detalhe: `HTTP ${startRes.status}: ${corpo}`,
      },
    });
    // O log é a única coisa que separa "sem saldo" de "sem resultado" pra quem
    // está olhando a Action depois. Por isso o corpo bruto vai junto.
    console.error(
      saldo
        ? `[APIFY][SALDO] ${actorId} NAO RODOU — a Apify recusou o run por ` +
            `motivo de conta/pagamento. O report VAI SAIR INCOMPLETO. ` +
            `HTTP ${startRes.status}: ${corpo}`
        : `[APIFY][FALHA] ${actorId} nao iniciou. HTTP ${startRes.status}: ${corpo}`
    );
    throw new Error(`Apify actor ${actorId} nao iniciou: ${startRes.status}`);
  }

  let run: RunApify = ((await startRes.json())?.data ?? {}) as RunApify;
  const runId = run.id ?? null;
  let estado = interpretarRun(run);

  // 2) Poll até estado terminal. Cada volta bloqueia no servidor da Apify via
  //    waitForFinish em vez de dormir aqui — menos requisição e resposta assim
  //    que o run acaba, em vez de esperar o próximo tick.
  const limite = Date.now() + RUN_TIMEOUT_MS;
  let errosDePoll = 0;
  let ultimoErroPoll = "";
  while (!estado.terminal && runId && Date.now() < limite) {
    const res = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}?token=${token}&waitForFinish=${WAIT_FOR_FINISH_MAX}`
    );
    if (!res.ok) {
      // Uma resposta ruim AQUI não diz nada sobre o run — ele continua vivo na
      // Apify. Desistir na primeira é jogar fora um scrape já pago por causa de
      // um soluço de rede. A pausa não é decorativa: sem ela, um erro
      // persistente vira laço apertado e queima os 300s de orçamento em
      // segundos, transformando "a API piscou" em "o actor não respondeu".
      ultimoErroPoll = `HTTP ${res.status}`;
      if (++errosDePoll >= MAX_ERROS_POLL) break;
      await new Promise((r) => setTimeout(r, PAUSA_APOS_ERRO_MS));
      continue;
    }
    errosDePoll = 0;
    run = ((await res.json())?.data ?? {}) as RunApify;
    estado = interpretarRun(run);
  }

  if (!estado.terminal) {
    // Desistimos por erro de poll ou por estouro de orçamento? São diagnósticos
    // diferentes (um é a API da Apify, outro é o actor demorando) e o log
    // precisa dizer qual foi.
    const desistiuPorErro = errosDePoll >= MAX_ERROS_POLL;
    // NÃO registramos custo aqui, de propósito. O run continua vivo lá e o
    // usageTotalUsd deste instante é parcial; como o unique (provedor, ref) do
    // custos_uso ignora duplicata, gravar o parcial agora TRAVARIA o valor
    // final pra sempre — e justamente no run mais caro, que é o que demorou.
    // Quem fecha essa conta é o scripts/backfill-custos.ts, que relê o valor
    // definitivo direto da Apify. Por isso o run id vai no log.
    registrar({
      runId,
      status: estado.status,
      custoUsd: null,
      startedAt: estado.startedAt,
      itens: 0,
      falha: {
        motivo: desistiuPorErro ? "http" : "timeout",
        detalhe: desistiuPorErro
          ? `poll falhou ${errosDePoll}x (ultimo: ${ultimoErroPoll})`
          : `passou de ${RUN_TIMEOUT_MS / 1000}s ainda em ${estado.status}`,
      },
    });
    console.error(
      `[APIFY][${desistiuPorErro ? "POLL" : "TIMEOUT"}] ${actorId} run=${runId} ` +
        `abandonado ainda em ${estado.status} ` +
        (desistiuPorErro
          ? `apos ${errosDePoll} erros consecutivos de poll (${ultimoErroPoll}). `
          : `apos ${RUN_TIMEOUT_MS / 1000}s. `) +
        `O run NAO foi abortado (termina sozinho) e o custo entra depois pelo ` +
        `backfill — ver scripts/backfill-custos.ts.`
    );
    throw new Error(`Apify actor ${actorId} nao terminou a tempo`);
  }

  // Estado terminal: vale registrar MESMO EM FALHA — a Apify cobra a taxa de
  // start por run iniciado (já visto na fatura: run FAILED custando $0,04).
  //
  // Mas o custo AINDA NÃO está fechado neste instante (ver conciliarCusto): o
  // status vira terminal antes de a contabilidade de eventos assentar. Por
  // isso o valor lido aqui é tratado como parcial e reconciliado com uma
  // releitura logo abaixo, sempre depois de algum outro trabalho de rede —
  // assim a Apify ganha tempo pra fechar a conta sem que a gente pague um
  // `sleep` por lane.
  const custoParcial = estado.custoUsd;

  const relerCusto = async (): Promise<number | null> => {
    try {
      const res = await fetch(
        `${APIFY_BASE}/actor-runs/${runId}?token=${token}`
      );
      if (!res.ok) return custoParcial;
      const novo = interpretarRun(
        ((await res.json())?.data ?? {}) as RunApify
      ).custoUsd;
      const final = conciliarCusto(custoParcial, novo);
      if (final !== custoParcial) {
        console.log(
          `[APIFY][CUSTO] ${actorId} run=${runId} custo assentou de ` +
            `${custoParcial} para ${final} USD apos o estado terminal.`
        );
      }
      return final;
    } catch {
      // Releitura é melhoria de precisão, não requisito: se ela falhar fica o
      // parcial, que é o que teríamos de qualquer jeito antes desta mudança.
      return custoParcial;
    }
  };

  if (!estado.ok || !estado.datasetId) {
    const detalhe = run.statusMessage ?? "sem statusMessage";
    // Aqui não há dataset pra buscar, então a releitura é a única chamada de
    // rede entre o terminal e o registro. Vale mesmo assim: run que falhou
    // tarde já acumulou evento cobrado.
    const custoUsd = await relerCusto();
    registrar({
      runId,
      status: estado.status,
      startedAt: estado.startedAt,
      custoUsd,
      itens: 0,
      falha: { motivo: "run_falhou", detalhe: `${estado.status}: ${detalhe}` },
    });
    console.error(
      `[APIFY][FALHA] ${actorId} run=${runId} terminou em ${estado.status} ` +
        `(${detalhe}). Custo do run: ${custoUsd ?? "?"} USD.`
    );
    throw new Error(`Apify actor ${actorId} terminou em ${estado.status}`);
  }

  // 3) Itens do dataset. Sem parâmetro extra de propósito: os defaults aqui
  //    são os mesmos que o run-sync-get-dataset-items aplicava, então o
  //    formato do que chega nas lanes não muda com este refactor.
  const itemsRes = await fetch(
    `${APIFY_BASE}/datasets/${estado.datasetId}/items?token=${token}`
  );
  if (!itemsRes.ok) {
    const corpo = (await itemsRes.text()).slice(0, 300);
    registrar({
      runId,
      status: estado.status,
      startedAt: estado.startedAt,
      custoUsd: await relerCusto(),
      itens: 0,
      falha: {
        motivo: "http",
        detalhe: `dataset ${estado.datasetId}: HTTP ${itemsRes.status} ${corpo}`,
      },
    });
    console.error(
      `[APIFY][FALHA] ${actorId} rodou e foi COBRADO, mas o dataset ` +
        `${estado.datasetId} nao pode ser lido: HTTP ${itemsRes.status} ${corpo}`
    );
    throw new Error(`Apify dataset ${estado.datasetId}: ${itemsRes.status}`);
  }

  const items = (await itemsRes.json()) as T[];
  // A releitura acontece DEPOIS do download do dataset de propósito: esse
  // download já consumiu o tempo que a Apify precisava pra fechar a conta, e
  // foi exatamente assim que a diferença 0.0751 → 0.079 apareceu na medição.
  registrar({
    runId,
    status: estado.status,
    startedAt: estado.startedAt,
    custoUsd: await relerCusto(),
    itens: items.length,
    falha: null,
  });
  return items;
}

// Cada lane devolve [] quando falha, e é isso que permite ao report sair com 4
// fontes em vez de não sair — decisão antiga e correta. O que não pode é a
// falha ser SILENCIOSA, que era o caso do `catch { return [] }` anterior.
function laneVazia(fonte: SourceName, e: unknown): never[] {
  console.error(
    `[APIFY][${fonte}] lane volta VAZIA — o report perde esta fonte: ` +
      (e instanceof Error ? e.message : String(e))
  );
  return [];
}

export type DiagnosticoColeta = {
  runs: number;
  falhas: number;
  itens: number;
  custoUsd: number;
  /** Alguma lane foi recusada por motivo de conta/pagamento na Apify. */
  semSaldo: boolean;
  resumo: string;
};

/**
 * Condensa o log de runs num diagnóstico. Existe pra que a camada de cima
 * possa dizer a VERDADE quando o report sai vazio: "sem saldo na Apify" e
 * "falha temporária, tente de novo" pedem reações opostas do operador, e até
 * agora as duas produziam a mesma mensagem.
 */
export function diagnosticarColeta(log: ApifyRunLog): DiagnosticoColeta {
  const falhas = log.filter((r) => r.falha);
  const semSaldo = falhas.some((r) => r.falha?.motivo === "saldo");
  const custoUsd = log.reduce((s, r) => s + (r.custoUsd ?? 0), 0);
  const itens = log.reduce((s, r) => s + r.itens, 0);
  const porFonte = falhas
    .map((r) => `${r.fonte}(${r.falha!.motivo})`)
    .join(", ");
  return {
    runs: log.length,
    falhas: falhas.length,
    itens,
    custoUsd,
    semSaldo,
    resumo:
      `${log.length} run(s) na Apify, ${itens} itens, ` +
      `US$${custoUsd.toFixed(4)}` +
      (falhas.length ? ` — ${falhas.length} falha(s): ${porFonte}` : ""),
  };
}

// Perfis validados manualmente (contas públicas, ativas, alto volume de posts)
// cobrindo esporte, humor/entretenimento e notícias/cultura pop. Instagram não
// permite busca confiável por hashtag/palavra-chave via scraper, então usamos
// esta lista fixa como sinal de tendência visual; a busca dinâmica por
// briefing acontece no TikTok (ver fetchTikTok).
// Contas cuja unidade de publicação é o meme em si (formato replicável, bordão,
// áudio, imagem-modelo). Ficam separadas porque a seção de memes do report
// depende de oferta vinda daqui: no volume de likes elas perdem para g1 e
// flamengo, então o consumidor precisa saber a procedência pra reservar espaço.
const INSTAGRAM_MEME_PROFILES = [
  "saquinhodelixo",
  "meltedvideos",
  "pleasecome2br",
  "brazilianversion",
  "divadepressao",
];

const INSTAGRAM_GERAL_PROFILES = [
  "g1",
  "netflixbrasil",
  "portadosfundos",
  "flamengo",
  "buzzfeedbrasil",
  "sportv",
  "espnbrasil",
  // cinema/séries/games/música/cultura pop
  "omelete",
  "jovemnerd",
  "ignbrasil",
  "rollingstonebrasil",
  "adrenaline_oficial",
  "voxeloficial",
  "papelpop",
];

const INSTAGRAM_BASE_PROFILES = [
  ...INSTAGRAM_GERAL_PROFILES,
  ...INSTAGRAM_MEME_PROFILES,
];

const MEME_PROFILE_SET = new Set(INSTAGRAM_MEME_PROFILES);

function fonteDoPerfil(username?: string): InstagramItem["fonte"] {
  return MEME_PROFILE_SET.has(username ?? "") ? "meme" : "geral";
}

interface RawInstagramItem {
  error?: string;
  caption?: string;
  likesCount?: number;
  url?: string;
  displayUrl?: string;
  hashtags?: string[];
  ownerUsername?: string;
  type?: string;
  timestamp?: string;
}

// O scraper devolve os N últimos posts do perfil sem aceitar filtro de data no
// input, então a recência é aplicada aqui. Sem isso entrava post de semanas
// atrás em report do dia (já saiu corte de jogo de duas semanas antes como se
// fosse do momento). Os perfis da lista postam todo dia, então 7 dias não
// esvazia a coleta. Item sem timestamp é mantido (não dá pra afirmar que é
// velho), mesmo critério já usado no News.
const INSTAGRAM_MAX_AGE_DAYS = 7;

function isRecentInstagram(timestamp?: string): boolean {
  if (!timestamp) return true;
  const posted = new Date(timestamp).getTime();
  if (Number.isNaN(posted)) return true;
  const ageDays = (Date.now() - posted) / 86_400_000;
  return ageDays <= INSTAGRAM_MAX_AGE_DAYS;
}

export async function fetchInstagram(
  log?: ApifyRunLog
): Promise<InstagramItem[]> {
  try {
    const raw = await runActor<RawInstagramItem>(
      "apify~instagram-scraper",
      {
        directUrls: INSTAGRAM_BASE_PROFILES.map(
          (username) => `https://www.instagram.com/${username}/`
        ),
        resultsType: "posts",
        resultsLimit: 3,
      },
      { fonte: "instagram", log }
    );

    return raw
      .filter(
        (item) =>
          !item.error && item.displayUrl && isRecentInstagram(item.timestamp)
      )
      .map((item) => ({
        caption: item.caption,
        // O Instagram devolve -1 quando o perfil esconde a contagem de likes.
        // Mantido como undefined pra não virar engajamento negativo no ranking
        // e empurrar o post pro fim da fila por um dado que não existe.
        likesCount:
          typeof item.likesCount === "number" && item.likesCount >= 0
            ? item.likesCount
            : undefined,
        url: item.url,
        displayUrl: item.displayUrl,
        hashtags: item.hashtags,
        ownerUsername: item.ownerUsername,
        type: item.type,
        fonte: fonteDoPerfil(item.ownerUsername),
      }));
  } catch (e) {
    return laneVazia("instagram", e);
  }
}

interface RawTikTokItem {
  text?: string;
  textLanguage?: string;
  createTimeISO?: string;
  webVideoUrl?: string;
  diggCount?: number;
  playCount?: number;
  isAd?: boolean;
  isSponsored?: boolean;
  authorMeta?: { nickName?: string };
  videoMeta?: {
    coverUrl?: string;
    duration?: number;
    subtitleLinks?: SubtitleLink[] | null;
  };
  hashtags?: { name?: string }[];
  musicMeta?: {
    musicName?: string;
    musicAuthor?: string;
    musicId?: string;
    musicOriginal?: boolean;
  };
}

// Âncora de idioma portada do radar (ver collectData.ts). A busca do TikTok é
// aberta e, mesmo com proxyCountryCode BR, ainda cola viral gringo (EN/ES) no
// resultado. Marcadores de português (palavras-função + diacríticos) separam PT
// de outros idiomas em legenda curta: 2+ ocorrências já bastam. Barato e sem
// dependência. É marca-agnóstico — vale pra qualquer cliente.
const PT_MARKERS =
  /\b(que|n[ãa]o|com|para|uma?|isso|voc[êe]s?|est[áa]|s[ãa]o|mais|muito|por|ent[ãa]o|porque|tamb[ée]m|mas|meu|minha|pra|vc)\b/gi;
const PT_DIACRITICS = /[ãõçáéíóúâêôà]/gi;

function isPortuguese(text: string): boolean {
  const t = String(text || "");
  if (t.length < 8) return false;
  const hits =
    (t.match(PT_MARKERS) || []).length + (t.match(PT_DIACRITICS) || []).length;
  return hits >= 2;
}

// Mesma janela e mesma regra do Instagram, por um motivo diferente: lá o input
// não aceita filtro de data, aqui o input ACEITA mas o actor desativou (ver
// fetchTikTok). O efeito prático é o mesmo — a recência é responsabilidade
// nossa. Item sem data é mantido: não dá pra afirmar que é velho.
const TIKTOK_MAX_AGE_DAYS = 7;

function isRecentTikTok(createTimeISO?: string): boolean {
  if (!createTimeISO) return true;
  const posted = new Date(createTimeISO).getTime();
  if (Number.isNaN(posted)) return true;
  const ageDays = (Date.now() - posted) / 86_400_000;
  return ageDays <= TIKTOK_MAX_AGE_DAYS;
}

export async function fetchTikTok(
  keywords: string[],
  log?: ApifyRunLog
): Promise<TikTokItem[]> {
  try {
    const input = {
      searchQueries: keywords,
      searchSection: "/video",
      // Trend é repetição (ver detectarClusters), e repetição é estatística: com
      // 5 por keyword o report tinha ~50 vídeos divididos em até 10 termos
      // (social + adjacent), e dois criadores distintos caírem no mesmo áudio
      // dentro de uma fatia de 5 é raro demais. O clustering existia mas não
      // tinha amostra pra enxergar nada. A ~$0.006 por vídeo (tier BRONZE,
      // resultado + add-ons de data/ordenação/país), 20 dá ~200 vídeos e
      // ~$1.20 por report.
      resultsPerPage: 20,
      // ATENÇÃO: videoSearchSorting e videoSearchDateFilter estão marcados
      // "UNDER MAINTENANCE: TEMPORARILY BLOCKED" no inputSchema do actor —
      // conferido via fetch-actor-details. Ou seja: são ACEITOS sem erro e
      // IGNORADOS, e o padrão real de data volta a ser ALL_TIME. Ficam aqui
      // porque voltam a valer sozinhos quando o actor destravar, mas NÃO
      // conte com eles: a recência de verdade é o isRecentTikTok() no filtro
      // abaixo. Se remover o filtro achando que estes campos resolvem, o
      // report volta a entregar viral antigo em silêncio.
      videoSearchSorting: "MOST_RELEVANT",
      videoSearchDateFilter: "PAST_WEEK",
      // Este funciona: sem ele a busca volta conteúdo global em vez do feed BR.
      proxyCountryCode: "BR",
      // Traz a legenda que o próprio TikTok já gerou. Sem isto a relevância do
      // vídeo é julgada só pela caption ("kkkk #fyp") enquanto o conteúdo está
      // na fala — a causa estrutural do "tema certo, conteúdo irrelevante".
      //
      // Conferido em fetch-actor-details ANTES de ligar (a lição do
      // videoSearchSorting): o campo NÃO está sob manutenção, o enum aceita
      // este valor, e a tabela de preços do actor não tem evento de cobrança
      // para legenda — só para "Add-on: Transcript", que é o
      // TRANSCRIBE_ALL_VIDEOS ($0,034/min/vídeo no nosso tier, >$6 por report)
      // e por isso NÃO é o valor usado aqui.
      //
      // O que volta é `videoMeta.subtitleLinks` — URL, não texto. Quem baixa é
      // lib/legendas.ts, depois do trimForModel.
      downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES",
    };
    const raw = await runActor<RawTikTokItem>(
      "clockworks~tiktok-scraper",
      input,
      { fonte: "tiktok", log }
    );

    return raw
      .filter(
        (item) =>
          item.webVideoUrl &&
          item.videoMeta?.coverUrl &&
          // Anúncio não é cultura. Peça paga que casa com a keyword é o caso
          // clássico de "tema certo, conteúdo irrelevante" apontado no feedback:
          // entra no report como se fosse comportamento espontâneo, e ainda
          // sujaria o clustering (som licenciado de campanha reaparecendo em
          // vários anúncios pareceria trend orgânica).
          !item.isAd &&
          !item.isSponsored &&
          // O corte de recência que o actor deveria ter feito na busca. Sem
          // isto o clustering acha "trend" em som viral de meses atrás: como o
          // filtro de data está desativado na origem, todo o histórico entra
          // no mesmo balaio e a repetição acumulada de um hit antigo vence a
          // repetição recente de uma trend de verdade.
          isRecentTikTok(item.createTimeISO) &&
          // Mantém só conteúdo PT: textLanguage do próprio TikTok como atalho, ou
          // a heurística na legenda. Sem isso entrava viral gringo na busca aberta.
          (item.textLanguage === "pt" || isPortuguese(item.text ?? ""))
      )
      .map((item) => ({
        text: item.text,
        webVideoUrl: item.webVideoUrl,
        coverUrl: item.videoMeta?.coverUrl,
        authorNickName: item.authorMeta?.nickName,
        diggCount: item.diggCount,
        playCount: item.playCount,
        hashtags: (item.hashtags ?? [])
          .map((h) => h.name)
          .filter((name): name is string => Boolean(name)),
        // O áudio é a identidade da trend no TikTok: numa trend de som (o
        // exemplo do saxofone) o que une os vídeos não é a legenda nem a
        // hashtag, é o musicId. Sem guardar isso não há como reconhecer que
        // dois vídeos são o mesmo fenômeno.
        musicId: item.musicMeta?.musicId,
        musicName: item.musicMeta?.musicName,
        musicAuthor: item.musicMeta?.musicAuthor,
        musicOriginal: item.musicMeta?.musicOriginal,
        createTimeISO: item.createTimeISO,
        // Alimenta a checagem de molde vs. papel de parede (ver ClusterTrend).
        duration: item.videoMeta?.duration,
        // Só a URL escolhida, não a lista: o download acontece bem depois, e
        // apenas para os vídeos que sobrarem do trimForModel (ver
        // lib/legendas.ts). Baixar as ~200 da coleta seria jogar fora o
        // trabalho dos ~150 que o modelo nunca vê.
        subtitleUrl: escolherLegenda(item.videoMeta?.subtitleLinks) ?? undefined,
      }));
  } catch (e) {
    return laneVazia("tiktok", e);
  }
}

interface RawTweet {
  text?: string;
  fullText?: string;
  url?: string;
  twitterUrl?: string;
  author?: { userName?: string; possiblySensitive?: boolean };
  likeCount?: number;
  replyCount?: number;
  possiblySensitive?: boolean;
}

export async function fetchTwitter(
  keywords: string[],
  log?: ApifyRunLog
): Promise<TwitterItem[]> {
  const query = keywords
    .slice(0, 3)
    .map((k) => k.trim())
    .filter(Boolean)
    .join(" OR ");
  if (!query) return [];
  try {
    const raw = await runActor<RawTweet>(
      "apidojo~tweet-scraper",
      {
        searchTerms: [query],
        maxItems: 20,
        sort: "Top",
        tweetLanguage: "pt",
      },
      { fonte: "twitter", log }
    );
    return raw
      // O tweet-scraper NÃO tem filtro de conteúdo sensível na entrada (conferido
      // no inputSchema), e X é a plataforma que mais libera conteúdo adulto — busca
      // por keyword aqui é a porta de entrada mais provável de NSFW no report.
      // Corta-se pelos dois lados: o tweet marcado como sensível e o autor marcado
      // como sensível (perfil adulto cujo post individual não veio marcado).
      .filter((item) => !item.possiblySensitive && !item.author?.possiblySensitive)
      .map((item) => {
        const text = String(item.text ?? item.fullText ?? "")
          .replace(/\s+/g, " ")
          .trim();
        const author = item.author?.userName
          ? `@${item.author.userName}`
          : undefined;
        return {
          text,
          url: item.url ?? item.twitterUrl ?? "",
          author,
          likeCount: item.likeCount,
          replyCount: item.replyCount,
        };
      })
      .filter((t) => t.text && t.url);
  } catch (e) {
    return laneVazia("twitter", e);
  }
}

interface RawNewsResult {
  title?: string;
  link?: string;
  source?: string;
  snippet?: string;
  date?: string;
}

// Cada item do dataset representa uma página de busca, com os resultados de
// notícia de verdade aninhados em news_results[] (não um item plano por notícia).
interface RawNewsPage {
  error?: boolean;
  news_results?: RawNewsResult[];
}

// O actor devolve data relativa em PT ("6 dias atrás", "2 meses atrás") e NÃO
// aceita filtro de recência no input — o operador `when:Nd` na query zera o run
// inteiro (testado). Então a recência é aplicada aqui: descartamos o que for
// claramente velho (meses/anos), mantendo horas/dias/semanas. Item sem data é
// mantido (não dá pra afirmar que é velho).
function isRecentNews(date?: string): boolean {
  if (!date) return true;
  // Corte só do claramente velho: "N meses atrás" (2+) e "ano(s) atrás".
  // "1 mês atrás" pra baixo (semanas/dias/horas) fica — News já é fonte magra
  // e cortar o mês inteiro arriscava zerar em cliente de nicho.
  return !/\b(meses|anos?)\b/i.test(date);
}

// Matérias que a News pode considerar recente por causa da recência do sistema.
const NEWS_MAX_AGE_DAYS = 45;

// O GoogleNewsAPI mente sobre recência: já vimos matéria de 9 meses atrás vir
// rotulada como "há 10 horas" (o Google reindexa/reserve artigo antigo como
// fresco). A data de publicação REAL só existe na página do artigo, no JSON-LD
// `datePublished` ou na meta `article:published_time`. Buscamos a página e lemos
// essa data pra descartar o que a fonte disfarçou de novo. Timeout curto; se a
// página não expõe data confiável, mantemos (não dá pra afirmar que é velha).
// A imagem sai do MESMO fetch da data: o GoogleNewsAPI não devolve thumbnail
// (conferido no output schema do actor), então sem isto todo card de news nasce
// sem imagem — eram 12 dos 16 cards órfãos do acervo. Como a página do artigo já
// está sendo baixada aqui pra conferir a data, ler a og:image não custa nenhuma
// requisição a mais.
async function metadadosDoArtigo(
  url: string
): Promise<{ publicadoEm: Date | null; imagem: string | null }> {
  const vazio = { publicadoEm: null, imagem: null };
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return vazio;
    const html = await res.text();
    return extrairMetadados(html, res.url || url);
  } catch {
    return vazio;
  }
}

// Separado da chamada de rede pra poder ser testado contra HTML real: a parte
// que quebra em silêncio aqui é o regex — se a meta tag do veículo tiver os
// atributos em outra ordem, a extração devolve null sem erro nenhum e o card
// volta a nascer sem imagem, exatamente o bug que este código conserta.
export function extrairMetadados(
  html: string,
  baseUrl: string
): { publicadoEm: Date | null; imagem: string | null } {
  const m =
    html.match(/"datePublished"\s*:\s*"([^"]{10,40})"/i) ??
    html.match(/property="article:published_time"\s+content="([^"]{10,40})"/i) ??
    html.match(/content="([^"]{10,40})"\s+property="article:published_time"/i);
  const d = m ? new Date(m[1]) : null;

  // Os dois primeiros cobrem og:image com os atributos em qualquer ordem —
  // veículo que gera a tag como content-antes-de-property é comum o bastante
  // pra não dar pra assumir uma só. twitter:image é o último recurso.
  const img =
    html.match(/property="og:image"\s+content="([^"]{10,600})"/i) ??
    html.match(/content="([^"]{10,600})"\s+property="og:image"/i) ??
    html.match(/name="twitter:image"\s+content="([^"]{10,600})"/i);

  return {
    publicadoEm: d && !isNaN(d.getTime()) ? d : null,
    // og:image relativa existe e viraria link quebrado no report; resolvemos
    // contra a URL do artigo (após redirects) em vez de descartar.
    imagem: img ? absolutizar(img[1], baseUrl) : null,
  };
}

function absolutizar(src: string, base: string): string | null {
  try {
    return new URL(src.replace(/&amp;/g, "&"), base).toString();
  } catch {
    return null;
  }
}

// Uma query só com todos os keywords juntos costuma ficar longa demais e não
// bate com nada no Google News. Buscamos por keyword separadamente e juntamos
// os resultados (dedupe por link) pra cobrir mais terreno.
export async function fetchNews(
  keywords: string[],
  log?: ApifyRunLog
): Promise<NewsItem[]> {
  const queries = keywords.slice(0, 3);

  const results = await Promise.all(
    queries.map((q) =>
      runActor<RawNewsPage>(
        "johnvc~GoogleNewsAPI",
        { q, gl: "br", hl: "pt-br", max_pages: 1 },
        { fonte: "news", log }
      ).catch((e) => laneVazia("news", e) as RawNewsPage[])
    )
  );

  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const page of results.flat()) {
    if (page.error) continue;
    for (const item of page.news_results ?? []) {
      if (!item.title || !item.link || seen.has(item.link)) continue;
      if (!isRecentNews(item.date)) continue;
      seen.add(item.link);
      merged.push({
        title: item.title,
        link: item.link,
        source: item.source,
        snippet: item.snippet,
        date: item.date,
      });
    }
  }

  // Segunda passada: confere a data de publicação REAL na página do artigo pra
  // barrar o que o Google devolveu como fresco mas na verdade é antigo.
  const cutoff = Date.now() - NEWS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const checked = await Promise.all(
    merged.map(async (item) => {
      const { publicadoEm, imagem } = await metadadosDoArtigo(item.link!);
      if (publicadoEm && publicadoEm.getTime() < cutoff) return null;
      return imagem ? { ...item, imagem } : item;
    })
  );
  return checked.filter((x): x is NewsItem => x !== null);
}

// Reddit é nossa fonte "under the radar" pra sinal fraco: em vez de busca
// global cega por palavra-chave (pouco sinal útil), monitoramos megacomunidades
// BR fixas, cada uma cobrindo um território de comportamento diferente —
// lifestyle real, desabafos, conexão/home office, cultura pop/streaming e
// perrengues de viagem. O insight de verdade mora nos comentários mais votados.
const REDDIT_SUBS_GERAL = [
  "eu_nvr",
  "conversas",
  "InternetBrasil",
  "gamesEcultura",
  "viagens",
];

// Lane de meme, separada da geral porque alimenta memes[] e não tendencias[].
// Handles validados por dois sinais cada (weeklyActiveUsers + weeklyContributions),
// não por "a requisição respondeu": HUEstation ~68k ativos/1.283 posts por semana,
// DiretoDoZapZap ~46k/890. Ambos SFW. Ficaram de fora: MemeBR e zueira (existem
// mas estão mortos, 0 contribuições na semana) e InternetBrasil, que apesar do
// nome é suporte de provedor, não meme — por isso segue na lista geral.
const REDDIT_SUBS_MEME = ["HUEstation", "DiretoDoZapZap"];

// COMENTÁRIO VIRA ITEM. Este actor não devolve os comentários aninhados dentro
// do post: ele grava cada comentário como um item separado do dataset, ligado ao
// post por `postId` (o outputSchema tem parentId/depth/postId e NÃO tem um campo
// `comments`; o readme descreve a árvore de comentários como entidade extraída).
// Duas consequências, as duas caras:
//   1) `maxItems` é teto de dataset INTEIRO, então os comentários disputam vaga
//      com os posts. Com teto de 15 e 10 comentários por post no default, a
//      coleta gastava a cota quase toda em comentário e entregava um punhado de
//      posts — de 5 subs vinham 2 ou 3.
//   2) O actor cobra POR ITEM GRAVADO ($0.0038), inclusive comentário.
// Por isso a cota abaixo é calculada, não chutada: posts × (1 + comentários).
const REDDIT_POSTS_POR_SUB = 4;
const REDDIT_COMENTARIOS_POR_POST = 5;

interface RawRedditComment {
  body?: string;
  upVotes?: number;
}

export interface RawRedditItem {
  dataType?: string;
  title?: string;
  communityName?: string;
  url?: string;
  permalink?: string;
  upVotes?: number;
  numberOfComments?: number;
  comments?: RawRedditComment[];
  over18?: boolean;
  imageUrls?: string[];
  createdAt?: string;
  // Campos de item-comentário: `body` é o texto e `postId` aponta pro post dono.
  id?: string;
  body?: string;
  postId?: string;
}

// O `postId` do comentário pode vir com o prefixo de tipo do Reddit (t3_) que o
// `id` do post não tem. Normalizar dos dois lados evita um join que falha em
// silêncio — e falha em silêncio aqui significa post chegando sem discussão.
const idBase = (id?: string) => (id ?? "").replace(/^t3_/, "");

// Só mídia hospedada no próprio Reddit. imageUrls[0] NÃO serve como atalho: no
// item de post o primeiro elemento costuma ser o ícone da comunidade, então
// índice fixo publica o avatar do sub no lugar do meme. O resto do array é
// thumbnail de link externo, que quebra ou vem em resolução de ícone.
function imagemDoPost(urls?: string[]): string | undefined {
  return (urls ?? []).find(
    (u) => u.includes("i.redd.it") || u.includes("preview.redd.it")
  );
}

// Mesma regra dos outros lanes. Aqui é rede de segurança e não filtro principal:
// `sort: "hot"` já tende ao recente, mas o `time` do actor é parâmetro de BUSCA e
// o Reddit ignora janela de tempo em listagem "hot" — ou seja, não há corte de
// data garantido na origem. Meme velho é o pior caso possível pra memes[].
const REDDIT_MAX_AGE_DAYS = 7;

function isRecentReddit(createdAt?: string): boolean {
  if (!createdAt) return true;
  const posted = new Date(createdAt).getTime();
  if (Number.isNaN(posted)) return true;
  return (Date.now() - posted) / 86_400_000 <= REDDIT_MAX_AGE_DAYS;
}

// Separado da chamada de rede pra poder ser testado: o join post↔comentário por
// postId é a peça que, se quebrar, não levanta erro nenhum — só devolve post sem
// discussão, exatamente como o bug que este código conserta.
export function montarPostsReddit(
  raw: RawRedditItem[],
  fonte: "meme" | "geral"
): RedditItem[] {
  // Os comentários chegam como itens irmãos dos posts, então a discussão é
  // remontada aqui antes de qualquer corte.
  const porPost = new Map<string, RawRedditComment[]>();
  for (const item of raw) {
    if (item.dataType === "post" || !item.body || !item.postId) continue;
    const chave = idBase(item.postId);
    const lista = porPost.get(chave) ?? [];
    lista.push({ body: item.body, upVotes: item.upVotes });
    porPost.set(chave, lista);
  }

  return raw
    .filter(
      (item) =>
        item.dataType === "post" &&
        item.title &&
        isRecentReddit(item.createdAt) &&
        // Cinto e suspensório: `includeNSFW: false` age do lado do actor e
        // depende de o Reddit marcar a comunidade. Este segundo corte usa a
        // marcação do próprio post, então post adulto dentro de sub SFW
        // (repost, troll) também cai.
        !item.over18
    )
    .map((item) => {
      // Pega os 4 comentários mais votados da thread, limpa o texto e "mastiga"
      // a discussão dentro do próprio title — assim o Claude recebe o debate
      // real sem precisarmos mexer na estrutura de tipos do RedditItem.
      // `item.comments` fica como plano A caso o actor volte a aninhar; hoje
      // quem entrega é o agrupamento por postId.
      const topComentarios = (item.comments ?? porPost.get(idBase(item.id)) ?? [])
        .slice()
        .sort((a, b) => (b.upVotes ?? 0) - (a.upVotes ?? 0))
        .slice(0, 4)
        .map((c) => (c.body ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" | ");

      const title = topComentarios
        ? `${item.title} [Fórum/Discussão Real: ${topComentarios}]`
        : item.title;

      return {
        title,
        communityName: item.communityName,
        url: item.url ?? item.permalink,
        upVotes: item.upVotes,
        numberOfComments: item.numberOfComments,
        imageUrl: imagemDoPost(item.imageUrls),
        fonte,
      };
    });
}

async function coletarSubs(
  subs: string[],
  fonte: "meme" | "geral",
  posts: number,
  comentariosPorPost: number,
  log?: ApifyRunLog
): Promise<RedditItem[]> {
  try {
    const input = {
      startUrls: subs.map((sub) => ({
        url: `https://www.reddit.com/r/${sub}/`,
      })),
      sort: "hot",
      time: "day",
      includeMediaLinks: true,
      skipComments: comentariosPorPost === 0,
      maxComments: comentariosPorPost,
      // A metadata da comunidade (membros, ativos por semana) vira ITEM no
      // dataset e consome a mesma cota dos posts — 5 subs gastavam 5 das 15
      // vagas com registros que o filtro de `dataType === "post"` joga fora logo
      // em seguida. Útil pra validar handle na mão, inútil dentro do report.
      skipCommunity: true,
      // NUNCA remover. O default do actor é `true`, e o Reddit BR tem comunidade
      // adulta com mais gente ativa por semana do que qualquer sub de meme
      // (Delicias_do_Brasil: ~160k). Report é peça que vai pra cliente: conteúdo
      // NSFW aqui não é ruído, é incidente.
      includeNSFW: false,
      maxItems: subs.length * posts * (1 + comentariosPorPost),
      maxPostCount: posts,
    };
    const raw = await runActor<RawRedditItem>(
      "trudax~reddit-scraper-lite",
      input,
      { fonte: "reddit", log }
    );

    return montarPostsReddit(raw, fonte);
  } catch (e) {
    return laneVazia("reddit", e);
  }
}

export async function fetchReddit(log?: ApifyRunLog): Promise<RedditItem[]> {
  // Duas execuções em vez de uma lista só: como o teto do actor é de dataset
  // inteiro, juntar as duas lanes faria a geral (5 subs, muito mais volume)
  // engolir a cota da de meme (2 subs). Rodando separado cada lane tem teto
  // próprio e o preço não muda — o actor cobra por resultado, e o número de
  // resultados é o mesmo. Em paralelo pra não somar latência.
  const [geral, meme] = await Promise.all([
    coletarSubs(
      REDDIT_SUBS_GERAL,
      "geral",
      REDDIT_POSTS_POR_SUB,
      REDDIT_COMENTARIOS_POR_POST,
      log
    ),
    // Sem comentários e com mais posts: em sub de meme o valor está na imagem e
    // no título (é a piada inteira), enquanto a caixa de comentários é reação
    // solta. Como comentário é item cobrado, cortá-los aqui paga mais post.
    coletarSubs(REDDIT_SUBS_MEME, "meme", 6, 0, log),
  ]);
  return [...geral, ...meme];
}

export type SourceName = "instagram" | "tiktok" | "twitter" | "news" | "reddit";

// As 5 fontes rodam em paralelo (Promise.all), então não têm uma ordem fixa
// de conclusão — o onProgress é chamado assim que CADA UMA termina (sucesso
// ou falha tratada), na ordem real em que os scrapers respondem. É isso que
// alimenta a barra de progresso real na interface (ver ProcessLoader).
async function track<T>(
  name: SourceName,
  promise: Promise<T>,
  onProgress?: (source: SourceName) => void
): Promise<T> {
  const result = await promise;
  onProgress?.(name);
  return result;
}

// Termos por lane. social (tiktok/twitter) recebe meme/hashtag/IP direto do
// briefing; adjacent traz o ENTORNO cultural (nostalgia, hype de lançamento
// vizinho, hábitos do público) e TAMBÉM alimenta tiktok/twitter, ampliando a
// rede além das menções diretas — é o que diferencia isto de um monitoramento
// de marca comum. news recebe query jornalística. Instagram e Reddit usam
// perfis/subs fixos e ignoram termos de busca.
export type SearchTerms = { social: string[]; news: string[]; adjacent: string[] };

// `log` é opcional e sempre fornecido pelo gerador de report: é por ele que o
// run id de cada actor sobe até quem tem o tenant em mãos e sabe gravar o
// custo. A coleta em si não conhece Supabase nem tenant — de propósito, senão
// este arquivo vira dependente do banco só pra contabilizar.
export async function collectAll(
  terms: SearchTerms,
  onProgress?: (source: SourceName) => void,
  log?: ApifyRunLog
): Promise<RawData> {
  // As buscas sociais recebem os termos diretos MAIS os adjacentes: as diretas
  // trazem o IP/marca, as adjacentes trazem a conversa em volta. Dedupe + teto
  // pra não estourar tempo/custo do scraper (cada query roda uma página).
  const socialTerms = Array.from(
    new Set(
      [...terms.social, ...terms.adjacent].map((t) => t.trim()).filter(Boolean)
    )
  ).slice(0, 10);

  const [instagram, tiktok, twitter, news, reddit] = await Promise.all([
    track("instagram", fetchInstagram(log), onProgress),
    track("tiktok", fetchTikTok(socialTerms, log), onProgress),
    track("twitter", fetchTwitter(socialTerms, log), onProgress),
    track("news", fetchNews(terms.news, log), onProgress),
    track("reddit", fetchReddit(log), onProgress),
  ]);

  return { instagram, tiktok, twitter, news, reddit };
}

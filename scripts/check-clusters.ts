import { detectarClusters, topTikTok } from "../lib/generateReport";
import type { TikTokItem } from "../lib/types";

// Helper por opções: o cluster passou a ser qualificado por duração, hashtag,
// engajamento e transbordo, então posicional viraria uma fila de undefined.
const v = (o: {
  id: string;
  autor: string;
  music?: string;
  original?: boolean;
  tags?: string[];
  diggCount?: number;
  duration?: number;
}): TikTokItem => ({
  webVideoUrl: `https://tiktok.com/${o.id}`,
  authorNickName: o.autor,
  musicId: o.music,
  musicName: o.music ? `som ${o.music}` : undefined,
  musicAuthor: o.original ? o.autor : undefined,
  musicOriginal: o.original ?? false,
  hashtags: o.tags ?? [],
  diggCount: o.diggCount ?? 0,
  duration: o.duration,
});

let falhas = 0;
const check = (nome: string, ok: boolean, extra?: unknown) => {
  if (!ok) falhas++;
  console.log(`${ok ? "PASS" : "FALHA"}  ${nome}`);
  if (!ok) console.log("   ", JSON.stringify(extra));
};

// ── agrupamento ───────────────────────────────────────────

const caso1 = [
  v({ id: "1", autor: "ana", music: "sax" }),
  v({ id: "2", autor: "bru", music: "sax" }),
  v({ id: "3", autor: "cau", music: "sax" }),
  v({ id: "4", autor: "dan", music: "sax" }),
];
const audio1 = detectarClusters(caso1).find((c) => c.tipo === "audio");
check("áudio com 4 criadores vira cluster", audio1?.criadores === 4, audio1);
check("videos não é limitado pelo teto de exemplos", audio1?.videos === 4, audio1);
check("exemplos no teto de 3", audio1?.exemplos.length === 3, audio1);

check(
  "1 criador só é descartado",
  detectarClusters([
    v({ id: "1", autor: "ana", music: "sax" }),
    v({ id: "2", autor: "ana", music: "sax" }),
  ]).length === 0
);

// Regra invertida de propósito: som original reusado por outro criador é o caso
// mais forte de trend de formato, não o mais fraco. Quem barra som exclusivo de
// um criador é a exigência de 2+ criadores, não um filtro de musicOriginal.
const orig = detectarClusters([
  v({ id: "1", autor: "ana", music: "o", original: true }),
  v({ id: "2", autor: "bru", music: "o", original: true }),
]).find((c) => c.tipo === "audio");
check("som original reusado por outro criador GERA cluster", orig?.criadores === 2, orig);
check(
  "rótulo de som original identifica o autor",
  orig?.chave.includes("som original de") === true,
  orig?.chave
);

const r4 = detectarClusters([
  v({ id: "1", autor: "ana", tags: ["Documentario"] }),
  v({ id: "2", autor: "bru", tags: ["documentario"] }),
]);
check("hashtag agrupa case-insensitive", r4.length === 1 && r4[0].criadores === 2, r4);

check("coleta vazia devolve []", detectarClusters([]).length === 0);

// ── duração: o separador molde × papel de parede ──────────

const molde = detectarClusters([
  v({ id: "1", autor: "ana", music: "m", duration: 15 }),
  v({ id: "2", autor: "bru", music: "m", duration: 16 }),
  v({ id: "3", autor: "cau", music: "m", duration: 14 }),
])[0];
check("duração concentrada é consistente", molde?.duracao_consistente === true, molde);
check("mediana de duração é calculada", molde?.duracao_mediana === 15, molde);

const parede = detectarClusters([
  v({ id: "1", autor: "ana", music: "p", duration: 7 }),
  v({ id: "2", autor: "bru", music: "p", duration: 45 }),
  v({ id: "3", autor: "cau", music: "p", duration: 120 }),
])[0];
check("duração dispersa não é consistente", parede?.duracao_consistente === false, parede);

const semDuracao = detectarClusters([
  v({ id: "1", autor: "ana", music: "s" }),
  v({ id: "2", autor: "bru", music: "s" }),
])[0];
check(
  "sem duração não inventa consistência",
  semDuracao?.duracao_consistente === false && semDuracao?.duracao_mediana === 0,
  semDuracao
);

// ── hashtags_comuns: vocabulário, não alcance ─────────────

const vocab = detectarClusters([
  v({ id: "1", autor: "ana", music: "h", tags: ["fyp", "viral", "sertanejo"] }),
  v({ id: "2", autor: "bru", music: "h", tags: ["foryou", "sertanejo"] }),
]).find((c) => c.tipo === "audio");
check(
  "hashtag genérica não entra em hashtags_comuns",
  vocab?.hashtags_comuns.join() === "sertanejo",
  vocab?.hashtags_comuns
);

const autoref = detectarClusters([
  v({ id: "1", autor: "ana", tags: ["documentario", "humor"] }),
  v({ id: "2", autor: "bru", tags: ["documentario", "humor"] }),
]).find((c) => c.tipo === "hashtag" && c.chave === "documentario");
check(
  "a própria chave não conta como hashtag em comum",
  autoref?.hashtags_comuns.join() === "humor",
  autoref?.hashtags_comuns
);

// Regressão: #fyp está em quase todo vídeo, então reunia o máximo de criadores e
// entrava no top-12 como candidato, expulsando trend real. Alcance ≠ assunto.
check(
  "hashtag genérica não VIRA cluster",
  detectarClusters([
    v({ id: "1", autor: "ana", tags: ["fyp", "viral", "brasil"] }),
    v({ id: "2", autor: "bru", tags: ["fyp", "viral", "brasil"] }),
  ]).length === 0,
  detectarClusters([
    v({ id: "1", autor: "ana", tags: ["fyp", "viral", "brasil"] }),
    v({ id: "2", autor: "bru", tags: ["fyp", "viral", "brasil"] }),
  ]).map((c) => c.chave)
);

const soUm = detectarClusters([
  v({ id: "1", autor: "ana", music: "u", tags: ["carnaval"] }),
  v({ id: "2", autor: "bru", music: "u", tags: ["praia"] }),
]).find((c) => c.tipo === "audio");
check(
  "hashtag que aparece 1× só não é 'comum'",
  soUm?.hashtags_comuns.length === 0,
  soUm?.hashtags_comuns
);

// ── transbordo ────────────────────────────────────────────

const corpus = [
  { fonte: "news", texto: "A trend do documentario tomou o TikTok" },
  { fonte: "reddit", texto: "alguém entendeu esse documentario?" },
  { fonte: "twitter", texto: "nada a ver" },
];
const comTransbordo = detectarClusters(
  [
    v({ id: "1", autor: "ana", tags: ["documentario"] }),
    v({ id: "2", autor: "bru", tags: ["documentario"] }),
  ],
  corpus
)[0];
check(
  "transbordo lista fontes distintas que mencionam",
  comTransbordo?.transbordo.sort().join() === "news,reddit",
  comTransbordo?.transbordo
);

const curta = detectarClusters(
  [
    v({ id: "1", autor: "ana", tags: ["rio"] }),
    v({ id: "2", autor: "bru", tags: ["rio"] }),
  ],
  [{ fonte: "news", texto: "prioritario e rio de janeiro" }]
)[0];
check("chave com menos de 4 chars não mede transbordo", curta?.transbordo.length === 0, curta);

// ── forca: a ordenação que substituiu a contagem de criadores ──
// O caso que o feedback pega: hit popular usado como música de fundo por muita
// gente NÃO deve vencer um som que dita o formato. Papel de parede aqui tem o
// mesmo número de criadores e engajamento muito maior; ainda assim perde, porque
// duração consistente + vocabulário em comum valem mais que popularidade.
const disputa = detectarClusters([
  ...["ana", "bru", "cau", "dan"].map((a, i) =>
    v({ id: `m${i}`, autor: a, music: "molde", tags: ["cabeleireiro"], duration: 15 + i, diggCount: 30 })
  ),
  ...["eva", "fab", "gil", "hel"].map((a, i) =>
    v({ id: `p${i}`, autor: a, music: "parede", tags: ["fyp"], duration: [8, 30, 60, 180][i], diggCount: 50_000 })
  ),
]).filter((c) => c.tipo === "audio");
check(
  "áudio-molde vence áudio-papel-de-parede mais popular",
  disputa[0]?.chave === "som molde",
  disputa.map((c) => [c.chave, c.forca, c.duracao_consistente])
);
check(
  "forca do papel de parede fica abaixo do molde",
  (disputa.find((c) => c.chave === "som parede")?.forca ?? 99) <
    (disputa.find((c) => c.chave === "som molde")?.forca ?? 0),
  disputa.map((c) => [c.chave, c.forca])
);
check(
  "forca não passa de 100",
  detectarClusters(
    Array.from({ length: 30 }, (_, i) =>
      v({ id: `x${i}`, autor: `a${i}`, music: "tudo", tags: ["a", "b", "c", "d", "e", "f"], duration: 15, diggCount: 999_999 })
    ),
    corpus
  ).every((c) => c.forca <= 100)
);
check(
  "resultado sai ordenado por forca decrescente",
  disputa.every((c, i) => i === 0 || disputa[i - 1].forca >= c.forca),
  disputa.map((c) => c.forca)
);

// ── topTikTok: o payload precisa carregar a evidência do cluster ──
// Cenário real do bug: 20 vídeos populares sem repetição + 3 vídeos de baixo
// engajamento que compartilham um áudio. O corte por engajamento levaria só os
// populares e o cluster chegaria ao modelo sem nenhum vídeo pra sustentá-lo.
const populares = Array.from({ length: 20 }, (_, i) =>
  v({ id: `pop${i}`, autor: `autor${i}`, music: `som_solo_${i}`, diggCount: 10_000 + i })
);
const trendFraca = [
  v({ id: "t1", autor: "ana", music: "sax", diggCount: 5 }),
  v({ id: "t2", autor: "bru", music: "sax", diggCount: 4 }),
  v({ id: "t3", autor: "cau", music: "sax", diggCount: 3 }),
];
const coleta = [...populares, ...trendFraca];

const clusters = detectarClusters(coleta);
const urlsClusters = new Set(clusters.flatMap((c) => c.exemplos));
const enviados = topTikTok(coleta, urlsClusters);
const urlsEnviadas = new Set(enviados.map((i) => i.webVideoUrl));

const audioSax = clusters.find((c) => c.chave === "som sax");
check("cluster de baixo engajamento é detectado", audioSax?.criadores === 3, clusters);
// E chega ao modelo como candidato fraco, não como veredito: sem duração
// consistente e sem vocabulário, a forca fica só na replicabilidade.
check("cluster sem qualificação tem forca baixa", (audioSax?.forca ?? 0) <= 25, audioSax);
check(
  "todo exemplo de cluster chega ao modelo",
  clusters.every((c) => c.exemplos.every((u) => urlsEnviadas.has(u))),
  {
    orfas: clusters
      .flatMap((c) => c.exemplos)
      .filter((u) => !urlsEnviadas.has(u)),
  }
);
check(
  "vídeos populares continuam no payload",
  enviados.filter((i) => i.webVideoUrl?.includes("pop")).length === 15,
  enviados.length
);
check(
  "sem duplicata no payload",
  urlsEnviadas.size === enviados.length,
  { itens: enviados.length, unicos: urlsEnviadas.size }
);
// Teto por construção: 15 do topo + (12 clusters × 3 exemplos) = 51.
check("payload respeita o teto de 51", enviados.length <= 51, enviados.length);

// Vídeo que já estava no topo por engajamento e também sustenta cluster não deve
// ser adicionado duas vezes.
const dobrado = [
  v({ id: "d1", autor: "ana", music: "sax", diggCount: 99_999 }),
  v({ id: "d2", autor: "bru", music: "sax", diggCount: 99_998 }),
];
const cl2 = detectarClusters(dobrado);
const env2 = topTikTok(dobrado, new Set(cl2.flatMap((c) => c.exemplos)));
check("cluster que já está no topo não duplica", env2.length === 2, env2.length);

console.log(falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falhou.`);
process.exit(falhas === 0 ? 0 : 1);

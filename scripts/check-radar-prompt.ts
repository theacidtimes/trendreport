import {
  engajamento,
  maisRelevantes,
  resumirCorte,
  buildRadarPrompt
} from "../lib/radar/radarPrompt";
import type { RawDataPoint, MarcaKnowledge } from "../lib/types";

// O corte que decide o que o modelo enxerga.
//
// Nada aqui levanta exceção quando quebra: uma ordenação errada não derruba o
// run, só troca quais sinais chegam ao Sonnet. O sintoma aparece semanas depois,
// na reunião, como "o radar não viu o assunto da semana" — foi exatamente assim
// que este bug foi descoberto (estreia do Homem-Aranha ausente do radar da Vivo,
// 01/08/2026), e não havia um único log apontando pra cá.

let falhas = 0;
const check = (nome: string, ok: boolean, extra?: unknown) => {
  if (!ok) falhas++;
  console.log(`${ok ? "PASS" : "FALHA"}  ${nome}`);
  if (!ok) console.log("   ", JSON.stringify(extra));
};

const ponto = (
  fonte: RawDataPoint["fonte"],
  id: string,
  upvotes?: number,
  comentarios?: number
): RawDataPoint => ({
  fonte,
  titulo: `titulo ${id}`,
  url: `https://exemplo/${id}`,
  snippet: `snippet ${id}`,
  upvotes,
  comentarios,
  coletado_em: "2026-08-01T00:00:00.000Z"
});

// ── engajamento ───────────────────────────────────────────
check("soma reacoes e conversa", engajamento(ponto("twitter", "a", 100, 20)) === 120);
// Reddit e News chegam com campos ausentes; tratar undefined como 0 é o que
// permite ordenar uma lista mista sem descartar item.
check("campo ausente vale 0", engajamento(ponto("news", "b")) === 0);
check("so upvotes ainda conta", engajamento(ponto("tiktok", "c", 7)) === 7);
// Um comparador que devolve NaN deixa a ordenação INDEFINIDA pela spec: um
// único item sujo embaralharia a lista inteira, em silêncio.
check(
  "NaN vira 0 e nao contamina a ordenacao",
  engajamento(ponto("twitter", "d", NaN, 5)) === 5
);
check(
  "Infinity vira 0 (nao pode sequestrar o topo)",
  engajamento(ponto("twitter", "e", Infinity)) === 0
);
check(
  "string numerica nao e aceita como numero",
  engajamento({ ...ponto("twitter", "f"), upvotes: "999" as unknown as number }) === 0
);

// ── maisRelevantes: ordem ─────────────────────────────────
const mistura = [
  ponto("twitter", "fraco", 2),
  ponto("twitter", "medio", 500),
  ponto("twitter", "forte", 16885),
  ponto("reddit", "outro", 99999)
];

const top2 = maisRelevantes(mistura, "twitter", 2);
check("corta na fonte pedida", top2.every(d => d.fonte === "twitter"), top2);
check(
  "ordena por engajamento decrescente",
  top2.map(d => d.url.split("/").pop()).join(",") === "forte,medio",
  top2
);
check("respeita o limite", top2.length === 2, top2);
check(
  "limite maior que o disponivel devolve tudo que ha",
  maisRelevantes(mistura, "twitter", 50).length === 3
);
check("fonte sem nenhum item devolve vazio", maisRelevantes(mistura, "linkedin", 5).length === 0);
check("lista vazia nao quebra", maisRelevantes([], "twitter", 5).length === 0);

// O array recebido é o mesmo `freshData` que o runRadar usa depois pra montar
// `urlsReais` e pontuar cada drop. Reordenar ali dentro seria efeito colateral
// invisível num caminho que nada testa.
// Array NOVO de propósito: `mistura` já passou por chamadas acima, e se
// alguma delas tivesse reordenado o original, o `antes` capturado aqui já
// viria embaralhado e a comparação passaria sem querer. (Foi exatamente isso
// que aconteceu na primeira versão deste teste: a mutação que trocava
// `.filter().sort()` por `.sort().filter()` sobreviveu porque o dano já
// estava feito antes da medição.)
const intocado = [
  ponto("twitter", "z-fraco", 1),
  ponto("reddit", "y-fortissimo", 99999),
  ponto("twitter", "x-forte", 5000)
];
const antes = intocado.map(d => d.url).join("|");
maisRelevantes(intocado, "twitter", 2);
check(
  "NAO reordena o array do chamador",
  intocado.map(d => d.url).join("|") === antes,
  intocado.map(d => d.url)
);

// ── estabilidade no empate ────────────────────────────────
// News não tem contador de engajamento nenhum: todo item empata em 0. Se a
// ordenação não fosse estável, a lista do Google News (que JÁ vem ordenada por
// relevância) sairia embaralhada e o corte voltaria a ser sorteio — só que
// agora escondido atrás de um `sort` que parece intencional.
const noticias = ["n1", "n2", "n3", "n4", "n5"].map(id => ponto("news", id));
check(
  "empate preserva a ordem de chegada (Google News)",
  maisRelevantes(noticias, "news", 3).map(d => d.url.split("/").pop()).join(",") ===
    "n1,n2,n3",
  maisRelevantes(noticias, "news", 3)
);

// ── a regressão real: Homem-Aranha na Vivo ────────────────
// Reconstituição do dia 01/08/2026. 99 tweets coletados; os dois que viraram
// drop estavam nas posições 82 e 92 por engajamento (2 e 9 curtidas, postados
// em 2019 e 2023) e o tweet da estreia do Homem-Aranha era o 11º mais engajado
// do dia (16.885 curtidas) — mas chegou tarde na ordem do dataset.
const diaDaVivo: RawDataPoint[] = [
  ponto("twitter", "tweet-2019-com-2-curtidas", 2),
  ponto("twitter", "tweet-2023-com-9-curtidas", 9),
  ...Array.from({ length: 40 }, (_, i) => ponto("twitter", `ruido-${i}`, i)),
  ponto("twitter", "homem-aranha", 16885),
  ...Array.from({ length: 56 }, (_, i) => ponto("twitter", `cauda-${i}`, 1))
];

const antigo = diaDaVivo.filter(d => d.fonte === "twitter").slice(0, 8);
check(
  "o corte ANTIGO deixava o Homem-Aranha de fora (bug reproduzido)",
  !antigo.some(d => d.url.includes("homem-aranha"))
);
check(
  "o corte ANTIGO levava os tweets de 2 e 9 curtidas (bug reproduzido)",
  antigo.some(d => d.url.includes("2019")) && antigo.some(d => d.url.includes("2023"))
);

const novo = maisRelevantes(diaDaVivo, "twitter", 20);
check(
  "o corte NOVO leva o Homem-Aranha ao modelo",
  novo.some(d => d.url.includes("homem-aranha")),
  novo.map(d => d.url)
);
check(
  "o corte NOVO descarta os tweets de 2 e 9 curtidas",
  !novo.some(d => d.url.includes("2019")) && !novo.some(d => d.url.includes("2023"))
);
check("o corte NOVO poe o mais engajado em primeiro", novo[0].url.includes("homem-aranha"));

// ── a cauda fresca que o min_faves NÃO barra ──────────────
// MEDIDO na Apify real em 02/08/2026: a lane do Twitter manda
// `minimumFavorites: 10`, que vira `min_faves:10` na busca — e mesmo assim 11
// de 20 itens voltaram ABAIXO do piso, todos das últimas ~9h (2 a 130 views).
// O `sort=Top` injeta uma cauda recente que ainda não foi pontuada e escapa do
// operador. Quem garante o corte de verdade, então, é esta função: se ela
// voltar a cortar por ordem de chegada, a cauda de 0 curtida entra no prompt e
// o piso na origem não salva ninguém.
const caudaFresca = [
  ...Array.from({ length: 11 }, (_, i) => ponto("twitter", `recem-postado-${i}`, 0)),
  ...Array.from({ length: 9 }, (_, i) => ponto("twitter", `conversa-real-${i}`, 1000 + i))
];
const cortado = maisRelevantes(caudaFresca, "twitter", 9);
check(
  "cauda de 0 curtida (que o min_faves deixou passar) nao chega ao modelo",
  cortado.every(d => !d.url.includes("recem-postado")),
  cortado.map(d => d.url)
);
check(
  "e a conversa real ocupa as vagas",
  cortado.length === 9 && cortado.every(d => d.url.includes("conversa-real")),
  cortado.map(d => d.url)
);

// ── resumirCorte ──────────────────────────────────────────
const resumo = resumirCorte(diaDaVivo);
check("resumo mostra levado/total da fonte", resumo.includes("twitter 20/99"), resumo);
// Fonte sem coleta tem que aparecer como 0/0, não sumir: "reddit ausente" é um
// diagnóstico (lane falhou), e some se a linha for omitida.
check("fonte sem dados aparece zerada", resumo.includes("reddit 0/0"), resumo);

// ── prompt montado ────────────────────────────────────────
const knowledge = {
  marca: "Vivo",
  produto: "telecom",
  tom: "proximo",
  perfil_comportamental: "conectado",
  universos_culturais: ["cultura pop"],
  ambicao_de_marca: "conectar",
  o_que_evitar: ["jargao"],
  idioma: "pt"
} as unknown as MarcaKnowledge;

const { user, corte } = buildRadarPrompt(knowledge, diaDaVivo);
check("prompt entrega o sinal mais engajado", user.includes("/homem-aranha"), null);
check("prompt NAO entrega o tweet de 2 curtidas", !user.includes("/tweet-2019-com-2-curtidas"));
check("buildRadarPrompt devolve o diagnostico de corte", corte.includes("twitter 20/99"), corte);
// O cabeçalho afirmava "ÚLTIMAS 48H" enquanto 54% dos tweets eram mais velhos
// que isso (123 com mais de um ano, medido). Afirmar recência que o dado não
// tem faz o modelo escrever "está acontecendo agora" sobre reprise de 2015.
check(
  "cabecalho NAO afirma janela de 48h que a coleta nao garante",
  !user.includes("ÚLTIMAS 48H"),
  user.slice(0, 200)
);
check(
  "cabecalho avisa que a data de publicacao nao vem nos dados",
  user.includes("data de publicação NÃO vem nos dados")
);

console.log(
  falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falhou.`
);
process.exit(falhas === 0 ? 0 : 1);

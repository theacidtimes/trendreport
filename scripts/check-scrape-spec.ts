import { scrapeSpec, type Fonte } from "../lib/radar/collectData";

// O recorte de cada lane — o que se pede à Apify.
//
// Nada aqui levanta exceção quando some. O actor ignora parâmetro que não
// conhece e devolve 200 com dados; um `start` perdido num refactor não aparece
// em log nenhum, só volta a trazer tweet de 2015 caladamente. Foi assim que a
// lane do Twitter passou meses sem recorte temporal enquanto o prompt anunciava
// "coletado nas últimas 48h" (medido na Vivo: 45,9% das últimas 48h, 123 tweets
// com mais de um ano).

let falhas = 0;
const check = (nome: string, ok: boolean, extra?: unknown) => {
  if (!ok) falhas++;
  console.log(`${ok ? "PASS" : "FALHA"}  ${nome}`);
  if (!ok) console.log("   ", JSON.stringify(extra));
};

const termos = ["homem aranha", "tom holland", "trailer", "quarto termo"];
const spec = (fonte: Fonte) => scrapeSpec(fonte, termos);

const FONTES: Fonte[] = ["reddit", "news", "news_global", "twitter", "tiktok", "linkedin"];

// ── contrato comum ────────────────────────────────────────
for (const fonte of FONTES) {
  const s = spec(fonte);
  check(`${fonte}: tem actorId`, Boolean(s.actorId) && s.actorId.includes("/"), s.actorId);
  check(`${fonte}: tem input`, Object.keys(s.input).length > 0, s.input);
}

// ── twitter: o recorte que faltava ────────────────────────
const tw = spec("twitter").input;

check("twitter: actor de busca de tweets", spec("twitter").actorId === "apidojo/tweet-scraper");

// Sem janela, a lane volta a competir com o arquivo inteiro do Twitter — e
// `sort=Top` garante que o arquivo ganha (tweet de 2015 acumulou 10 anos de
// curtidas; o da estreia de ontem tem horas).
check("twitter: TEM janela de recencia", tw.start != null, tw);
check(
  "twitter: janela no formato que o actor aceita (YYYY-MM-DD)",
  typeof tw.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(tw.start),
  tw.start
);

const diasAtras = (d: string) =>
  Math.round((Date.now() - new Date(`${d}T00:00:00Z`).getTime()) / 86_400_000);
// 7 e não 2: o radar roda a cada 12–24h, mas 48h com sort=Top esvazia termo de
// nicho — mesmo motivo de o Reddit usar month e não day.
check("twitter: janela e de 7 dias", diasAtras(tw.start as string) === 7, tw.start);
check("twitter: janela esta no PASSADO", diasAtras(tw.start as string) > 0, tw.start);

// Piso de engajamento na ORIGEM: o tweet morto nem entra no dataset, então nem
// é pago. O drop da Vivo de 01/08 foi construído sobre tweets de 2 e 9
// curtidas; abaixo deste piso os dois teriam sido impossíveis.
check("twitter: TEM piso de engajamento", tw.minimumFavorites != null, tw);
check("twitter: piso e 10 curtidas", tw.minimumFavorites === 10, tw.minimumFavorites);
// Medido em 2.207 tweets/14 dias: 303 abaixo de 10 favoritos → 86,3% sobrevivem.
// Piso alto demais mataria conversa legítima de nicho, que é metade do valor da lane.
check(
  "twitter: piso conservador (nao pode zerar termo de nicho)",
  (tw.minimumFavorites as number) <= 25,
  tw.minimumFavorites
);

// Responde "qual lane trouxe isto?" — pergunta que ficou sem resposta na
// investigação do Homem-Aranha, porque radar_raw_data não guarda a lane.
check("twitter: devolve o termo que encontrou cada tweet", tw.includeSearchTerms === true, tw);

check("twitter: continua em pt", tw.tweetLanguage === "pt", tw.tweetLanguage);
check("twitter: continua ordenando por Top", tw.sort === "Top", tw.sort);
// O actor corta em 3 termos; passar mais só alimenta termo que nunca é buscado.
check(
  "twitter: query junta os 3 primeiros termos com OR",
  Array.isArray(tw.searchTerms) &&
    (tw.searchTerms as string[])[0] === "homem aranha OR tom holland OR trailer",
  tw.searchTerms
);
check("twitter: manda UMA query", (tw.searchTerms as string[]).length === 1, tw.searchTerms);

// ── as outras fontes NAO regrediram ───────────────────────
// O recorte do Twitter foi adicionado pra alinhar com estas duas, que já o
// tinham. Se alguma delas perder o dela, o buraco só muda de lane.
const rd = spec("reddit").input;
check("reddit: mantem janela de um mes", rd.time === "month", rd.time);
check("reddit: mantem sort por relevancia", rd.sort === "relevance", rd.sort);
// Sem includeMediaLinks não vêm upVotes/numberOfComments — e o corte por
// engajamento do radarPrompt ordena uma lista inteira de zeros.
check("reddit: pede os contadores (senao o engajamento e sempre 0)", rd.includeMediaLinks === true, rd);

const tk = spec("tiktok").input;
check("tiktok: mantem janela de um mes", tk.videoSearchDateFilter === "PAST_MONTH", tk.videoSearchDateFilter);
// Sem proxy BR a busca devolve conteúdo global e o filtro de idioma zera.
check("tiktok: mantem proxy BR", tk.proxyCountryCode === "BR", tk.proxyCountryCode);

// ── borda: menos termos que o corte ───────────────────────
const um = scrapeSpec("twitter", ["so um termo"]).input;
check("twitter: um termo so nao vira OR pendurado", (um.searchTerms as string[])[0] === "so um termo", um.searchTerms);
check("twitter: um termo so mantem o recorte", um.start != null && um.minimumFavorites === 10, um);
const nenhum = scrapeSpec("twitter", []).input;
check("twitter: lista vazia nao quebra", (nenhum.searchTerms as string[])[0] === "", nenhum.searchTerms);

console.log(
  falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falhou.`
);
process.exit(falhas === 0 ? 0 : 1);

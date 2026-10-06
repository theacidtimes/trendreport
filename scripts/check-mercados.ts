import { scrapeSpec, mapItems } from "../lib/radar/collectData";
import { buildRadarPrompt } from "../lib/radar/radarPrompt";
import { MERCADOS, mercadoDe, ehEspanhol, blocoMercado } from "../lib/mercados";
import { escolherLegenda } from "../lib/legendas";
import { identificarLaneReddit } from "../lib/apify";
import { termoSensivel } from "../lib/brandSafety";
import { systemPromptDynamic } from "../lib/systemPrompt";
import type { MarcaKnowledge } from "../lib/types";

// Mercado (país/idioma da coleta), out/2026, demanda Casio LATAM.
//
// O risco que isto vigia é o mesmo do check-scrape-spec: parâmetro de país que
// some não levanta erro. Um `gl: "br"` esquecido numa lane do México devolve
// 200 com notícia brasileira, e o drop sai em espanhol falando de coisa que o
// mexicano nunca viu. E o oposto: o BR precisa sair byte-idêntico ao de antes.

let falhas = 0;
const check = (nome: string, ok: boolean, extra?: unknown) => {
  if (!ok) falhas++;
  console.log(`${ok ? "PASS" : "FALHA"}  ${nome}`);
  if (!ok) console.log("   ", JSON.stringify(extra));
};

const MX = MERCADOS.MX;
const termos = ["g-shock", "reloj digital"];

// ── resolução de país ─────────────────────────────────────
check("sem pais vale BR", mercadoDe(undefined).pais === "BR");
check("pais minusculo e normalizado", mercadoDe(" mx ").pais === "MX");
check("pais sem mercado (AU) cai no BR, sem regressao", mercadoDe("AU").pais === "BR");
for (const p of ["MX", "AR", "CO", "CL"]) {
  const m = mercadoDe(p);
  check(`${p}: idioma es e proxy do proprio pais`, m.idioma === "es" && m.tiktokProxy === p, m);
}

// ── BR intacto ────────────────────────────────────────────
const brNews = scrapeSpec("news", termos).input;
check("BR: news gl=br hl=pt-br", brNews.gl === "br" && brNews.hl === "pt-br", brNews);
check("BR: news mantem site:.com.br", String(brNews.q).includes("site:.com.br"), brNews.q);
check("BR: tiktok proxy BR", scrapeSpec("tiktok", termos).input.proxyCountryCode === "BR");
check("BR: twitter pt", scrapeSpec("twitter", termos).input.tweetLanguage === "pt");
check("BR: sem bloco de mercado", blocoMercado(MERCADOS.BR) === "");
check("BR: prompt dinamico do report so tem a data", !systemPromptDynamic().includes("MERCADO"));

// ── MX ────────────────────────────────────────────────────
const mxNews = scrapeSpec("news", termos, MX).input;
// es-419 é recusado pelo actor (HTTP 400): o hl tem que ser es-<país>.
check("MX: news gl=mx hl=es-mx", mxNews.gl === "mx" && mxNews.hl === "es-mx", mxNews);
for (const m of Object.values(MERCADOS)) {
  check(`${m.pais}: hl do news nao e es-419`, m.news.hl !== "es-419", m.news);
}
check("MX: news recorta imprensa mexicana", String(mxNews.q).includes("site:.mx") && !String(mxNews.q).includes(".com.br"), mxNews.q);
check("MX: tiktok proxy MX", scrapeSpec("tiktok", termos, MX).input.proxyCountryCode === "MX");
check("MX: twitter es", scrapeSpec("twitter", termos, MX).input.tweetLanguage === "es");
const glob = scrapeSpec("news_global", termos, MX).input;
check("MX: news_global continua global (us/en)", glob.gl === "us" && glob.hl === "en", glob);

// ── peneira de idioma ─────────────────────────────────────
check("espanhol detectado", ehEspanhol("¿Qué onda? Este reloj está muy chido"));
check("portugues NAO e espanhol", !ehEspanhol("esse relógio é muito bonito, não é?"));
check("ingles NAO e espanhol", !ehEspanhol("this watch is so cool and I love the strap"));

const tiktokItems = [
  { text: "Mi G-Shock nuevo, ¿qué opinan? está muy chido", webVideoUrl: "https://t/es" },
  { text: "Meu G-Shock novo, o que vocês acham? não é lindo", webVideoUrl: "https://t/pt" },
];
const mxTik = mapItems("tiktok", tiktokItems, "es", MX).map((d) => d.url);
check("MX: tiktok fica com o espanhol e larga o portugues", mxTik.join() === "https://t/es", mxTik);
const brTik = mapItems("tiktok", tiktokItems).map((d) => d.url);
// Só "mantém o português": a peneira BR é a de sempre e conta acento como sinal
// de português, então deixa passar espanhol acentuado. Comportamento antigo,
// fora do escopo do mercado.
check("BR: tiktok segue com o portugues", brTik.includes("https://t/pt"), brTik);

// Emoji cortado ao meio (surrogate órfão) derrubava a rodada inteira na Anthropic
// e o lote da memória no Postgres (06/10/2026). mapItems tem que devolver texto
// bem-formado, seja qual for a fonte.
const cortado = "Meu G-Shock novo, o que vocês acham? não é lindo \uD83D";
const sujo = mapItems("tiktok", [{ text: cortado, webVideoUrl: "https://t/emoji" }]);
check(
  "mapItems saneia emoji cortado (surrogate orfao)",
  sujo.length > 0 && sujo.every((d) => Object.values(d).every((v) => typeof v !== "string" || v.isWellFormed())),
  sujo
);

const redditItems = [
  { dataType: "post", title: "Relojes", body: "short", communityName: "r/mexico", url: "https://r/a/comments/1/x/" },
  { dataType: "post", title: "Relógios", body: "short", communityName: "r/brasil", url: "https://r/b/comments/2/x/" },
];
const mxRed = mapItems("reddit", redditItems, "es", MX).map((d) => d.url);
check("MX: reddit aceita r/mexico pelo sub e larga r/brasil", mxRed.join() === "https://r/a/comments/1/x/", mxRed);

const CO = MERCADOS.CO;
const tweets = [
  { text: "Brutal la pelea de anoche, qué nivel", lang: "es", url: "https://x/es" },
  { text: "Saiu carregado mas lutou muito, que guerreiro", lang: "pt", url: "https://x/pt" },
  { text: "¿Quién más sale a correr a las 5am? Yo sí", url: "https://x/sem-lang" },
];
const coTw = mapItems("twitter", tweets, "es", CO).map((d) => d.url);
check("CO: X larga tweet em portugues (lang do X)", coTw.join() === "https://x/es,https://x/sem-lang", coTw);
const brTw = mapItems("twitter", tweets).map((d) => d.url);
check("BR: X segue sem peneira de idioma", brTw.length === 3, brTw);

const redditLatam = [
  { dataType: "post", title: "Me fundí el cerebro con el celular, ¿a alguien más le pasa?", body: "", communityName: "r/chile", url: "https://r/cl/comments/9/x/" },
  { dataType: "post", title: "¿Dónde compran ropa de segunda en Bogotá? Está muy cara", body: "", communityName: "r/bogota", url: "https://r/bog/comments/8/x/" },
];
const coRed = mapItems("reddit", redditLatam, "es", CO).map((d) => d.url);
check("CO: reddit larga r/chile e fica com o espanhol de outro sub", coRed.join() === "https://r/bog/comments/8/x/", coRed);

// ── prompt do radar ───────────────────────────────────────
const knowledge = (pais?: string): MarcaKnowledge => ({
  marca: "G-Shock", produto: "relogio", tom: "seco", perfil_comportamental: "jovem",
  universos_culturais: ["skate"], o_que_evitar: ["politica"], ambicao_de_marca: "x",
  termos_busca: ["G-Shock"], pais,
});
const pMx = buildRadarPrompt(knowledge("MX"), []);
check("MX: system do radar leva bloco de mercado", pMx.system.includes("MERCADO E IDIOMA — MÉXICO"), pMx.system.slice(-400));
check("MX: radar manda escrever em espanhol", pMx.system.includes("IDIOMA DE SAÍDA: escreva TODO o texto que você gerar em espanhol"));
const pBr = buildRadarPrompt(knowledge(), []);
check("BR: system do radar sem bloco de mercado", !pBr.system.includes("MERCADO E IDIOMA"));
check("MX: a ULTIMA coisa do user e o pedido de idioma", pMx.user.trim().split("\n\n---\n\n").pop()!.startsWith("IDIOMA DA RESPOSTA"), pMx.user.slice(-300));
check("BR: user do radar sem pedido de idioma", !pBr.user.includes("IDIOMA DA RESPOSTA"));
check("MX: prompt dinamico do report leva o bloco", systemPromptDynamic(MX).includes("IDIOMA DE SAÍDA"));

// ── legenda do TikTok ─────────────────────────────────────
const legendas = [
  { language: "por-PT", source: "MT", downloadLink: "https://l/pt-mt" },
  { language: "spa-ES", source: "ASR", downloadLink: "https://l/es-orig" },
];
check("BR: legenda prefere portugues", escolherLegenda(legendas) === "https://l/pt-mt");
check("MX: legenda prefere a fala original em espanhol", escolherLegenda(legendas, "es") === "https://l/es-orig");

// ── cache do Reddit do report ─────────────────────────────
const inputDe = (subs: string[]) => ({ startUrls: subs.map((s) => ({ url: `https://www.reddit.com/r/${s}/` })) });
check("run de subs do Mexico NAO e cache do BR", identificarLaneReddit(inputDe(MX.reddit.geral)) === null);
check("run de subs do BR segue reconhecido", identificarLaneReddit(inputDe(["eu_nvr", "conversas", "InternetBrasil", "gamesEcultura", "viagens"])) === "geral");

// ── brand safety LATAM ────────────────────────────────────
check("brand safety pega politica argentina", termoSensivel("Kirchner habló hoy") === "kirchner");
check("brand safety pega violencia em espanhol", termoSensivel("hubo un tiroteo anoche") === "tiroteo");
check("brand safety nao pega 'morena'", termoSensivel("la chica morena con su G-Shock") === null);

console.log(falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falhou.`);
process.exit(falhas === 0 ? 0 : 1);

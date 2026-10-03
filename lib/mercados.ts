/**
 * Mercado = de ONDE vem a coleta. Tudo que antes era constante brasileira
 * espalhada pelos scrapers (gl/hl do Google News, proxy do TikTok, idioma do X,
 * subreddits, perfis de Instagram, peneira de idioma) mora aqui, por país.
 *
 * O mercado sai do `pais` da marca — o MESMO campo que já escolhe o calendário
 * da agenda (planner.paisDaMarca). Um campo só, de propósito: se coleta e agenda
 * lessem campos diferentes, uma marca podia raspar o México e receber o Dia dos
 * Pais brasileiro, e nada avisaria.
 *
 * País sem entrada aqui (AU, US, PT, ES) cai no BR, que é exatamente o que eles
 * já recebiam antes deste arquivo existir. Não é correto, é sem regressão: ligar
 * um desses mercados é adicionar a entrada, não mexer em scraper.
 */
import type { MarcaKnowledge } from "./types";

export type Idioma = "pt" | "es";

export type Mercado = {
  pais: string;
  // Nome legível, vai pro prompt ("mercado: México").
  nome: string;
  idioma: Idioma;
  // Idioma em que o LLM ESCREVE drops e report. Igual ao da coleta hoje; separado
  // porque é decisão de cliente, não de fonte.
  idiomaSaida: string;
  news: {
    gl: string;
    hl: string;
    // Recorte de imprensa do radar (vira `site:` na query). TLD do país pega o
    // grosso; portais fortes fora do TLD entram na mão.
    sites: string[];
  };
  tiktokProxy: string;
  // tweetLanguage do X. Só idioma: o X não filtra por país, então "es" traz
  // México, Argentina e Espanha juntos. Quem separa é o prompt (bloco de mercado).
  xIdioma: string;
  reddit: {
    // Subs do país. No radar contam como "é do mercado" mesmo sem bater o idioma;
    // no report são a lista fixa que é raspada.
    geral: string[];
    meme: string[];
  };
  instagram: {
    geral: string[];
    meme: string[];
  };
};

const BR: Mercado = {
  pais: "BR",
  nome: "Brasil",
  idioma: "pt",
  idiomaSaida: "português brasileiro",
  news: {
    gl: "br",
    hl: "pt-br",
    sites: [".com.br", "g1.globo.com", "valor.globo.com", "exame.com", "fastcompany.com"],
  },
  tiktokProxy: "BR",
  xIdioma: "pt",
  reddit: {
    geral: ["eu_nvr", "conversas", "InternetBrasil", "gamesEcultura", "viagens"],
    meme: ["HUEstation", "DiretoDoZapZap"],
  },
  instagram: {
    geral: [
      "g1", "netflixbrasil", "portadosfundos", "flamengo", "buzzfeedbrasil", "sportv",
      "espnbrasil", "omelete", "jovemnerd", "ignbrasil", "rollingstonebrasil",
      "adrenaline_oficial", "voxeloficial", "papelpop",
    ],
    meme: ["saquinhodelixo", "meltedvideos", "pleasecome2br", "brazilianversion", "divadepressao"],
  },
};

// LATAM (out/2026, demanda Casio). Listas de Instagram e Reddit são o PONTO DE
// PARTIDA, não curadoria fechada: perfil que não existe não quebra nada (o actor
// devolve item de erro e o filtro descarta), só deixa a lane mais magra. Os perfis
// de MEME ficaram vazios de propósito — página de meme local é conhecimento de
// quem vive o país, e chute aqui vira meme gringo no report de cliente. Enquanto
// vazios, a seção de memes do report se apoia em TikTok e X.
// r/yo_elvr é o me_irl hispânico: pan-LATAM, serve aos quatro.
const MX: Mercado = {
  pais: "MX",
  nome: "México",
  idioma: "es",
  idiomaSaida: "espanhol latino-americano (com o vocabulário do México quando citar a conversa local)",
  news: {
    gl: "mx",
    hl: "es-419",
    sites: [".mx", "milenio.com", "elfinanciero.com.mx", "infobae.com"],
  },
  tiktokProxy: "MX",
  xIdioma: "es",
  reddit: { geral: ["mexico", "MexicoCity"], meme: ["yo_elvr"] },
  instagram: { geral: ["netflixlat", "eluniversalmx", "milenio"], meme: [] },
};

const AR: Mercado = {
  pais: "AR",
  nome: "Argentina",
  idioma: "es",
  idiomaSaida: "espanhol latino-americano (com o vocabulário da Argentina quando citar a conversa local)",
  news: {
    gl: "ar",
    hl: "es-419",
    sites: [".com.ar", "clarin.com", "infobae.com", "pagina12.com.ar"],
  },
  tiktokProxy: "AR",
  xIdioma: "es",
  reddit: { geral: ["argentina", "RepublicaArgentina"], meme: ["yo_elvr", "orslokx"] },
  instagram: { geral: ["netflixlat", "clarincom", "lanacioncom", "infobae", "tycsports"], meme: [] },
};

const CO: Mercado = {
  pais: "CO",
  nome: "Colômbia",
  idioma: "es",
  idiomaSaida: "espanhol latino-americano (com o vocabulário da Colômbia quando citar a conversa local)",
  news: {
    gl: "co",
    hl: "es-419",
    sites: [".com.co", "eltiempo.com", "elespectador.com", "semana.com", "infobae.com"],
  },
  tiktokProxy: "CO",
  xIdioma: "es",
  reddit: { geral: ["Colombia"], meme: ["yo_elvr"] },
  instagram: { geral: ["netflixlat", "eltiempo", "elespectador", "caracoltv"], meme: [] },
};

const CL: Mercado = {
  pais: "CL",
  nome: "Chile",
  idioma: "es",
  idiomaSaida: "espanhol latino-americano (com o vocabulário do Chile quando citar a conversa local)",
  news: {
    gl: "cl",
    hl: "es-419",
    sites: [".cl", "latercera.com", "emol.com", "biobiochile.cl", "infobae.com"],
  },
  tiktokProxy: "CL",
  xIdioma: "es",
  reddit: { geral: ["chile"], meme: ["yo_elvr"] },
  instagram: { geral: ["netflixlat", "latercera", "biobiochile", "t13"], meme: [] },
};

export const MERCADOS: Record<string, Mercado> = { BR, MX, AR, CO, CL };
export const MERCADO_PADRAO = BR;

export function mercadoDe(pais?: string | null): Mercado {
  const p = typeof pais === "string" ? pais.trim().toUpperCase() : "";
  return MERCADOS[p] ?? MERCADO_PADRAO;
}

// Report avulso (sem marca) não tem país: cai no BR, como sempre foi.
export function mercadoDaMarca(k?: MarcaKnowledge | null): Mercado {
  return mercadoDe(k?.pais);
}

// ── Peneira de espanhol ──────────────────────────────────────────────────────
// Mesmo desenho da de português (marcadores + caracteres), mas só com palavras
// que NÃO existem em português: "que", "para", "como", "porque", "nada" ficam de
// fora porque acertariam texto brasileiro e deixariam vazar o feed BR pela busca
// aberta. ñ ¿ ¡ não existem em português.
// Fronteira por letra Unicode e não \b: o \b do JS é ASCII, então "qué" ou
// "aquí" (terminando em acento) nunca casariam.
// Construída por string porque o tsconfig mira ES5, que não aceita a flag `u`
// em regex literal (o Node aceita, é só o compilador).
const ES_MARKERS = new RegExp(
  "(?<!\\p{L})(el|los|las|del|muy|pero|esto|eso|hay|tambi[ée]n|entonces|yo|t[úu]|usted|ustedes|qu[ée]|c[óo]mo|cuando|ahora|aqu[íi]|tengo|tiene|con|una|est[áa]s|soy|eres|vos|che|wey|güey|parce|weón)(?!\\p{L})",
  "giu"
);
const ES_CHARS = /[ñ¿¡]/gi;

export function ehEspanhol(text: string): boolean {
  const t = String(text || "");
  if (t.length < 8) return false;
  const hits = (t.match(ES_MARKERS) || []).length + (t.match(ES_CHARS) || []).length;
  return hits >= 2;
}

// Bloco de mercado do prompt (radar e report). Vazio no BR: o prompt brasileiro
// fica byte-idêntico ao de antes.
export function blocoMercado(m: Mercado): string {
  if (m.pais === MERCADO_PADRAO.pais) return "";
  return `MERCADO E IDIOMA — ${m.nome.toUpperCase()}

Esta análise é para o mercado ${m.nome}. Os sinais foram coletados em ${m.idioma === "es" ? "espanhol" : m.idioma}, com busca ancorada no país, mas a busca por idioma deixa passar conversa de outros países que falam a mesma língua (Espanha, outros países da América Latina, comunidade latina dos EUA). Use só o que é relevante para quem vive em ${m.nome}; sinal claramente de outro país só entra se a conversa local estiver respondendo a ele.

Não traduza a cultura brasileira para lá: referências, datas, gírias e comparações têm que ser de ${m.nome}.

IDIOMA DE SAÍDA: escreva TODO o texto que você gerar em ${m.idiomaSaida}. Isto vale por cima de qualquer instrução deste prompt que peça português. Os nomes de campo do JSON continuam exatamente como especificados.`;
}

// ── Região (filtro de tela) ──────────────────────────────────────────────────
// Agrupamento de leitura para o radar e o mapa: o time olha "o Brasil" ou "a
// LATAM", não país a país. Sai do mesmo `pais` da marca. País fora dos mercados
// LATAM conta como BR, coerente com mercadoDe (que também cai no BR).
export type Regiao = "BR" | "LATAM";
export const REGIOES: Regiao[] = ["BR", "LATAM"];
const PAISES_LATAM = new Set(["MX", "AR", "CO", "CL"]);

export function regiaoDe(pais?: string | null): Regiao {
  const p = typeof pais === "string" ? pais.trim().toUpperCase() : "";
  return PAISES_LATAM.has(p) ? "LATAM" : "BR";
}

// `?regiao=` da URL → Regiao ou null (todas).
export function parseRegiao(v: string | string[] | undefined | null): Regiao | null {
  const s = (Array.isArray(v) ? v[0] : v)?.toUpperCase();
  return s === "BR" || s === "LATAM" ? s : null;
}

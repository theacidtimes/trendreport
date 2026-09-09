import type { RawData, TikTokItem } from "./types";

// ── Brand safety: o que NÃO pode chegar ao modelo ────────────────────────────
//
// Caso real (report 29d7497a, Vivo, 08/09/2026): a busca "Vivo Fibra" no
// Twitter trouxe um tweet de janeiro de 2023 sobre o Lula "assinando o Vivo
// Fibra sem ler", com 129 mil curtidas. O modelo promoveu a meme, com gancho
// de produto e tudo. Pra uma operadora, item político no report não é ruído:
// é incidente com o cliente.
//
// O DNA da Vivo já diz "evitar tom político" e não bastou — o modelo recebe o
// dado, acha engraçado e relevante, e o "evitar" vira preferência que perde
// pra um número alto de engajamento. Por isso o corte é feito ANTES do modelo,
// nos dados: o que não entra no payload não pode virar tendência. A regra no
// prompt (ver SYSTEM_PROMPT) continua existindo como segunda camada.
//
// Escopo deliberadamente estreito: política institucional/partidária e crime
// violento. Religião, saúde e afins ficam de fora porque o corte por palavra
// derrubaria conteúdo legítimo ("Deus me livre", "vacina de hype"). É um
// filtro de termo, não um classificador: erra pra menos. Estender é adicionar
// à lista abaixo; cada termo casa por palavra inteira e sem acento.

// Nomes e instituições. Sem acento e em minúsculas: o texto é normalizado antes
// de comparar, então "Tarcísio" e "tarcisio" caem no mesmo termo.
const TERMOS_POLITICA = [
  // figuras
  "lula",
  "bolsonaro",
  "dilma",
  "temer",
  "haddad",
  "tarcisio",
  "janja",
  "michelle bolsonaro",
  "alexandre de moraes",
  "ciro gomes",
  "pablo marcal",
  "nikolas ferreira",
  "gleisi",
  "alcolumbre",
  "zema",
  "caiado",
  "eduardo leite",
  "ratinho junior",
  "flavio bolsonaro",
  "eduardo bolsonaro",
  "carlos bolsonaro",
  "simone tebet",
  "marina silva",
  "boulos",
  "erika hilton",
  "damares",
  "malafaia",
  "trump",
  "biden",
  "milei",
  "maduro",
  "putin",
  "netanyahu",
  // instituições e cargos
  "stf",
  "tse",
  "supremo tribunal",
  "planalto",
  "congresso",
  "senado",
  "senador",
  "senadora",
  "camara dos deputados",
  "deputado",
  "deputada",
  "vereador",
  "vereadora",
  "governador",
  "governadora",
  "ministro",
  "ministra",
  "ministerio",
  "presidente da republica",
  "presidencia",
  "prefeitura",
  "cpi",
  "cpmi",
  // vocabulário partidário e eleitoral
  "eleicao",
  "eleicoes",
  "eleitoral",
  "candidato",
  "candidata",
  "candidatura",
  "urna",
  "urnas",
  "impeachment",
  "golpe de estado",
  "golpista",
  "golpistas",
  "petista",
  "petistas",
  "bolsonarista",
  "bolsonaristas",
  "lulista",
  "esquerdista",
  "direitista",
  "extrema direita",
  "extrema esquerda",
  "comunista",
  "fascista",
  "ditadura",
  "militante",
  "militancia",
  "8 de janeiro",
  "anistia",
  "reforma tributaria",
  "reforma da previdencia",
  "escala 6x1",
  "pec",
  "medida provisoria",
  "sancionou",
  "sancionada",
  "vetou",
  "veto presidencial",
];

// Crime violento e tragédia. Marca não se insere nisso nem por engano.
const TERMOS_VIOLENCIA = [
  "assassinato",
  "assassinado",
  "assassinada",
  "assassino",
  "homicidio",
  "feminicidio",
  "estupro",
  "estuprador",
  "estuprada",
  "pedofilia",
  "pedofilo",
  "chacina",
  "massacre",
  "tiroteio",
  "atentado",
  "terrorista",
  "terrorismo",
  "sequestro",
  "sequestrada",
  "sequestrado",
  "cadaver",
  "suicidio",
];

// Siglas de partido. Separadas porque casam SÓ em maiúsculas e sem
// normalização: "pt" minúsculo é código de idioma ("pt-BR") e aparece em
// qualquer caption. Lookahead negativo cobre o "PT-BR" maiúsculo. NOVO e REDE
// ficam de fora de propósito: "NOVO VÍDEO" e "REDE GLOBO" derrubariam metade
// das captions em caixa alta.
const SIGLAS_PARTIDO = /\b(PT|PL|PSOL|PSDB|MDB|PDT|PCdoB|PTB|PSB|UNIAO BRASIL|UNIÃO BRASIL)\b(?![-_ ]?(?:BR|PT|br))/;

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Uma regex só, compilada uma vez. Cada termo casa por palavra inteira
// ("lula" NÃO casa "celular"); `\b` funciona porque o texto já está sem
// acento, então toda letra é ASCII e conta como \w.
const REGEX_TERMOS = new RegExp(
  "\\b(?:" +
    [...TERMOS_POLITICA, ...TERMOS_VIOLENCIA]
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"))
      .join("|") +
    ")\\b"
);

/**
 * Diz se um texto toca em política/violência. Devolve o termo que casou (pra
 * log) ou null. Exportada pra ser testável sem rodar coleta.
 */
export function termoSensivel(texto: string | undefined | null): string | null {
  if (!texto) return null;
  const sigla = texto.match(SIGLAS_PARTIDO);
  if (sigla) return sigla[1];
  const m = normalizar(texto).match(REGEX_TERMOS);
  return m ? m[0] : null;
}

function textoTikTok(i: TikTokItem): string {
  return [i.text, (i.hashtags ?? []).join(" "), i.musicName, i.transcricao]
    .filter(Boolean)
    .join(" ");
}

export type DiagnosticoSafety = {
  removidos: Record<keyof RawData, number>;
  exemplos: string[];
  resumo: string;
};

/**
 * Remove de cada fonte os itens que tocam em política/violência. Roda sobre a
 * coleta INTEIRA, antes de cluster e trim, porque um item político não pode
 * nem servir de evidência de transbordo.
 *
 * Não muta o RawData recebido: devolve um novo, mais o diagnóstico com
 * contagem por fonte e alguns exemplos do que saiu (título curto + termo) —
 * é o que permite auditar no log por que um item sumiu.
 */
export function filtrarBrandSafety(raw: RawData): {
  dados: RawData;
  diag: DiagnosticoSafety;
} {
  const removidos: Record<keyof RawData, number> = {
    instagram: 0,
    tiktok: 0,
    twitter: 0,
    news: 0,
    reddit: 0,
  };
  const exemplos: string[] = [];

  function peneirar<T>(
    fonte: keyof RawData,
    itens: T[],
    texto: (i: T) => string
  ): T[] {
    return itens.filter((i) => {
      const termo = termoSensivel(texto(i));
      if (!termo) return true;
      removidos[fonte] += 1;
      if (exemplos.length < 8) {
        const resumo = texto(i).replace(/\s+/g, " ").trim().slice(0, 70);
        exemplos.push(`${fonte}: "${resumo}" (termo: ${termo})`);
      }
      return false;
    });
  }

  const dados: RawData = {
    instagram: peneirar("instagram", raw.instagram, (i) =>
      [i.caption, (i.hashtags ?? []).join(" ")].filter(Boolean).join(" ")
    ),
    tiktok: peneirar("tiktok", raw.tiktok, textoTikTok),
    twitter: peneirar("twitter", raw.twitter, (i) => i.text ?? ""),
    news: peneirar("news", raw.news, (i) =>
      [i.title, i.snippet].filter(Boolean).join(" ")
    ),
    reddit: peneirar("reddit", raw.reddit, (i) => i.title ?? ""),
  };

  const total = Object.values(removidos).reduce((s, n) => s + n, 0);
  const porFonte = (Object.keys(removidos) as (keyof RawData)[])
    .filter((f) => removidos[f] > 0)
    .map((f) => `${f}=${removidos[f]}`)
    .join(", ");
  const resumo = total
    ? `${total} item(ns) removido(s) por brand safety (${porFonte})`
    : "nenhum item removido por brand safety";

  return { dados, diag: { removidos, exemplos, resumo } };
}

/**
 * Segunda passada, só no TikTok: a transcrição chega DEPOIS do trim (ver
 * enriquecerComLegendas), então um vídeo com caption inocente e fala política
 * passa pelo primeiro filtro. Aqui ele é pego pela fala.
 */
export function filtrarTikTokPorTranscricao(itens: TikTokItem[]): {
  itens: TikTokItem[];
  removidos: number;
} {
  const antes = itens.length;
  const filtrados = itens.filter((i) => !termoSensivel(i.transcricao));
  return { itens: filtrados, removidos: antes - filtrados.length };
}

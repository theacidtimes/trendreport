import Anthropic from "@anthropic-ai/sdk";
import {
  collectAll,
  diagnosticarColeta,
  type ApifyRunLog,
  type SearchTerms,
  type SourceName,
} from "./apify";
import { custoAnthropic, type RegistroCusto } from "./custos";
import { enriquecerComLegendas } from "./legendas";
import {
  SYSTEM_PROMPT,
  CREATIVE_METHOD,
  buildBrandBlock,
  systemPromptDynamic,
} from "./systemPrompt";
import type {
  ClusterTrend,
  InstagramItem,
  MarcaKnowledge,
  RawData,
  RedditItem,
  TikTokItem,
  TrendReport,
} from "./types";

export type ReportProgress =
  | { phase: "briefing"; sources_done: SourceName[] }
  | { phase: "collecting"; sources_done: SourceName[] }
  | { phase: "model"; sources_done: SourceName[] };

export type OnProgress = (progress: ReportProgress) => void | Promise<void>;

const anthropic = new Anthropic();

const MODELO_REPORT = "claude-sonnet-4-6";
const MODELO_TERMOS = "claude-haiku-4-5-20251001";

// Custo de fornecedor medido durante a geração, sem os campos que só quem
// chama conhece (tenant, marca, origem). Este arquivo mede; quem tem o
// contexto do cliente é que grava — ver scripts/generate-report.ts.
export type CustoColetado = Omit<
  RegistroCusto,
  "tenantId" | "marcaId" | "origem"
>;

// Converte o log de runs da Apify em lançamentos de custo. Só entra o que tem
// run id E valor: run sem id não é rastreável e run sem valor terminal teria
// número parcial — nos dois casos é melhor deixar o backfill resolver do que
// gravar uma linha que a idempotência congela errada pra sempre.
// Exportada só pra ser testável (scripts/check-apify-run.ts): é uma regra de
// filtro cujo erro não levanta exceção nenhuma — só faz o custo sumir.
export function custosDaApify(log: ApifyRunLog): CustoColetado[] {
  return log
    .filter((r) => r.runId && r.custoUsd !== null)
    .map((r) => ({
      provedor: "apify" as const,
      detalhe: r.fonte,
      ref: r.runId!,
      custoUsd: r.custoUsd!,
      ocorridoEm: r.startedAt ?? undefined,
    }));
}

// O `id` da resposta do Anthropic é a chave natural do evento — mesmo papel
// que o run id tem na Apify. Modelo fora da tabela de preços devolve null e
// vira log, nunca zero (zero somaria como "saiu de graça").
function registrarLlm(
  custos: CustoColetado[],
  modelo: string,
  response: { id?: string; usage?: Anthropic.Usage } | null | undefined
) {
  if (!response?.id) return;
  const usd = custoAnthropic(modelo, response.usage);
  if (usd === null) {
    console.error(
      `[REPORT][CUSTO] modelo '${modelo}' fora da tabela de precos em ` +
        `lib/custos.ts — custo de LLM deste report NAO foi contabilizado`
    );
    return;
  }
  custos.push({
    provedor: "anthropic",
    detalhe: modelo,
    ref: response.id,
    custoUsd: usd,
    tokensIn: response.usage?.input_tokens,
    tokensOut: response.usage?.output_tokens,
  });
}

// Sequências de 2+ palavras Capitalizadas (ex: "Mortal Kombat", "Warner Play").
// São os melhores termos de News: o nome do cliente sozinho ("Warner Bros Games")
// costuma voltar 0 na busca, mas o IP/título ("Mortal Kombat") volta dezenas.
// Exigir 2+ palavras evita capturar início de frase ("Objetivo", "Proposta").
function properNounPhrases(text: string): string[] {
  const matches = text.match(
    /[A-ZÀ-Þ][A-Za-zÀ-ÿ]+(?:\s+[A-ZÀ-Þ][A-Za-zÀ-ÿ]+)+/g
  );
  return matches ? matches.map((m) => m.trim()) : [];
}

function extractKeywords(briefing: Record<string, unknown>): string[] {
  const keywords = new Set<string>();

  if (typeof briefing.cliente === "string") keywords.add(briefing.cliente);

  // Nomes próprios do briefing entram logo após o cliente para que News (que usa
  // só os 3 primeiros termos) veja queries fortes, não frases de meme.
  for (const field of ["contexto", "quero"] as const) {
    if (typeof briefing[field] === "string") {
      for (const p of properNounPhrases(briefing[field] as string)) {
        keywords.add(p);
      }
    }
  }

  if (Array.isArray(briefing.memes_que_vi)) {
    for (const m of briefing.memes_que_vi) {
      if (typeof m === "string") keywords.add(m.split("(")[0].trim());
    }
  }

  if (typeof briefing.contexto === "string") {
    const words = briefing.contexto
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .slice(0, 5);
    words.forEach((w) => keywords.add(w.replace(/[^\wÀ-ÿ]/g, "")));
  }

  return Array.from(keywords).filter(Boolean).slice(0, 8);
}

// news precisa de query jornalística (marca/IP/evento), social precisa de
// meme/hashtag/nome do IP. Mandar a mesma keyword pra tudo era o que fazia News
// zerar (recebia frase de meme). O tipo SearchTerms vem de apify.ts.
const DERIVE_SYSTEM = `Você deriva TERMOS DE BUSCA a partir do briefing de um relatório de tendências. Esses termos alimentam scrapers de TikTok, Twitter e Google News (Brasil). Você NÃO escreve o relatório, só decide o que buscar. Buscar amplo é bom: quanto mais território real você cobrir, mais matéria-prima o relatório tem pra peneirar. A trava contra invenção acontece DEPOIS, no relatório (todo item precisa existir nos dados coletados), então aqui você pode e deve abrir o leque.

Regras:
- Ancore tudo no universo do briefing: marca/cliente, IPs, produtos, títulos, eventos, datas e memes citados, MAIS o território cultural em volta (comportamentos, nostalgia, ansiedade de lançamento, rituais e hábitos do público). Expanda para variações, sinônimos e nomes do mesmo universo.
- Não atribua ao cliente uma marca, produto ou evento concorrente como se fosse dele. Mas PODE (e deve) buscar correntes culturais vizinhas: se o briefing é sobre um game de luta clássico, "saudade de fliperama" e "hype de lançamento de game" são território válido de busca.
- social (3 a 5 termos): busca direta em rede social. Nome do IP, memes, hashtags, gírias do briefing. Priorize o que gera vídeo ou post.
- adjacent (3 a 5 termos): o ENTORNO. Temas do MESMO território cultural que NÃO citam a marca/IP diretamente, onde a marca poderia se inserir. É o que diferencia este relatório de um monitoramento de marca comum: pega a conversa em volta, não só as menções diretas. Ex.: influencer que virou a noite jogando, nostalgia de lan house, ansiedade por um lançamento do mesmo nicho.
- news (2 a 4 queries): pauta de imprensa, curtas e de alta cobertura. Pelo menos uma query deve ser o IP ou título mais forte SOZINHO (por exemplo, apenas "Mortal Kombat"), que rende muito mais resultados que combinações longas. As demais podem trazer a marca ou um evento nomeado. Evite frase de meme, não vira notícia, e evite empilhar 3 ou mais palavras numa mesma query.
- Termos em português do Brasil, exceto nomes próprios em inglês.`;

const DERIVE_TOOL: Anthropic.Tool = {
  name: "termos_de_busca",
  description:
    "Devolve os termos de busca, ancorados no briefing, para raspar redes sociais e notícias.",
  input_schema: {
    type: "object",
    properties: {
      social: {
        type: "array",
        items: { type: "string" },
        description:
          "3 a 5 termos curtos pra busca DIRETA em TikTok/Twitter (IP, memes, hashtags citados).",
      },
      adjacent: {
        type: "array",
        items: { type: "string" },
        description:
          "3 a 5 temas do MESMO território cultural do briefing que NÃO citam a marca/IP direto (nostalgia, hype de lançamento vizinho, hábitos do público). É o entorno onde a marca pode se inserir.",
      },
      news: {
        type: "array",
        items: { type: "string" },
        description:
          "2 a 4 queries jornalísticas (marca, IP, evento nomeado no briefing).",
      },
    },
    required: ["social", "adjacent", "news"],
  },
};

// Decupa o briefing em termos de busca via LLM (Haiku). É a matéria-prima da
// raspagem, não fato do report: buscar melhor não afrouxa a trava anti-invenção,
// que continua no report (todo item precisa existir nos dados coletados). Se a
// chamada falhar ou vier vazia, cai no extractKeywords determinístico pra nenhum
// scraper rodar sem termo.
async function deriveSearchTerms(
  briefingYaml: string,
  briefing: Record<string, unknown>,
  custos?: CustoColetado[]
): Promise<SearchTerms> {
  const fallback = (): SearchTerms => {
    const kw = extractKeywords(briefing);
    // O determinístico não sabe derivar entorno cultural, então adjacent fica
    // vazio no fallback — as buscas sociais rodam só com os termos diretos.
    return { social: kw, news: kw.slice(0, 3), adjacent: [] };
  };

  const cleanList = (v: unknown): string[] =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
      : [];

  try {
    const response = await anthropic.messages.create({
      model: MODELO_TERMOS,
      max_tokens: 500,
      system: DERIVE_SYSTEM,
      tools: [DERIVE_TOOL],
      tool_choice: { type: "tool", name: "termos_de_busca" },
      messages: [{ role: "user", content: `BRIEFING (YAML):\n${briefingYaml}` }],
    });

    // Antes do fallback: a chamada foi cobrada mesmo que o resultado não sirva.
    if (custos) registrarLlm(custos, MODELO_TERMOS, response);

    const toolUse = response.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
    );
    if (!toolUse) return fallback();

    const out = toolUse.input as {
      social?: unknown;
      news?: unknown;
      adjacent?: unknown;
    };
    const social = cleanList(out.social).slice(0, 5);
    const news = cleanList(out.news).slice(0, 4);
    // adjacent é aditivo (amplia a busca social), então vazio é aceitável e não
    // precisa de fallback determinístico.
    const adjacent = cleanList(out.adjacent).slice(0, 5);

    if (social.length === 0 && news.length === 0) return fallback();

    // Se só uma lane veio vazia, completa com o determinístico pra aquela fonte
    // não rodar sem termo.
    const fb = fallback();
    return {
      social: social.length ? social : fb.social,
      news: news.length ? news : fb.news,
      adjacent,
    };
  } catch (err) {
    console.error(
      "deriveSearchTerms falhou, usando extractKeywords:",
      err instanceof Error ? err.message : String(err)
    );
    return fallback();
  }
}

// Quando o report tem marca cadastrada, a busca soma os termos EVERGREEN do YAML
// (os mesmos que o radar usa) com os termos PONTUAIS derivados do briefing. Assim
// a coleta cobre tanto o entorno permanente da marca quanto o tema da edição.
// Sem marca, devolve os termos do briefing intactos (comportamento avulso).
function mergeMarcaTerms(
  terms: SearchTerms,
  m?: MarcaKnowledge
): SearchTerms {
  if (!m) return terms;

  // Dedup case-insensitive preservando a ordem (pontuais do briefing primeiro,
  // depois os evergreen da marca), com teto por lane pra não estourar scraper.
  const dedupe = (base: string[], extra: string[], cap: number): string[] => {
    const seen = new Set(base.map((t) => t.toLowerCase()));
    const out = [...base];
    for (const t of extra) {
      const key = t.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(t.trim());
      if (out.length >= cap) break;
    }
    return out.slice(0, cap);
  };

  const evergreen = m.termos_busca ?? [];
  const culturais = m.termos_culturais ?? [];

  return {
    social: dedupe(terms.social, evergreen, 7),
    news: dedupe(terms.news, evergreen, 5),
    // adjacent é a lane do entorno cultural: casa com os termos_culturais da marca.
    adjacent: dedupe(terms.adjacent, culturais, 7),
  };
}

function topByEngagement<T>(items: T[], score: (item: T) => number, limit: number): T[] {
  return [...items].sort((a, b) => score(b) - score(a)).slice(0, limit);
}

// O modelo é instruído a devolver só JSON, mas de vez em quando ainda embrulha
// em cercas de markdown (```json) ou solta uma frase antes/depois. Isto recorta
// o objeto de forma robusta: tira cercas e descarta qualquer prosa fora do
// primeiro { … último }.
function extractJson(text: string): string {
  let t = text.trim();

  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) t = fence[1].trim();

  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    t = t.slice(start, end + 1);
  }

  return t;
}

// Manda só o topo de cada fonte pra Claude — o payload bruto (54 posts de
// Instagram, 40 de TikTok etc.) infla o contexto e é a principal causa da
// geração levar minutos. `fontes`/o guard de zero-dado continuam usando o
// total real coletado (rawData), só o que vai pro modelo é reduzido.
// As contas de meme têm ordem de grandeza menos de likes que g1/flamengo, então
// num corte único por engajamento elas nunca entram e a seção de memes fica sem
// matéria-prima. Por isso o corte é feito em duas cotas separadas.
function topInstagram(items: InstagramItem[]): InstagramItem[] {
  const likes = (i: InstagramItem) => i.likesCount ?? 0;
  return [
    ...topByEngagement(items.filter((i) => i.fonte === "meme"), likes, 8),
    ...topByEngagement(items.filter((i) => i.fonte !== "meme"), likes, 12),
  ];
}

// Mesma armadilha do Instagram, e a cota separada na coleta não resolve sozinha:
// de nada adianta garantir vaga na raspagem se o corte pro modelo é um top-10
// único por upvote. Os subs de meme e os de discussão têm ordem de grandeza
// diferente de upvote (HUEstation tem ~68k ativos por semana, eu_nvr é bem menor),
// então um corte só entrega as 10 vagas pro lado maior — e o lado que perde some
// inteiro do report. Qual dos dois vence não importa: os dois precisam chegar.
function topReddit(items: RedditItem[]): RedditItem[] {
  const votos = (i: RedditItem) => i.upVotes ?? 0;
  return [
    ...topByEngagement(items.filter((i) => i.fonte === "meme"), votos, 5),
    ...topByEngagement(items.filter((i) => i.fonte !== "meme"), votos, 10),
  ];
}

function mediana(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  return s.length % 2
    ? s[meio]
    : Math.round((s[meio - 1] + s[meio]) / 2);
}

// Concentração das durações em volta da mediana. Se 70%+ dos vídeos ficam a ±25%
// da mediana, o áudio está ditando o formato (todos cortam no mesmo tempo). Hit
// usado como música de fundo não tem essa disciplina: dura o que o autor quiser.
function duracaoConsistente(duracoes: number[], med: number): boolean {
  if (duracoes.length < 2 || med <= 0) return false;
  const dentro = duracoes.filter((d) => Math.abs(d - med) <= med * 0.25).length;
  return dentro / duracoes.length >= 0.7;
}

// Hashtag de alcance, não de assunto: aparece em qualquer vídeo e por isso não
// diz nada sobre coerência temática do cluster.
const HASHTAGS_GENERICAS = new Set([
  "fyp",
  "fy",
  "foryou",
  "foryoupage",
  "parati",
  "paratii",
  "viral",
  "viralvideo",
  "trend",
  "trending",
  "tiktok",
  "brasil",
  "br",
  "explore",
  "capcut",
]);

// Repetição de som/hashtag entre criadores distintos é o ponto de partida, não a
// conclusão: ela não separa áudio-MOLDE (dita o formato) de áudio-PAPEL-DE-PAREDE
// (hit tocando atrás de conteúdo sem relação), e no Brasil o segundo é o caso mais
// comum. Por isso cada candidato sai daqui qualificado por duração, vocabulário,
// engajamento mediano e transbordo — as mesmas dimensões do lib/radar/scoreHype.ts,
// onde comportamento pesa e imprensa é só âncora.
// Roda sobre a coleta INTEIRA, não sobre o recorte enviado ao modelo: a repetição
// só aparece com a amostra completa. Quem garante que os vídeos destes exemplos
// cheguem ao modelo é o trimForModel, que recebe estas URLs de volta.
export function detectarClusters(
  itens: TikTokItem[],
  corpusExterno: { fonte: string; texto: string }[] = []
): ClusterTrend[] {
  const grupos = new Map<
    string,
    {
      tipo: ClusterTrend["tipo"];
      chave: string;
      videos: number;
      criadores: Set<string>;
      exemplos: string[];
      duracoes: number[];
      engajamentos: number[];
      contagemHashtags: Map<string, number>;
    }
  >();

  const registrar = (
    tipo: ClusterTrend["tipo"],
    id: string | undefined,
    rotulo: string | undefined,
    item: TikTokItem
  ) => {
    if (!id || !rotulo) return;
    const mapKey = `${tipo}:${id}`;
    const grupo = grupos.get(mapKey) ?? {
      tipo,
      chave: rotulo,
      videos: 0,
      criadores: new Set<string>(),
      exemplos: [],
      duracoes: [],
      engajamentos: [],
      contagemHashtags: new Map<string, number>(),
    };
    grupo.videos += 1;
    if (item.authorNickName) grupo.criadores.add(item.authorNickName);
    if (item.webVideoUrl && grupo.exemplos.length < 3) {
      grupo.exemplos.push(item.webVideoUrl);
    }
    if (typeof item.duration === "number" && item.duration > 0) {
      grupo.duracoes.push(item.duration);
    }
    grupo.engajamentos.push((item.diggCount ?? 0) + (item.playCount ?? 0));
    for (const tag of item.hashtags ?? []) {
      const t = tag.toLowerCase();
      if (HASHTAGS_GENERICAS.has(t)) continue;
      // Num cluster de hashtag, a própria chave está em 100% dos vídeos por
      // definição e não é evidência de coerência.
      if (tipo === "hashtag" && t === id) continue;
      grupo.contagemHashtags.set(t, (grupo.contagemHashtags.get(t) ?? 0) + 1);
    }
    grupos.set(mapKey, grupo);
  };

  for (const item of itens) {
    // A exigência de 2+ criadores distintos (abaixo) já descarta som exclusivo de
    // um criador, então NÃO filtramos musicOriginal aqui: trend de formato
    // costuma nascer justamente de um som original que viralizou e foi reusado.
    // Filtrar cortaria o caso mais forte. O rótulo ganha o autor porque vários
    // sons originais distintos compartilham o mesmo nome genérico.
    const rotuloAudio = item.musicOriginal
      ? `${item.musicName} (som original de ${item.musicAuthor ?? "autor desconhecido"})`
      : item.musicName;
    registrar("audio", item.musicId, rotuloAudio, item);
    for (const tag of item.hashtags ?? []) {
      // #fyp e companhia não podem VIRAR cluster: estão em quase todo vídeo, logo
      // sempre reúnem o máximo de criadores e ocupariam as 12 vagas do topo
      // empurrando candidato real pra fora. Marcam alcance, não assunto.
      if (HASHTAGS_GENERICAS.has(tag.toLowerCase())) continue;
      registrar("hashtag", tag.toLowerCase(), tag, item);
    }
  }

  return Array.from(grupos.values())
    .filter((g) => g.criadores.size >= 2)
    .map((g) => {
      const duracao_mediana = mediana(g.duracoes);
      const duracao_consistente = duracaoConsistente(g.duracoes, duracao_mediana);
      const engajamento_mediano = mediana(g.engajamentos);
      const hashtags_comuns = Array.from(g.contagemHashtags.entries())
        .filter(([, n]) => n >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([t]) => t);
      const transbordo = fontesQueMencionam(g.chave, corpusExterno);
      const criadores = g.criadores.size;

      // Pesos: replicabilidade (criadores) é o núcleo, duração consistente é o
      // que separa molde de papel de parede, e transbordo é âncora de peso baixo
      // — mesma hierarquia do scoreHype (comportamento manda, imprensa ancora).
      const forca = Math.min(
        100,
        Math.round(
          Math.min(criadores * 8, 40) +
            (duracao_consistente ? 20 : 0) +
            Math.min(hashtags_comuns.length * 7, 15) +
            Math.min(engajamento_mediano / 200, 15) +
            Math.min(transbordo.length * 5, 10)
        )
      );

      return {
        tipo: g.tipo,
        chave: g.chave,
        videos: g.videos,
        criadores,
        exemplos: g.exemplos,
        duracao_mediana,
        duracao_consistente,
        engajamento_mediano,
        hashtags_comuns,
        transbordo,
        forca,
      };
    })
    .sort((a, b) => b.forca - a.forca)
    .slice(0, 12);
}

// Texto de todas as fontes MENOS o TikTok, pra medir transbordo. Sai do rawData
// completo (não do recorte enviado ao modelo): quanto mais texto, melhor a chance
// de detectar que o assunto vazou do TikTok pra imprensa/fórum.
function corpusExterno(rawData: RawData): { fonte: string; texto: string }[] {
  return [
    ...rawData.news.map((n) => ({
      fonte: "news",
      texto: `${n.title ?? ""} ${n.snippet ?? ""}`,
    })),
    ...rawData.reddit.map((r) => ({ fonte: "reddit", texto: r.title ?? "" })),
    ...rawData.twitter.map((t) => ({ fonte: "twitter", texto: t.text ?? "" })),
    ...rawData.instagram.map((i) => ({
      fonte: "instagram",
      texto: i.caption ?? "",
    })),
  ];
}

// Transbordo: a chave do cluster aparece fora do TikTok? Exige 4+ caracteres e
// limite de palavra pra "br" ou "fy" não casarem com meio texto. Serve mais pra
// cluster de hashtag — nome de áudio raramente vira pauta —, e é justamente por
// isso que pesa pouco no score.
function fontesQueMencionam(
  chave: string,
  corpus: { fonte: string; texto: string }[]
): string[] {
  const termo = chave.trim().toLowerCase();
  if (termo.length < 4) return [];
  const padrao = new RegExp(
    `\\b${termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i"
  );
  const fontes = new Set<string>();
  for (const { fonte, texto } of corpus) {
    if (padrao.test(texto)) fontes.add(fonte);
  }
  return Array.from(fontes);
}

// O corte do TikTok é por engajamento, mas cluster não é feito de vídeo popular
// e sim de vídeo repetido: os dois critérios não coincidem. Com 20 por keyword a
// coleta passa de 100 vídeos e o topo por engajamento quase nunca contém os
// vídeos que sustentam um cluster, então o modelo receberia "6 criadores no
// mesmo áudio" sem nenhum desses vídeos em mãos, sem como tirar autor, coverUrl
// ou descrever a trend. Estes entram além da cota, senão a evidência fica órfã.
// O acréscimo é limitado por construção: 12 clusters × 3 exemplos = no máximo 36
// URLs, então o payload de TikTok fica em 51 itens no pior caso.
export function topTikTok(items: TikTokItem[], urlsClusters: Set<string>): TikTokItem[] {
  const topo = topByEngagement(
    items,
    (i) => (i.diggCount ?? 0) + (i.playCount ?? 0),
    15
  );
  const jaIncluso = new Set(topo.map((i) => i.webVideoUrl));
  const sustentamCluster = items.filter(
    (i) => i.webVideoUrl && urlsClusters.has(i.webVideoUrl) && !jaIncluso.has(i.webVideoUrl)
  );
  return [...topo, ...sustentamCluster];
}

function trimForModel(rawData: RawData, urlsClusters: Set<string>): RawData {
  return {
    instagram: topInstagram(rawData.instagram),
    tiktok: topTikTok(rawData.tiktok, urlsClusters),
    twitter: topByEngagement(rawData.twitter, (i) => (i.likeCount ?? 0) + (i.replyCount ?? 0), 20),
    news: rawData.news.slice(0, 10),
    reddit: topReddit(rawData.reddit),
  };
}

export async function generateReport(
  briefingYaml: string,
  briefing: Record<string, unknown>,
  onProgress?: OnProgress,
  marcaKnowledge?: MarcaKnowledge
): Promise<
  ({ report: TrendReport } | { error: string }) & { custos: CustoColetado[] }
> {
  // Acumuladores de custo. Vão em TODOS os caminhos de retorno, inclusive nos
  // de erro: report que falhou no meio já gastou scrape e já gastou token, e
  // esse dinheiro saiu do cartão do mesmo jeito. Não registrar o custo do
  // fracasso é a maneira mais fácil de o painel financeiro mentir pra baixo.
  const custos: CustoColetado[] = [];
  const apifyLog: ApifyRunLog = [];

  const terms = mergeMarcaTerms(
    await deriveSearchTerms(briefingYaml, briefing, custos),
    marcaKnowledge
  );
  const sourcesDone: SourceName[] = [];

  await onProgress?.({ phase: "collecting", sources_done: [] });

  const rawData = await collectAll(
    terms,
    (source) => {
      sourcesDone.push(source);
      // Best-effort: se o update no Supabase falhar, não deve derrubar a
      // coleta de dados em si — só a barra de progresso fica desatualizada.
      void onProgress?.({ phase: "collecting", sources_done: [...sourcesDone] });
    },
    apifyLog
  );

  const diag = diagnosticarColeta(apifyLog);
  console.log(`[REPORT][APIFY] ${diag.resumo}`);
  custos.push(...custosDaApify(apifyLog));

  const totalColetado =
    rawData.instagram.length +
    rawData.tiktok.length +
    rawData.twitter.length +
    rawData.news.length +
    rawData.reddit.length;

  // Se nenhuma fonte trouxe dado real (falha/timeout dos scrapers Apify),
  // não deixamos o modelo gerar um report inteiro inventado sem lastro.
  if (totalColetado === 0) {
    // "Sem saldo na Apify" e "falha temporária" pedem reações OPOSTAS: uma é
    // recarregar a conta, a outra é esperar. Até aqui as duas produziam a
    // mesma frase — e "tente novamente em alguns minutos" é uma instrução
    // falsa quando o problema é a fatura, porque tentar de novo nunca resolve.
    return {
      custos,
      error: diag.semSaldo
        ? "A coleta não rodou: a Apify recusou os scrapers por motivo de conta/pagamento (saldo ou limite de uso do plano). Tentar de novo não resolve — é preciso regularizar o plano da Apify."
        : "Nenhum dado real foi coletado das redes (Instagram, TikTok, Twitter, News, Reddit). Tente novamente em alguns minutos — provável falha temporária nos scrapers.",
    };
  }

  // Ordem importa: os clusters saem da coleta inteira (a repetição só aparece na
  // amostra completa) e só então o trim monta o payload, garantindo que os
  // vídeos citados como exemplo estejam entre os que o modelo recebe.
  const clusters = detectarClusters(rawData.tiktok, corpusExterno(rawData));
  const enviados = trimForModel(
    rawData,
    new Set(clusters.flatMap((c) => c.exemplos))
  );

  // A transcrição entra AQUI, depois do trim, e não na coleta: são até 51
  // vídeos em vez dos ~200 coletados. O clustering não usa transcrição (ele
  // agrupa por som e hashtag, que já rodou acima) — quem precisa da fala é o
  // modelo, e o modelo só vê o que sobreviveu ao trim.
  const diagLegendas = await enriquecerComLegendas(enviados.tiktok);
  console.log(`[REPORT][LEGENDA] ${diagLegendas.resumo}`);
  if (diagLegendas.comLink > 0 && diagLegendas.baixadas === 0) {
    // Ofereceram legenda em todos e não veio nenhuma: não é vídeo mudo, é o
    // download quebrado (URL expirada, CDN bloqueando, formato mudou). O
    // report ainda sai, com a relevância de antes — mas em silêncio isso seria
    // uma regressão invisível, exatamente o tipo de falha que já nos custou
    // caro no débito de crédito.
    console.error(
      `[REPORT][LEGENDA] ${diagLegendas.comLink} video(s) tinham legenda e NENHUMA foi baixada — ` +
        `a relevância volta a ser julgada só pela caption. Conferir o CDN/formato em lib/legendas.ts.`
    );
  }

  const userMessage = `BRIEFING (YAML):\n${briefingYaml}\n\nDADOS COLETADOS AGORA (JSON):\n${JSON.stringify(
    enviados
  )}\n\nCANDIDATOS A TREND NO TIKTOK (JSON):\n${JSON.stringify(clusters)}`;

  await onProgress?.({ phase: "model", sources_done: sourcesDone });

  const response = await anthropic.messages
    .stream({
      model: MODELO_REPORT,
      max_tokens: 8000,
      system: [
        {
          type: "text",
          text: `${CREATIVE_METHOD}\n\n---\n\n${buildBrandBlock(marcaKnowledge)}\n\n---\n\n${SYSTEM_PROMPT}`,
          cache_control: { type: "ephemeral" },
        },
        { type: "text", text: systemPromptDynamic() },
      ],
      // Este modelo não aceita prefill de assistant (a conversa precisa terminar
      // num user message), então só mandamos o user. O preâmbulo/cerca que o
      // modelo eventualmente coloca é limpo depois por extractJson.
      messages: [{ role: "user", content: userMessage }],
    })
    .finalMessage();

  // Antes de qualquer validação do conteúdo: os tokens já foram cobrados,
  // inclusive os da resposta que vamos descartar logo abaixo.
  registrarLlm(custos, MODELO_REPORT, response);

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { custos, error: "Resposta vazia do modelo." };
  }

  // Se a geração bateu no teto de tokens, o JSON quase certamente saiu cortado
  // no meio — melhor avisar com clareza do que estourar um parse genérico.
  if (response.stop_reason === "max_tokens") {
    console.error("Geração truncada (stop_reason=max_tokens): JSON provavelmente incompleto.");
    return {
      custos,
      error:
        "O relatório ficou grande demais e foi cortado antes de terminar. Tente gerar de novo.",
    };
  }

  // Limpamos cercas de markdown e qualquer prosa fora do objeto antes de parsear.
  const rawJson = extractJson(textBlock.text);

  let report: TrendReport;
  try {
    report = JSON.parse(rawJson) as TrendReport;
  } catch (err) {
    console.error(
      "Falha ao interpretar JSON do modelo:",
      err instanceof Error ? err.message : String(err),
      "\n--- Início da resposta bruta ---\n",
      rawJson.slice(0, 800)
    );
    return { custos, error: "Falha ao interpretar JSON retornado pelo modelo." };
  }

  // Contagem real de itens coletados por rede — calculada aqui (não pelo
  // modelo) pra garantir que o tracker de fontes nunca exiba número inventado.
  report.fontes = {
    instagram: rawData.instagram.length,
    twitter: rawData.twitter.length,
    tiktok: rawData.tiktok.length,
    news: rawData.news.length,
    reddit: rawData.reddit.length,
  };

  return { report, custos };
}

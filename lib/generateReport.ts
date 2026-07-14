import Anthropic from "@anthropic-ai/sdk";
import { collectAll, type SearchTerms, type SourceName } from "./apify";
import { SYSTEM_PROMPT, VIVO_KNOWLEDGE, systemPromptDynamic } from "./systemPrompt";
import type { RawData, TrendReport } from "./types";

export type ReportProgress =
  | { phase: "briefing"; sources_done: SourceName[] }
  | { phase: "collecting"; sources_done: SourceName[] }
  | { phase: "model"; sources_done: SourceName[] };

export type OnProgress = (progress: ReportProgress) => void | Promise<void>;

const anthropic = new Anthropic();

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
  briefing: Record<string, unknown>
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
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: DERIVE_SYSTEM,
      tools: [DERIVE_TOOL],
      tool_choice: { type: "tool", name: "termos_de_busca" },
      messages: [{ role: "user", content: `BRIEFING (YAML):\n${briefingYaml}` }],
    });

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
function trimForModel(rawData: RawData): RawData {
  return {
    instagram: topByEngagement(rawData.instagram, (i) => i.likesCount ?? 0, 15),
    tiktok: topByEngagement(rawData.tiktok, (i) => (i.diggCount ?? 0) + (i.playCount ?? 0), 15),
    twitter: topByEngagement(rawData.twitter, (i) => (i.likeCount ?? 0) + (i.replyCount ?? 0), 20),
    news: rawData.news.slice(0, 10),
    reddit: topByEngagement(rawData.reddit, (i) => i.upVotes ?? 0, 10),
  };
}

export async function generateReport(
  briefingYaml: string,
  briefing: Record<string, unknown>,
  onProgress?: OnProgress
): Promise<{ report: TrendReport } | { error: string }> {
  const terms = await deriveSearchTerms(briefingYaml, briefing);
  const sourcesDone: SourceName[] = [];

  await onProgress?.({ phase: "collecting", sources_done: [] });

  const rawData = await collectAll(terms, (source) => {
    sourcesDone.push(source);
    // Best-effort: se o update no Supabase falhar, não deve derrubar a
    // coleta de dados em si — só a barra de progresso fica desatualizada.
    void onProgress?.({ phase: "collecting", sources_done: [...sourcesDone] });
  });

  const totalColetado =
    rawData.instagram.length +
    rawData.tiktok.length +
    rawData.twitter.length +
    rawData.news.length +
    rawData.reddit.length;

  // Se nenhuma fonte trouxe dado real (falha/timeout dos scrapers Apify),
  // não deixamos o modelo gerar um report inteiro inventado sem lastro.
  if (totalColetado === 0) {
    return {
      error:
        "Nenhum dado real foi coletado das redes (Instagram, TikTok, Twitter, News, Reddit). Tente novamente em alguns minutos — provável falha temporária nos scrapers.",
    };
  }

  const userMessage = `BRIEFING (YAML):\n${briefingYaml}\n\nDADOS COLETADOS AGORA (JSON):\n${JSON.stringify(
    trimForModel(rawData)
  )}`;

  await onProgress?.({ phase: "model", sources_done: sourcesDone });

  const response = await anthropic.messages
    .stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: [
        {
          type: "text",
          text: `${VIVO_KNOWLEDGE}\n\n---\n\n${SYSTEM_PROMPT}`,
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

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { error: "Resposta vazia do modelo." };
  }

  // Se a geração bateu no teto de tokens, o JSON quase certamente saiu cortado
  // no meio — melhor avisar com clareza do que estourar um parse genérico.
  if (response.stop_reason === "max_tokens") {
    console.error("Geração truncada (stop_reason=max_tokens): JSON provavelmente incompleto.");
    return {
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
    return { error: "Falha ao interpretar JSON retornado pelo modelo." };
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

  return { report };
}

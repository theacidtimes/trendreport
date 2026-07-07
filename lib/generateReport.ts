import Anthropic from "@anthropic-ai/sdk";
import { collectAll, type SourceName } from "./apify";
import { SYSTEM_PROMPT, VIVO_KNOWLEDGE, systemPromptDynamic } from "./systemPrompt";
import type { RawData, TrendReport } from "./types";

export type ReportProgress =
  | { phase: "briefing"; sources_done: SourceName[] }
  | { phase: "collecting"; sources_done: SourceName[] }
  | { phase: "model"; sources_done: SourceName[] };

export type OnProgress = (progress: ReportProgress) => void | Promise<void>;

const anthropic = new Anthropic();

function extractKeywords(briefing: Record<string, unknown>): string[] {
  const keywords = new Set<string>();

  if (typeof briefing.cliente === "string") keywords.add(briefing.cliente);

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

function topByEngagement<T>(items: T[], score: (item: T) => number, limit: number): T[] {
  return [...items].sort((a, b) => score(b) - score(a)).slice(0, limit);
}

// Manda só o topo de cada fonte pra Claude — o payload bruto (54 posts de
// Instagram, 40 de TikTok etc.) infla o contexto e é a principal causa da
// geração levar minutos. `fontes`/o guard de zero-dado continuam usando o
// total real coletado (rawData), só o que vai pro modelo é reduzido.
function trimForModel(rawData: RawData): RawData {
  return {
    instagram: topByEngagement(rawData.instagram, (i) => i.likesCount ?? 0, 15),
    tiktok: topByEngagement(rawData.tiktok, (i) => (i.diggCount ?? 0) + (i.playCount ?? 0), 15),
    twitter: topByEngagement(rawData.twitter, (i) => i.tweetVolume ?? 0, 20),
    news: rawData.news.slice(0, 10),
    reddit: topByEngagement(rawData.reddit, (i) => i.upVotes ?? 0, 10),
  };
}

export async function generateReport(
  briefingYaml: string,
  briefing: Record<string, unknown>,
  onProgress?: OnProgress
): Promise<{ report: TrendReport } | { error: string }> {
  const keywords = extractKeywords(briefing);
  const sourcesDone: SourceName[] = [];

  await onProgress?.({ phase: "collecting", sources_done: [] });

  const rawData = await collectAll(keywords, (source) => {
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
      messages: [{ role: "user", content: userMessage }],
    })
    .finalMessage();

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return { error: "Resposta vazia do modelo." };
  }

  let report: TrendReport;
  try {
    report = JSON.parse(textBlock.text) as TrendReport;
  } catch {
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

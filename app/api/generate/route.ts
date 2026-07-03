import { NextResponse } from "next/server";
import * as yaml from "js-yaml";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { collectAll } from "@/lib/apify";
import { SYSTEM_PROMPT, VIVO_KNOWLEDGE, systemPromptDynamic } from "@/lib/systemPrompt";
import type { TrendReport } from "@/lib/types";

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

export async function POST(req: Request) {
  try {
    const { briefing: briefingYaml } = (await req.json()) as {
      briefing: string;
    };

    if (!briefingYaml || typeof briefingYaml !== "string") {
      return NextResponse.json(
        { error: "Campo 'briefing' é obrigatório." },
        { status: 400 }
      );
    }

    let briefing: Record<string, unknown>;
    try {
      briefing = yaml.load(briefingYaml) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "YAML inválido no briefing." },
        { status: 400 }
      );
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const keywords = extractKeywords(briefing);
    const rawData = await collectAll(keywords);

    const userMessage = `BRIEFING (YAML):\n${briefingYaml}\n\nDADOS COLETADOS AGORA (JSON):\n${JSON.stringify(
      rawData
    )}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: [
        // Conhecimento de marca + regras + schema: estático entre requests,
        // cacheado num único prefixo (cache_control marca o fim do trecho cacheável).
        {
          type: "text",
          text: `${VIVO_KNOWLEDGE}\n\n---\n\n${SYSTEM_PROMPT}`,
          cache_control: { type: "ephemeral" },
        },
        // Data de hoje: muda por request, fica fora do prefixo cacheado.
        { type: "text", text: systemPromptDynamic() },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "Resposta vazia do modelo." },
        { status: 502 }
      );
    }

    let report: TrendReport;
    try {
      report = JSON.parse(textBlock.text) as TrendReport;
    } catch {
      return NextResponse.json(
        { error: "Falha ao interpretar JSON retornado pelo modelo." },
        { status: 502 }
      );
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

    const cliente =
      typeof briefing.cliente === "string" ? briefing.cliente : "Cliente";

    const { data: saved, error: saveError } = await supabase
      .from("reports")
      .insert({
        user_id: user.id,
        cliente,
        briefing,
        report,
      })
      .select("slug")
      .single();

    if (saveError || !saved) {
      console.error("Erro ao salvar report no Supabase:", saveError);
      const detail = saveError
        ? [saveError.message, saveError.details, saveError.hint, saveError.code]
            .filter(Boolean)
            .join(" | ") || JSON.stringify(saveError)
        : "Nenhum dado retornado pelo insert.";
      return NextResponse.json(
        { error: "Falha ao salvar report no Supabase.", detail },
        { status: 500 }
      );
    }

    return NextResponse.json({ slug: saved.slug, report });
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error:", err.status, err.message, err);
      return NextResponse.json(
        { error: `Erro na Anthropic API: ${err.message}` },
        { status: err.status ?? 502 }
      );
    }

    console.error("Erro inesperado em /api/generate:", err);

    return NextResponse.json(
      {
        error: "Erro inesperado ao gerar relatório.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

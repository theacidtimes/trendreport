import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

type Msg = { role: "user" | "assistant"; content: string };

type Fields = {
  cliente: string;
  tom: string;
  data: string;
  contexto: string;
  memes: string[];
  quero: string;
};

const anthropic = new Anthropic();

const SYSTEM = `Você é o copiloto de briefing da CCCaramelo, um estúdio de conteúdo. Sua função é guiar uma social media manager, por conversa, a montar o briefing de um post que vira um relatório de tendências.

Como agir:
- Conduza a conversa. Faça UMA pergunta por vez, curta e objetiva, em português do Brasil, tom próximo e prático.
- Siga uma ordem natural: cliente/marca, depois o contexto (o que aconteceu, datas, fatos), tom desejado, memes ou referências que ela já viu, e por fim o objetivo do post.
- A cada resposta dela, extraia só o que ela realmente informou e preencha os campos correspondentes. Nunca invente dados, marcas, datas ou fatos que ela não disse.
- Não repita perguntas sobre campos já preenchidos. Aproveite o que já existe no estado atual.
- Quando tiver ao menos cliente e contexto bem descritos, e sentir que o briefing está completo o suficiente para gerar o relatório, defina pronto=true e mande uma mensagem curta avisando que está pronto pra revisar e gerar.
- Não use travessões (—) nas mensagens. Prefira ponto ou vírgula.

O campo data usa formato ISO (AAAA-MM-DD). memes é uma lista de referências curtas. Só devolva um campo no patch quando tiver informação nova ou atualizada pra ele.`;

const TOOL: Anthropic.Tool = {
  name: "responder",
  description:
    "Responde a analista com a próxima pergunta e preenche os campos do briefing com o que ela informou.",
  input_schema: {
    type: "object",
    properties: {
      mensagem: {
        type: "string",
        description:
          "Próxima fala do copiloto: uma pergunta curta, ou o aviso de que o briefing está pronto.",
      },
      cliente: { type: "string", description: "Nome do cliente ou marca." },
      tom: { type: "string", description: "Tom desejado do post." },
      data: { type: "string", description: "Data no formato AAAA-MM-DD." },
      contexto: {
        type: "string",
        description: "Contexto: o que aconteceu, fatos, datas, números.",
      },
      memes: {
        type: "array",
        items: { type: "string" },
        description: "Memes ou referências que ela viu.",
      },
      quero: { type: "string", description: "Objetivo do post." },
      pronto: {
        type: "boolean",
        description: "true quando o briefing está completo o suficiente para gerar.",
      },
    },
    required: ["mensagem"],
  },
};

function fieldsSnapshot(f: Fields): string {
  const lines = [
    `cliente: ${f.cliente || "(vazio)"}`,
    `tom: ${f.tom || "(vazio)"}`,
    `data: ${f.data || "(vazio)"}`,
    `contexto: ${f.contexto || "(vazio)"}`,
    `memes: ${f.memes.length ? f.memes.join(", ") : "(vazio)"}`,
    `quero: ${f.quero || "(vazio)"}`,
  ];
  return lines.join("\n");
}

export async function POST(req: Request) {
  try {
    const { messages, fields } = (await req.json()) as {
      messages: Msg[];
      fields: Fields;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Campo 'messages' é obrigatório." },
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

    const convo: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system: `${SYSTEM}\n\nEstado atual dos campos:\n${fieldsSnapshot(fields)}`,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "responder" },
      messages: convo,
    });

    const toolUse = response.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
    );

    if (!toolUse) {
      return NextResponse.json(
        { error: "Modelo não retornou resposta estruturada." },
        { status: 502 }
      );
    }

    const out = toolUse.input as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);

    const patch: Record<string, unknown> = {};
    if (str(out.cliente) !== undefined) patch.cliente = out.cliente;
    if (str(out.tom) !== undefined) patch.tom = out.tom;
    if (str(out.data) !== undefined) patch.data = out.data;
    if (str(out.contexto) !== undefined) patch.contexto = out.contexto;
    if (str(out.quero) !== undefined) patch.quero = out.quero;
    if (Array.isArray(out.memes)) {
      patch.memes = out.memes.filter((m): m is string => typeof m === "string");
    }

    return NextResponse.json({
      message: str(out.mensagem) ?? "Pode me contar mais?",
      patch: Object.keys(patch).length ? patch : null,
      pronto: out.pronto === true,
    });
  } catch (err) {
    console.error("Erro em /api/briefing-assistant:", err);
    return NextResponse.json(
      {
        error: "Erro ao responder.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

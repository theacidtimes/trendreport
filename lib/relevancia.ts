import Anthropic from "@anthropic-ai/sdk";
import { custoAnthropic, type RegistroCusto } from "./custos";
import type { MarcaKnowledge } from "./types";

// RELEVÂNCIA DO ACERVO PARA A MARCA (coluna coleta_item.relevante, migration 0050)
//
// A busca das redes é solta: termo amplo devolve muito vídeo que só bate de
// raspão (meme de casal no acervo de marca de sementes, cripto no de agro com
// "IA" no briefing). O report filtra isso sozinho, porque o modelo escolhe uns
// 15 itens. O acervo não: guarda tudo e o "Montar report" listava tudo.
//
// Um modelo barato lê cada item com o DNA da marca e diz se ele é dela. O
// critério é a MARCA, não o briefing do report: o acervo é da marca e serve a
// reports futuros com outros briefings.

const MODELO = "claude-haiku-5-5";
const POR_LOTE = 50;
const LOTES_SIMULTANEOS = 4;
const TEXTO_MAX = 280;

const anthropic = new Anthropic();

export type ItemParaClassificar = {
  plataforma: string;
  autor: string | null;
  texto: string | null;
};

export type CustoRelevancia = Omit<RegistroCusto, "tenantId" | "marcaId" | "origem">;

const SYSTEM = `Você faz a curadoria do acervo de uma marca: posts e notícias que a busca nas redes trouxe para ela.

A busca é por palavra-chave e é solta. Muito do que volta só tem uma palavra em comum com o termo buscado e não tem nada a ver com a marca. Sua tarefa é separar o que é DA MARCA do que é ruído.

Um item é RELEVANTE quando o assunto dele é:
- o negócio, a categoria ou os produtos da marca (ou de concorrentes);
- o território cultural que a marca declara (universos culturais, termos culturais);
- algo do dia a dia do público da marca que a marca teria legitimidade para comentar.

NÃO é relevante:
- viral, meme, fofoca, política, futebol, relacionamento, humor ou cripto genéricos, sem ligação com esse território;
- item que só compartilha uma palavra com os termos da marca, mas fala de outra coisa;
- texto vazio ou só hashtags genéricas (#fyp, #viral) sem nada que ligue à marca.

Julgue pelo conteúdo, não pela popularidade. Na dúvida, não marque como relevante.`;

const TOOL: Anthropic.Tool = {
  name: "classificar",
  description: "Devolve os números dos itens que são relevantes para a marca.",
  input_schema: {
    type: "object",
    properties: {
      relevantes: {
        type: "array",
        items: { type: "integer" },
        description: "Números (o [n] da lista) dos itens relevantes. Vazio se nenhum for.",
      },
    },
    required: ["relevantes"],
  },
};

function lista(v: unknown): string {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string").join(", ") : "";
}

function dnaDaMarca(nome: string, k: MarcaKnowledge | null | undefined): string {
  if (!k) return `MARCA: ${nome}`;
  return [
    `MARCA: ${k.marca || nome}`,
    k.produto && `PRODUTO: ${k.produto}`,
    k.perfil_comportamental && `PÚBLICO: ${k.perfil_comportamental}`,
    lista(k.universos_culturais) && `UNIVERSOS CULTURAIS: ${lista(k.universos_culturais)}`,
    lista(k.termos_busca) && `TERMOS DA MARCA: ${lista(k.termos_busca)}`,
    lista(k.termos_culturais) && `TERMOS CULTURAIS: ${lista(k.termos_culturais)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function linhaItem(i: ItemParaClassificar, n: number): string {
  const texto = (i.texto ?? "").replace(/\s+/g, " ").trim().slice(0, TEXTO_MAX) || "(sem texto)";
  return `[${n}] ${i.plataforma}${i.autor ? ` ${i.autor}` : ""}: ${texto}`;
}

async function classificarLote(
  dna: string,
  lote: ItemParaClassificar[],
  custos: CustoRelevancia[]
): Promise<boolean[] | null> {
  try {
    const response = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 600,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "classificar" },
      messages: [
        {
          role: "user",
          content: `${dna}\n\nITENS:\n${lote.map(linhaItem).join("\n")}`,
        },
      ],
    });

    const usd = custoAnthropic(MODELO, response.usage);
    if (usd !== null) {
      custos.push({
        provedor: "anthropic",
        detalhe: MODELO,
        ref: response.id,
        custoUsd: usd,
        tokensIn: response.usage?.input_tokens,
        tokensOut: response.usage?.output_tokens,
      });
    }

    const tool = response.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
    );
    const nums = (tool?.input as { relevantes?: unknown } | undefined)?.relevantes;
    if (!Array.isArray(nums)) return null;
    const sim = new Set(nums.filter((x): x is number => Number.isInteger(x)));
    return lote.map((_, n) => sim.has(n));
  } catch (e) {
    console.error(
      `[RELEVANCIA] lote de ${lote.length} item(ns) sem classificação: ` +
        (e instanceof Error ? e.message : String(e))
    );
    return null;
  }
}

/**
 * Classifica os itens contra o DNA da marca. Devolve um valor por item, na
 * mesma ordem: true/false, ou null quando o lote dele falhou (o item fica sem
 * classificação e continua aparecendo). Nunca lança.
 */
export async function classificarRelevancia(
  itens: ItemParaClassificar[],
  marca: { nome: string; knowledge?: MarcaKnowledge | null }
): Promise<{ resultado: (boolean | null)[]; custos: CustoRelevancia[] }> {
  const custos: CustoRelevancia[] = [];
  const resultado: (boolean | null)[] = itens.map(() => null);
  if (itens.length === 0) return { resultado, custos };

  const dna = dnaDaMarca(marca.nome, marca.knowledge);
  const inicios: number[] = [];
  for (let i = 0; i < itens.length; i += POR_LOTE) inicios.push(i);

  for (let j = 0; j < inicios.length; j += LOTES_SIMULTANEOS) {
    const rodada = inicios.slice(j, j + LOTES_SIMULTANEOS);
    const saidas = await Promise.all(
      rodada.map((ini) => classificarLote(dna, itens.slice(ini, ini + POR_LOTE), custos))
    );
    rodada.forEach((ini, k) => {
      saidas[k]?.forEach((v, n) => {
        resultado[ini + n] = v;
      });
    });
  }

  const sim = resultado.filter((v) => v === true).length;
  const nao = resultado.filter((v) => v === false).length;
  console.log(
    `[RELEVANCIA] ${marca.nome}: ${sim} relevante(s), ${nao} ruído, ` +
      `${itens.length - sim - nao} sem classificação`
  );
  return { resultado, custos };
}

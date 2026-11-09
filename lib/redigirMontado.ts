import type Anthropic from "@anthropic-ai/sdk";
import * as yaml from "js-yaml";
import {
  anthropic,
  extractJson,
  MODELO_REPORT,
  registrarLlm,
  validarEvidencias,
  type CustoColetado,
} from "./generateReport";
import { persistirImagensDoReport } from "./imagens";
import { MERCADO_PADRAO, mercadoDaMarca } from "./mercados";
import { CREATIVE_METHOD, SYSTEM_PROMPT, buildBrandBlock, systemPromptDynamic } from "./systemPrompt";
import type { BriefingMontado } from "./montarReport";
import type { ColetaItem, MarcaKnowledge, Meme, Tendencia, TrendReport } from "./types";

// Escreve o report montado: mesmo modelo, mesmo método e mesmo schema do report
// gerado (lib/generateReport.ts), mas a matéria-prima é o que a pessoa escolheu
// no acervo, não uma coleta nova. O resultado tem a cara de sempre (títulos de
// leitura, descrição que cruza os sinais, por que importa, hype, gatilho,
// insights, glossário), e imagem, link, autor e rede de cada card continuam
// vindo do item escolhido, nunca do modelo.

const REGRAS_MONTADO = `REPORT MONTADO (substitui o que for diferente nas regras acima):
Os dados desta vez NÃO são uma coleta bruta: uma pessoa da equipe escolheu, no acervo da marca, cada item que entra no report, e a ordem deles. Cada item tem um id (I1, I2...), na ordem escolhida.

- Todo item escolhido entra no report. Não descarte item por relevância: a pessoa já decidiu que ele entra. A única exceção continua sendo BRAND SAFETY.
- Quem decide a seção é você, como no report gerado: aplique o teste de meme da seção memes[] (unidade replicável: bordão, áudio, formato, imagem-modelo) a cada item. O que passa vai para memes[]; o resto (notícia, comportamento, assunto, discussão, lançamento) vai para tendencias[]. Leve em conta a rede e o teor do post.
- Agrupe quando fizer sentido. Itens que mostram o MESMO fenômeno podem virar um card só, com uma leitura que cruza os dois. Cada card leva o campo "itens": a lista de ids que ele usa, com o item principal (o que dá a imagem e o link do card) primeiro. Cada id aparece em exatamente um card, em tendencias[] ou em memes[].
- Dentro de cada seção, a ordem dos cards segue a ordem dos ids (a do primeiro id de cada card).
- Não preencha imagem_url, post_url, autor nem plataforma: deixe null. O sistema copia esses campos do item principal.
- citacao: trecho literal do texto de um dos itens do card. metrica: número do campo metricas de um dos itens do card.
- Os limites de quantidade de tendências não valem aqui: o número de cards é o que os itens pedirem. memes[] pode ficar vazio se nenhum item passar no teste.
- radar[]: use os próprios itens escolhidos, com a url de cada um.
- meta.edicao e meta.titulo_social: se o briefing trouxer, use exatamente o texto do briefing. Se não, escreva como manda a regra de campo.
- meta.produto: se o briefing trouxer, use; se não, tire da base de conhecimento da marca.
- O briefing pode ter uma orientacao: é direção de leitura, não fonte de fato.`;

type CardModelo = (Tendencia | Meme) & { itens?: unknown };

const fmt = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

// Métrica mais forte do item, como reserva quando a do modelo não confere com
// os dados (o arredondamento "1,4 mil" não passa na checagem de dígitos).
function metricaDoItem(item: ColetaItem): Tendencia["metrica"] {
  const m = item.metricas ?? {};
  const pares: [number | null | undefined, string][] = [
    [m.views, "views"],
    [m.curtidas, "curtidas"],
    [m.upvotes, "upvotes"],
  ];
  const [valor, rotulo] = pares.find(([v]) => typeof v === "number" && v > 0) ?? [];
  return typeof valor === "number" && rotulo ? { valor: fmt.format(valor), rotulo } : null;
}

function itemParaModelo(id: string, i: ColetaItem) {
  const metricas = Object.fromEntries(
    Object.entries(i.metricas ?? {}).filter(([, v]) => typeof v === "number" && v > 0)
  );
  return {
    id,
    plataforma: i.plataforma,
    autor: i.autor,
    data: (i.publicado_em ?? i.coletado_em).slice(0, 10),
    texto: i.texto,
    metricas,
    url: i.url,
  };
}

// Liga cada card do modelo aos itens escolhidos e copia deles imagem, link,
// autor e rede. Card que não aponta para nenhum item válido sai: sem item, não
// há evidência.
function ancorar<T extends Tendencia | Meme>(
  cards: CardModelo[] | undefined,
  porId: Map<string, ColetaItem>,
  usados: Set<string>
): T[] {
  const out: T[] = [];
  for (const card of cards ?? []) {
    const ids = (Array.isArray(card.itens) ? card.itens : [])
      .filter((x): x is string => typeof x === "string" && porId.has(x) && !usados.has(x));
    if (ids.length === 0) continue;
    ids.forEach((id) => usados.add(id));
    const principal = porId.get(ids[0])!;
    const { itens: _itens, ...resto } = card;
    void _itens;
    const card_ = resto as T;
    if ("gancho_produto" in card_ && !card_.metrica) {
      (card_ as Tendencia).metrica = metricaDoItem(principal);
    }
    out.push({
      ...card_,
      imagem_url: principal.imagem_url ?? undefined,
      post_url: principal.url,
      autor: principal.autor,
      plataforma: principal.plataforma,
      linguagem_explicita:
        ids.map((id) => porId.get(id)!.linguagem_explicita).find(Boolean) ?? null,
    });
  }
  return out;
}

export async function redigirReportMontado(input: {
  briefing: BriefingMontado;
  itens: ColetaItem[];
  marcaKnowledge?: MarcaKnowledge;
}): Promise<({ report: TrendReport } | { error: string }) & { custos: CustoColetado[] }> {
  const custos: CustoColetado[] = [];
  const mercado = mercadoDaMarca(input.marcaKnowledge);

  const porId = new Map<string, ColetaItem>();
  const dados = input.itens.map((item, n) => {
    porId.set(`I${n + 1}`, item);
    return itemParaModelo(`I${n + 1}`, item);
  });

  const b = input.briefing;
  const briefingYaml = yaml.dump({
    cliente: b.cliente,
    ...(b.produto ? { produto: b.produto } : {}),
    ...(b.edicao ? { edicao: b.edicao } : {}),
    ...(b.titulo_social ? { titulo_social: b.titulo_social } : {}),
    ...(b.orientacao ? { orientacao: b.orientacao } : {}),
  });

  const fechoIdioma =
    mercado.pais === MERCADO_PADRAO.pais
      ? ""
      : `\n\nIDIOMA DA RESPOSTA: escreva todo o texto do JSON em ${mercado.idiomaSaida}, mesmo que o briefing esteja em português.`;
  const userMessage = `BRIEFING (YAML):\n${briefingYaml}\nITENS ESCOLHIDOS PELA CURADORIA (JSON):\n${JSON.stringify(
    dados
  )}\n\nCANDIDATOS A TREND NO TIKTOK (JSON):\n[]${fechoIdioma}`;

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages
      .stream({
        model: MODELO_REPORT,
        max_tokens: 64000,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        system: [
          {
            type: "text",
            text: `${CREATIVE_METHOD}\n\n---\n\n${buildBrandBlock(input.marcaKnowledge)}\n\n---\n\n${SYSTEM_PROMPT}`,
            cache_control: { type: "ephemeral" },
          },
          { type: "text", text: `${systemPromptDynamic(mercado)}\n\n---\n\n${REGRAS_MONTADO}` },
        ],
        messages: [{ role: "user", content: userMessage }],
      })
      .finalMessage();
  } catch (err) {
    return { custos, error: `Falha ao chamar o modelo: ${err instanceof Error ? err.message : String(err)}` };
  }
  registrarLlm(custos, MODELO_REPORT, response);

  if (response.stop_reason === "refusal") {
    return { custos, error: "O modelo recusou escrever este relatório. Revise os itens escolhidos." };
  }
  if (response.stop_reason === "max_tokens") {
    return { custos, error: "O relatório ficou grande demais e foi cortado. Tente com menos itens." };
  }
  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") return { custos, error: "Resposta vazia do modelo." };

  let bruto: TrendReport & { tendencias: CardModelo[]; memes?: CardModelo[] };
  try {
    bruto = JSON.parse(extractJson(textBlock.text));
  } catch {
    console.error("[MONTADO] JSON invalido:", textBlock.text.slice(0, 800));
    return { custos, error: "Falha ao interpretar o JSON do modelo." };
  }

  // Citação e métrica conferidas contra os itens antes de ancorar: o que não
  // bate vira null (e a métrica cai pra do item principal).
  const descartadas = validarEvidencias(bruto, dados);
  if (descartadas) console.log(`[MONTADO] ${descartadas} citacao/metrica descartada(s): nao batem com os itens`);

  const usados = new Set<string>();
  const report: TrendReport = {
    ...bruto,
    meta: {
      ...bruto.meta,
      cliente: b.cliente,
      ...(b.edicao ? { edicao: b.edicao } : {}),
      ...(b.titulo_social ? { titulo_social: b.titulo_social } : {}),
      versao_formato: 2,
      origem: "montado",
    },
    tendencias: ancorar<Tendencia>(bruto.tendencias, porId, usados),
    memes: ancorar<Meme>(bruto.memes, porId, usados),
  };
  // Sem `fontes`: não houve varredura, e "N sinais lidos" na capa daria a
  // entender que houve.
  delete report.fontes;

  const fora = [...porId.keys()].filter((id) => !usados.has(id));
  if (fora.length) console.warn(`[MONTADO] itens que o modelo nao usou: ${fora.join(", ")}`);

  await persistirImagensDoReport(report);
  return { report, custos };
}

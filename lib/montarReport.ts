import type { ColetaItem, Meme, Tendencia, TrendReport } from "./types";

// REPORT MONTADO
//
// Monta um TrendReport a partir de itens escolhidos no acervo. É o mesmo
// formato e a mesma página do report gerado: cada card nasce de um post
// coletado, com imagem, link, autor, rede e trecho literal vindos do item.
// O que é leitura (descrição, "por que importa") fica vazio pra quem monta
// escrever no editor; o report sai em "ready", ou seja, em revisão.

const fmt = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function primeiraLinha(texto: string | null, max: number): string {
  const linha = (texto ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return linha.length > max ? `${linha.slice(0, max - 1).trimEnd()}…` : linha;
}

// Trecho literal do post, como a citação do report gerado (que só aceita texto
// que bate com a coleta). Aqui é o próprio texto do item, então sempre bate.
function trecho(texto: string | null): string | null {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > 220 ? `${t.slice(0, 219).trimEnd()}…` : t;
}

// Métrica real do post, a mais forte que ele tiver.
function metrica(item: ColetaItem): Tendencia["metrica"] {
  const m = item.metricas ?? {};
  const pares: [number | null | undefined, string][] = [
    [m.views, "views"],
    [m.curtidas, "curtidas"],
    [m.upvotes, "upvotes"],
  ];
  const [valor, rotulo] = pares.find(([v]) => typeof v === "number" && v > 0) ?? [];
  return typeof valor === "number" && rotulo ? { valor: fmt.format(valor), rotulo } : null;
}

function origemDoCard(item: ColetaItem) {
  return {
    imagem_url: item.imagem_url ?? undefined,
    post_url: item.url,
    autor: item.autor,
    plataforma: item.plataforma,
    linguagem_explicita: item.linguagem_explicita,
  };
}

export function tendenciaDoItem(item: ColetaItem): Tendencia {
  return {
    titulo: primeiraLinha(item.texto, 80),
    status: "em_alta",
    descricao: "",
    gancho_produto: "",
    citacao: trecho(item.texto),
    metrica: metrica(item),
    ...origemDoCard(item),
  };
}

export function memeDoItem(item: ColetaItem): Meme {
  return {
    titulo: primeiraLinha(item.texto, 80),
    status: "em_alta",
    descricao: "",
    linguagem: "",
    ...origemDoCard(item),
  };
}

export function montarReport(input: {
  cliente: string;
  produto: string;
  edicao: string;
  tituloSocial: string;
  tendencias: ColetaItem[];
  memes: ColetaItem[];
}): TrendReport {
  return {
    meta: {
      cliente: input.cliente,
      produto: input.produto,
      edicao: input.edicao,
      // Hype e gatilho são leituras do pipeline; no montado ficam vazios e o
      // editor deixa preencher. A página esconde o gatilho sem evento.
      indice_hype: 0,
      hype_motivo: "",
      proximo_gatilho: { evento: "", data: "", destaque: "" },
      titulo_social: input.tituloSocial || undefined,
      versao_formato: 2,
      origem: "montado",
    },
    tendencias: input.tendencias.map(tendenciaDoItem),
    memes: input.memes.map(memeDoItem),
    oportunidades: [],
    copy: [],
    radar: [],
    // Sem `fontes`: o report montado não fez varredura, e "N sinais lidos"
    // na capa daria a entender que fez.
  };
}

import { palavrao } from "./brandSafety";
import type { ColetaItem } from "./types";

// Peças comuns da leitura do acervo (coleta_item + radar_raw_data), usadas pela
// busca (/api/acervo) e pela criação do report montado (/api/reports/montar).

export const PLATAFORMAS = ["instagram", "tiktok", "twitter", "news", "reddit"] as const;
export type Plataforma = (typeof PLATAFORMAS)[number];

export const COLUNAS_COLETA =
  "id, plataforma, url, autor, texto, imagem_url, imagem_estavel, linguagem_explicita, metricas, engajamento, publicado_em, coletado_em";

export const COLUNAS_RADAR = "id, fonte, conteudo, url, metadata, created_at";

export type LinhaRadar = {
  id: string;
  fonte: string;
  conteudo: string;
  url: string | null;
  metadata: { upvotes?: number | null; comentarios?: number | null } | null;
  created_at: string;
};

export function linhaColetaParaItem(r: Omit<ColetaItem, "origem">): ColetaItem {
  return { ...r, origem: "report" };
}

// O radar guarda cada sinal como um texto só: `título\nsnippet` (ver signalText
// em lib/radar/memory.ts). O título é o começo do post cortado em 100
// caracteres; o snippet de X e TikTok é `autor: texto` e, no TikTok, ainda
// leva `(N views, N curtidas)` numa linha no fim. Ler isso cru era o que fazia
// o card repetir o texto duas vezes, com o autor no meio e sem autor no campo.

// Alguns textos chegaram ao banco com o emoji escapado (`\ud83d\ude31`).
function desescapar(t: string): string {
  return t.replace(/(?:\\u[0-9a-fA-F]{4})+/g, (seq) => {
    try {
      return JSON.parse(`"${seq}"`) as string;
    } catch {
      return seq;
    }
  });
}

type RadarLido = { autor: string | null; texto: string; views: number | null };

export function lerConteudoRadar(fonte: string, conteudo: string): RadarLido {
  const bruto = desescapar(conteudo ?? "");
  const quebra = bruto.indexOf("\n");
  const titulo = (quebra === -1 ? bruto : bruto.slice(0, quebra)).trim();
  let resto = quebra === -1 ? "" : bruto.slice(quebra + 1).trim();

  if (fonte === "news") {
    return { autor: null, texto: resto ? `${titulo}\n\n${resto}` : titulo, views: null };
  }
  if (fonte === "reddit") {
    // O snippet do Reddit é o corpo do post seguido dos comentários do topo.
    const corpo = resto.split(/\n\nComentários \(/)[0].trim();
    return { autor: null, texto: corpo ? `${titulo}\n\n${corpo}` : titulo, views: null };
  }

  let views: number | null = null;
  const rodape = resto.match(/\n?\((\d+) views, \d+ curtidas\)\s*$/);
  if (rodape) {
    views = Number(rodape[1]) || null;
    resto = resto.slice(0, rodape.index).trim();
  }
  if (!resto) return { autor: null, texto: titulo, views };

  // Sem autor, o snippet é o próprio texto e começa igual ao título.
  const inicio = titulo.slice(0, 30);
  if (inicio && resto.startsWith(inicio)) return { autor: null, texto: resto, views };

  const sep = resto.indexOf(": ");
  if (sep > 0 && sep <= 60) {
    return { autor: resto.slice(0, sep).trim(), texto: resto.slice(sep + 2).trim(), views };
  }
  return { autor: null, texto: resto, views };
}

/**
 * A memória do radar tem Reddit, notícias, X e TikTok, sem imagem. Linha sem
 * URL ou de fonte que o report não usa volta null: não serve de evidência.
 */
export function linhaRadarParaItem(r: LinhaRadar): ColetaItem | null {
  if (!r.url || !PLATAFORMAS.includes(r.fonte as Plataforma)) return null;
  const meta = r.metadata ?? {};
  const lido = lerConteudoRadar(r.fonte, r.conteudo);
  // No radar, `upvotes` guarda curtidas em X e TikTok; só no Reddit é upvote.
  const votos = meta.upvotes ?? null;
  const metricas: Record<string, number | null> =
    r.fonte === "reddit"
      ? { upvotes: votos, comentarios: meta.comentarios ?? null }
      : { curtidas: votos, comentarios: meta.comentarios ?? null, views: lido.views };
  return {
    id: r.id,
    origem: "radar",
    plataforma: r.fonte as Plataforma,
    url: r.url,
    autor: lido.autor,
    texto: lido.texto,
    imagem_url: null,
    imagem_estavel: true,
    linguagem_explicita: palavrao(lido.texto),
    metricas,
    engajamento: (votos ?? 0) + (meta.comentarios ?? 0),
    publicado_em: null,
    coletado_em: r.created_at,
  };
}

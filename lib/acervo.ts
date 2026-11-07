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

/**
 * A memória do radar só tem Reddit, notícias e X, sem imagem nem autor. Linha
 * sem URL ou de fonte desconhecida volta null: não serve de evidência num card.
 */
export function linhaRadarParaItem(r: LinhaRadar): ColetaItem | null {
  if (!r.url || !PLATAFORMAS.includes(r.fonte as Plataforma)) return null;
  const meta = r.metadata ?? {};
  return {
    id: r.id,
    origem: "radar",
    plataforma: r.fonte as Plataforma,
    url: r.url,
    autor: null,
    texto: r.conteudo,
    imagem_url: null,
    imagem_estavel: true,
    linguagem_explicita: palavrao(r.conteudo),
    metricas: { upvotes: meta.upvotes ?? null, comentarios: meta.comentarios ?? null },
    engajamento: (meta.upvotes ?? 0) + (meta.comentarios ?? 0),
    publicado_em: null,
    coletado_em: r.created_at,
  };
}

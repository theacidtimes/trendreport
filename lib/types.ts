export type TendenciaStatus =
  | "em_alta"
  | "subindo"
  | "estabilizando"
  | "esfriando";

export interface ProximoGatilho {
  evento: string;
  data: string;
  destaque: string;
}

export interface ReportMeta {
  cliente: string;
  produto: string;
  edicao: string;
  indice_hype: number;
  hype_motivo: string;
  proximo_gatilho: ProximoGatilho;
}

export interface Tendencia {
  titulo: string;
  status: TendenciaStatus;
  descricao: string;
  gancho_produto: string;
  imagem_url?: string;
  post_url?: string;
  plataforma?: "instagram" | "twitter" | "tiktok" | "news";
}

export interface Oportunidade {
  label: string;
  titulo: string;
  descricao: string;
}

export interface CopyItem {
  tipo: "feed" | "stories";
  texto: string;
  hashtags: string[];
}

export interface TrendReport {
  meta: ReportMeta;
  tendencias: Tendencia[];
  oportunidades: Oportunidade[];
  copy: CopyItem[];
}

export interface ReportRow {
  id: string;
  slug: string;
  user_id: string;
  cliente: string;
  briefing: Record<string, unknown> | null;
  report: TrendReport;
  created_at: string;
}

export interface InstagramItem {
  caption?: string;
  likesCount?: number;
  url?: string;
  displayUrl?: string;
  hashtags?: string[];
}

export interface TikTokItem {
  name?: string;
  videoCount?: number;
  viewCount?: number;
}

export interface TwitterItem {
  name?: string;
  tweetVolume?: number;
  category?: string;
}

export interface NewsItem {
  title?: string;
  link?: string;
  source?: string;
  snippet?: string;
  date?: string;
}

export interface RawData {
  instagram: InstagramItem[];
  tiktok: TikTokItem[];
  twitter: TwitterItem[];
  news: NewsItem[];
}

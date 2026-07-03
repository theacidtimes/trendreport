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
  cor_marca?: string;
  titulo_social?: string;
}

export interface Tendencia {
  titulo: string;
  status: TendenciaStatus;
  descricao: string;
  gancho_produto: string;
  imagem_url?: string;
  post_url?: string;
  autor?: string | null;
  plataforma?: "instagram" | "twitter" | "tiktok" | "news" | "reddit";
}

export interface RadarSinal {
  tema: string;
  url?: string | null;
  autor?: string | null;
}

export interface RadarItem {
  plataforma: "instagram" | "twitter" | "tiktok" | "reddit" | "news";
  sinais: RadarSinal[];
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

export interface FontesDados {
  instagram: number;
  twitter: number;
  tiktok: number;
  news: number;
  reddit: number;
}

export interface TrendReport {
  meta: ReportMeta;
  tendencias: Tendencia[];
  oportunidades: Oportunidade[];
  copy: CopyItem[];
  radar: RadarItem[];
  fontes?: FontesDados;
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
  ownerUsername?: string;
  type?: string;
}

export interface TikTokItem {
  text?: string;
  webVideoUrl?: string;
  coverUrl?: string;
  authorNickName?: string;
  diggCount?: number;
  playCount?: number;
  hashtags?: string[];
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

export interface RedditItem {
  title?: string;
  communityName?: string;
  url?: string;
  upVotes?: number;
  numberOfComments?: number;
}

export interface RawData {
  instagram: InstagramItem[];
  tiktok: TikTokItem[];
  twitter: TwitterItem[];
  news: NewsItem[];
  reddit: RedditItem[];
}

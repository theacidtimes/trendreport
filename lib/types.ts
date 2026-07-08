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

// ─── RADAR MODULE ──────────────────────────────────────────

export interface MarcaKnowledge {
  marca: string
  produto: string
  tom: string
  perfil_comportamental: string
  universos_culturais: string[]
  o_que_evitar: string[]
  ambicao_de_marca: string
  // Termos limpos que alimentam a busca nas fontes (Reddit/News). Separados do
  // DNA editorial porque este vai cru no search — precisa ser palavra-chave, não
  // descrição. Ex.: ["Vivo fibra", "Wi-Fi 7", "internet residencial"].
  termos_busca: string[]
}

export interface Marca {
  id: string
  nome: string
  yaml_conhecimento: MarcaKnowledge
  status_varredura: boolean
  intervalo_horas: number
  ultima_varredura: string | null
  created_at: string
}

export interface TrendDrop {
  id: string
  marca_id: string
  insight_titulo: string
  categoria_funil: 'growth' | 'base'
  status_hype: 'em_alta' | 'subindo' | 'estabilizando' | 'esfriando'
  indice_hype: number
  descricao_fato: string
  gancho_produto: string
  insight_criativo_cccaramelo: string
  links_fontes: string[]
  score_densidade: number
  score_transbordo: number
  score_velocidade: number
  created_at: string
  marca?: Marca
}

export interface RawDataPoint {
  fonte: 'reddit' | 'news' | 'twitter'
  titulo: string
  url: string
  snippet: string
  comentarios?: number
  upvotes?: number
  coletado_em: string
}

export interface HypeScore {
  total: number
  densidade: number
  transbordo: number
  velocidade: number
  status: TrendDrop['status_hype']
}

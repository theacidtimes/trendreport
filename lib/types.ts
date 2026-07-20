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

export interface InsightCriativo {
  titulo: string;
  texto: string;
}

export interface GlossarioTermo {
  termo: string;
  categoria: "sentimento" | "adjetivo" | "vocabulario" | "tema";
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
  insights?: InsightCriativo[];
  glossario?: GlossarioTermo[];
  fontes?: FontesDados;
}

export interface ReportRow {
  id: string;
  slug: string;
  user_id: string;
  cliente: string;
  marca_id: string | null;
  tenant_id: string | null;
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
  text?: string;
  url?: string;
  author?: string;
  likeCount?: number;
  replyCount?: number;
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
  // Lane CULTURAL (interesse/contexto), a via principal: termos comportamentais do
  // público que NÃO citam a marca. Captura o sinal onde a audiência já vive, estilo
  // interest targeting. Ex. p/ Vivo: ["jogar online", "maratonar série", "home office"].
  // Vazio = só roda a lane de marca (compat com registros antigos).
  termos_culturais?: string[]
  // Mesma lane cultural, mas em inglês: alimenta a varredura GLOBAL de early signals
  // (Wired, The Information, TrendWatching, Variety etc.). O sinal que ainda não chegou
  // ao BR aparece primeiro na imprensa global de tecnologia/cultura. Vazio = não roda.
  termos_culturais_en?: string[]
  // LinkedIn é a ÚNICA fonte ligável por marca (as outras são default). Liga só pra
  // cliente B2B/B2BC onde o discurso profissional é sinal. Ausente/false = não raspa.
  linkedin_ativo?: boolean
  // Termos DEDICADOS da lane LinkedIn. O LinkedIn é o canal do decisor B2B (travel
  // manager, controladoria, CFO), não do consumidor — os termos_culturais, pensados
  // pro coração TikTok/Reddit, puxam conversa pessoa física e afinam o ângulo pro
  // discurso profissional que é o valor do LinkedIn. Este campo deixa apontar a lane
  // pro léxico B2B certo (ex. VOLL: "gestão de viagens corporativas"). Vazio/ausente
  // = fallback pros termos_culturais (compat com marcas que já rodavam sem isto).
  termos_linkedin?: string[]
  // Idioma editorial da marca (ISO curto: 'pt', 'en', 'es'). Governa a peneira de
  // idioma da lane LinkedIn — o actor busca global e não filtra geo/idioma, então post
  // fora do idioma da marca é ruído (ex.: GRC global em inglês pra marca BR). Ausente =
  // 'pt' (todos os tenants atuais são BR). Só o LinkedIn usa isto hoje; as outras fontes
  // já vêm ancoradas em BR pelos parâmetros de busca.
  idioma?: string
}

export interface Marca {
  id: string
  nome: string
  yaml_conhecimento: MarcaKnowledge
  status_varredura: boolean
  intervalo_horas: number
  ultima_varredura: string | null
  tenant_id: string | null
  created_at: string
}

// ─── TENANCY (Acid Fabric) ─────────────────────────────────

// Marca white-label do tenant (subset tipado de tenants.branding jsonb).
// Editável pelo admin do tenant via RPC atualizar_branding (Fase 4D); aplicado
// ao chrome na Fase 4E. Todos os campos opcionais; ausência = fallback ACID.
export interface TenantBranding {
  display_name?: string
  logo_url?: string
  cor_primaria?: string
  cor_destaque?: string
}

export interface Tenant {
  id: string
  nome: string
  tipo: 'studio' | 'agency' | 'holding' | 'company'
  status: 'ativo' | 'suspenso' | 'cancelado'
  cnpj: string | null
  endereco: Record<string, unknown>
  cobranca: Record<string, unknown>
  branding: Record<string, unknown>
  // Camada 2 do prompt: a lente criativa do tenant (bounded, não sobrescreve o
  // motor ACID nem a trava anti-fabricação). Preenchida na Fase 4.
  perfil_criativo: Record<string, unknown>
  seats: number
  parent_tenant_id: string | null
  // Cache do saldo de créditos (fonte de verdade é o creditos_ledger; esta
  // coluna é o snapshot mantido atômico pela função credito_lancar). Fase 3A.
  saldo_creditos: number
  created_at: string
}

// Extrato de créditos (Fase 3A). Um lançamento por evento de custo:
// +recarga / -consumo (report, radar_run). saldo_after = snapshot do saldo
// do tenant logo depois deste lançamento.
export interface CreditoLedger {
  id: string
  tenant_id: string
  delta: number
  motivo: 'report' | 'radar_run' | 'recarga' | 'ajuste'
  ref_id: string | null
  saldo_after: number
  created_at: string
}

export interface TenantUser {
  tenant_id: string
  user_id: string
  role: 'admin' | 'editor' | 'viewer'
  created_at: string
}

// Módulos = os "apps" do Acid Fabric que o tenant assinou (analogia Adobe).
// Fase 4A. Enforcement (esconder feature não assinada) vem nas fatias de UI.
export type ModuloNome = 'radar' | 'reports' | 'dados_semanticos'

export interface TenantModulo {
  tenant_id: string
  modulo: ModuloNome
  ativo: boolean
  created_at: string
  updated_at: string
}

// Contrato vigente do tenant. data_fim é derivada do plano_tipo por trigger.
// Uma linha por ciclo (histórico de renovações). Fase 4A.
export interface Assinatura {
  id: string
  tenant_id: string
  plano_tipo: 'mensal' | 'trimestral' | 'semestral' | 'anual'
  data_inicio: string
  data_fim: string
  auto_renovacao: boolean
  status: 'ativa' | 'expirada' | 'cancelada'
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
  links_fontes: string[]
  score_densidade: number
  score_transbordo: number
  score_velocidade: number
  created_at: string
  marca?: Marca
}

export interface RawDataPoint {
  fonte: 'reddit' | 'news' | 'twitter' | 'tiktok' | 'linkedin'
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

import { RawDataPoint } from '../types'

const APIFY_TOKEN = process.env.APIFY_TOKEN!
const APIFY_BASE = 'https://api.apify.com/v2'

// Fonte de SCRAPE (o que dispara um run). Difere da fonte do RawDataPoint: 'news_global'
// raspa imprensa global EN mas os itens saem como fonte 'news' (mesma dimensão de score).
export type Fonte = 'reddit' | 'news' | 'news_global' | 'twitter' | 'tiktok' | 'linkedin'

// A REST da Apify exige o ID no formato username~actor (til), não username/actor.
// A barra quebra o path e a API responde 404 "no API endpoint at this URL".
function actorPath(actorId: string): string {
  return actorId.replace('/', '~')
}

// Recorte de imprensa pro News: catch amplo de BR (.com.br cobre folha, estadao, uol,
// infomoney, exame.com.br, fastcompany.com.br, meioemensagem etc.) + portais fortes que
// NÃO terminam em .com.br e precisam entrar na mão (globo, valor, exame.com). Editar aqui
// muda as duas lanes de news (cultural e marca) de uma vez.
const NEWS_SITES = [
  '.com.br',
  'g1.globo.com',
  'valor.globo.com',
  'exame.com',
  'fastcompany.com'
].map(s => `site:${s}`).join(' OR ')

// Lane GLOBAL de early signals (20% do composto): imprensa internacional que capta o
// sinal antes de ele chegar ao BR. Mix de tech (Wired, The Information, MIT), forecasting
// (TrendWatching, Springwise) e cultura/entretenimento (Variety, Billboard, Dazed).
// Alimentada por termos_culturais_en (a lane cultural traduzida). Editar aqui muda o
// recorte global de todas as marcas.
const NEWS_SITES_GLOBAL = [
  'wired.com',
  'theinformation.com',
  'technologyreview.com',
  'trendwatching.com',
  'springwise.com',
  'variety.com',
  'billboard.com',
  'dazeddigital.com'
].map(s => `site:${s}`).join(' OR ')

// Actor + input por fonte. A raspagem de comentários do Reddit e o max_pages do
// News fazem os runs passarem de 60s, então NÃO dá pra esperar inline — quem dispara
// (startScrape) não espera; o resultado é buscado num tick posterior via getRunStatus
// + fetchDataset. Ver runRadar.ts.
function scrapeSpec(fonte: Fonte, keywords: string[]): { actorId: string; input: object } {
  if (fonte === 'reddit') {
    const query = keywords.slice(0, 3).join(' OR ')
    // includeMediaLinks é o que traz upVotes/numberOfComments — sem ele os contadores
    // não vêm e a densidade fica sempre zero. sort=relevance + time=month evita o run
    // vazio que hot+day dava pra termos de nicho.
    return {
      actorId: 'trudax/reddit-scraper-lite',
      input: {
        searches: [query],
        maxItems: 25,
        maxPostCount: 12,
        skipComments: false,
        maxComments: 6,
        includeMediaLinks: true,
        sort: 'relevance',
        time: 'month'
      }
    }
  }
  if (fonte === 'news') {
    const query = keywords.slice(0, 3).join(' ')
    return {
      actorId: 'johnvc/GoogleNewsAPI',
      input: {
        q: `${query} ${NEWS_SITES}`,
        gl: 'br',
        hl: 'pt-br',
        max_pages: 2
      }
    }
  }
  if (fonte === 'news_global') {
    const query = keywords.slice(0, 3).join(' ')
    return {
      actorId: 'johnvc/GoogleNewsAPI',
      input: {
        q: `${query} ${NEWS_SITES_GLOBAL}`,
        gl: 'us',
        hl: 'en',
        max_pages: 2
      }
    }
  }
  if (fonte === 'tiktok') {
    // Uma query por termo (searchQueries é array), poucos vídeos por query pra segurar
    // o custo por evento. /video foca em conteúdo (não perfis). MOST_RELEVANT + PAST_MONTH
    // evita ruído viral velho e run vazio de nicho. proxyCountryCode BR é ESSENCIAL: sem
    // ele a busca devolve conteúdo global (EN/ES) e o filtro de idioma zera o resultado.
    return {
      actorId: 'clockworks/tiktok-scraper',
      input: {
        searchQueries: keywords.slice(0, 2),
        resultsPerPage: 10,
        searchSection: '/video',
        videoSearchSorting: 'MOST_RELEVANT',
        videoSearchDateFilter: 'PAST_MONTH',
        proxyCountryCode: 'BR'
      }
    }
  }
  if (fonte === 'linkedin') {
    // Busca por palavra-chave (searchQueries = query da barra de busca do LinkedIn), sem
    // cookies. Substitui supreme_coder/linkedin-post, que entrou em manutenção e devolvia
    // 0 itens. maxPosts é POR query, então 2 termos × 6 = 12 posts. relevance + month
    // segura volume em termo de nicho sem run vazio. Não raspamos comentários: no LinkedIn
    // o próprio post é o ensaio (o argumento está no corpo, não na thread) e evita custo
    // por evento de comentário.
    return {
      actorId: 'harvestapi/linkedin-post-search',
      input: {
        searchQueries: keywords.slice(0, 2),
        maxPosts: 6,
        postedLimit: 'month',
        sortBy: 'relevance',
        scrapeComments: false,
        scrapeReactions: false,
        profileScraperMode: 'short'
      }
    }
  }
  // twitter: busca real de tweets (apidojo). Substitui o trends actor, que só dava
  // label+volume sem conteúdo nem URL. Top + pt trazem a conversa que embasa o drop.
  const query = keywords.slice(0, 3).join(' OR ')
  return {
    actorId: 'apidojo/tweet-scraper',
    input: {
      searchTerms: [query],
      maxItems: 20,
      sort: 'Top',
      tweetLanguage: 'pt'
    }
  }
}

// Dispara o run e NÃO espera (waitForFinish=0). Devolve o id do run pra ser pollado
// depois. null = falhou ao disparar (sem token, HTTP erro, resposta sem id).
export async function startScrape(fonte: Fonte, keywords: string[]): Promise<string | null> {
  if (!APIFY_TOKEN) {
    console.error(`[APIFY] APIFY_TOKEN ausente — ${fonte} não dispara`)
    return null
  }
  const { actorId, input } = scrapeSpec(fonte, keywords)
  const res = await fetch(
    `${APIFY_BASE}/acts/${actorPath(actorId)}/runs?token=${APIFY_TOKEN}&waitForFinish=0`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }
  )
  if (!res.ok) {
    console.error(`[APIFY] ${actorId} falhou ao disparar: HTTP ${res.status} — ${await res.text()}`)
    return null
  }
  const run = await res.json()
  const id = run?.data?.id
  if (!id) {
    console.error(`[APIFY] ${actorId} sem run id na resposta`)
    return null
  }
  return id
}

// Estados terminais da Apify: SUCCEEDED (ok) e o resto (FAILED/ABORTED/TIMED-OUT).
// READY/RUNNING seguem pendentes.
export const TERMINAL_FAIL = new Set(['FAILED', 'ABORTED', 'TIMED-OUT', 'ABORTING', 'TIMING-OUT'])

export type RunStatus = { status: string; datasetId: string | null }

export async function getRunStatus(runId: string): Promise<RunStatus> {
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_TOKEN}`)
  if (!res.ok) return { status: 'FAILED', datasetId: null }
  const run = await res.json()
  return {
    status: run?.data?.status ?? 'FAILED',
    datasetId: run?.data?.defaultDatasetId ?? null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchDataset(datasetId: string): Promise<any[]> {
  const items = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=50`
  ).then(r => r.json())
  return Array.isArray(items) ? items : []
}

// Converte itens crus do dataset (por fonte) em RawDataPoint[]. Puro — roda no tick
// que finaliza o batch, sobre o raw guardado em radar_scrape_jobs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapItems(fonte: Fonte, items: any[]): RawDataPoint[] {
  if (fonte === 'reddit') return mapReddit(items)
  if (fonte === 'news' || fonte === 'news_global') return mapNews(items)
  if (fonte === 'tiktok') return mapTikTok(items)
  if (fonte === 'linkedin') return mapLinkedin(items)
  return mapTwitter(items)
}

// O actor IGNORA qualquer parâmetro de subreddit (não existe no schema dele), então a
// busca varre o Reddit inteiro. Filtrar por whitelist de subreddit era estreito demais:
// derrubava r/brasil, r/desabafos aleatórios e — pior — deixava passar r/Vivo, que é
// EM INGLÊS sobre o CELULAR Vivo (marca errada), não a Vivo telecom. A âncora certa é o
// IDIOMA: conteúdo em português é BR e é da conversa que interessa, venha do sub que vier.
// Isso também é marca-agnóstico (serve Conta Simples etc. sem manter lista por cliente).
const SUBREDDITS_BR = new Set(
  ['eu_nvr', 'conversas', 'internetbrasil', 'brasil', 'brazil', 'desabafos', 'brasilivre', 'brdev', 'investimentos'].map(s => s.toLowerCase())
)

// Marcadores de português: palavras-função frequentes + diacríticos. Some as ocorrências;
// 2+ já separa PT de EN/ES com folga em texto curto de Reddit. Barato e sem dependência.
const PT_MARKERS = /\b(que|n[ãa]o|com|para|uma?|isso|voc[êe]s?|est[áa]|s[ãa]o|mais|muito|por|ent[ãa]o|porque|tamb[ée]m|mas|meu|minha|pra|vc|fibra|plano|empresa|conta)\b/gi
const PT_DIACRITICS = /[ãõçáéíóúâêôà]/gi
function isPortuguese(text: string): boolean {
  const t = String(text || '')
  if (t.length < 8) return false
  const hits = (t.match(PT_MARKERS) || []).length + (t.match(PT_DIACRITICS) || []).length
  return hits >= 2
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isBRSub = (c: any) => SUBREDDITS_BR.has(String(c || '').replace(/^r\//i, '').toLowerCase())

// id do post na URL (compartilhado entre post e seus comentários):
// .../comments/{postId}/... e .../comments/{postId}/comment/{commentId}/
function postIdFromUrl(url: string): string | null {
  const m = url.match(/\/comments\/([a-z0-9]+)\//i)
  return m ? m[1] : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapReddit(items: any[]): RawDataPoint[] {
  // O actor devolve posts e comentários como itens SEPARADOS (dataType). Comentário
  // não tem título, então o filtro antigo (titulo && url) descartava todos — o agente
  // nunca lia a conversa. Aqui os comentários são agrupados no post pai e entram no
  // snippet, que é justamente onde está o sinal cultural (venda casada, ANATEL, etc.).
  // Um item entra se é de sub BR conhecido OU se o texto é português. A âncora de idioma
  // é o que faz o Reddit virar insumo principal sem manter whitelist por marca.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = items.filter((i: any) =>
    i.dataType === 'post' && (isBRSub(i.communityName) || isPortuguese(`${i.title || ''} ${i.body || ''}`)))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comments = items.filter((i: any) =>
    i.dataType === 'comment' && (isBRSub(i.communityName) || isPortuguese(i.body || '')))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commentsByPost = new Map<string, any[]>()
  for (const c of comments) {
    const pid = postIdFromUrl(c.url || '')
    if (!pid) continue
    const arr = commentsByPost.get(pid)
    if (arr) arr.push(c)
    else commentsByPost.set(pid, [c])
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return posts.map((p: any) => {
    const pid = postIdFromUrl(p.url || '')
    const thread = (pid && commentsByPost.get(pid)) || []
    const topComments = thread
      .sort((a, b) => (b.upVotes || 0) - (a.upVotes || 0))
      .slice(0, 5)
      .map(c => `- (${c.upVotes || 0}↑) ${String(c.body || '').replace(/\s+/g, ' ').trim().substring(0, 200)}`)
    const corpo = String(p.body || '').substring(0, 300)
    const snippet = topComments.length
      ? `${corpo}\n\nComentários (${p.numberOfComments || 0}):\n${topComments.join('\n')}`
      : corpo
    return {
      fonte: 'reddit' as const,
      titulo: p.title || '',
      url: p.url || '',
      snippet,
      comentarios: p.numberOfComments || 0,
      upvotes: p.upVotes || 0,
      coletado_em: new Date().toISOString()
    }
  }).filter(item => item.titulo && item.url)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNews(items: any[]): RawDataPoint[] {
  // Cada item do dataset é uma PÁGINA, não um artigo: os artigos vêm aninhados
  // em news_results[]. Ler item.title/link no topo devolve undefined e o filtro
  // descarta tudo (era por isso que News chegava zerado no cérebro).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const articles = items.flatMap((page: any) => page.news_results || [])
  return articles.map(item => ({
    fonte: 'news' as const,
    titulo: item.title || '',
    url: item.link || '',
    snippet: item.snippet || '',
    coletado_em: new Date().toISOString()
  })).filter(item => item.titulo && item.url)
}

// Tweets reais (apidojo). Agora TEM url e conteúdo, ao contrário do trends actor antigo —
// por isso o Twitter volta a ser fonte clicável (o filtro anti-alucinação em runRadar
// deixou de excluí-lo). Engajamento vira densidade/velocidade: likes→upvotes, replies→comentarios.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTwitter(items: any[]): RawDataPoint[] {
  return items.map(item => {
    const texto = String(item.text || item.fullText || '').replace(/\s+/g, ' ').trim()
    const autor = item.author?.userName ? `@${item.author.userName}` : ''
    return {
      fonte: 'twitter' as const,
      titulo: texto.substring(0, 100),
      url: item.url || item.twitterUrl || '',
      snippet: autor ? `${autor}: ${texto}` : texto,
      comentarios: item.replyCount || 0,
      upvotes: item.likeCount || 0,
      coletado_em: new Date().toISOString()
    }
  }).filter(item => item.titulo && item.url)
}

// Vídeos do TikTok por busca de termo. Sem título nativo: o caption (text) vira título e
// snippet. Filtra por idioma (textLanguage 'pt' ou heurística) pra manter a conversa BR.
// diggCount (curtidas)→upvotes, commentCount→comentarios alimentam densidade/velocidade.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTikTok(items: any[]): RawDataPoint[] {
  return items
    .filter((i) => {
      const t = String(i.text || '')
      return t && (i.textLanguage === 'pt' || isPortuguese(t))
    })
    .map((i) => {
      const texto = String(i.text || '').replace(/\s+/g, ' ').trim()
      const autor = i.authorMeta?.nickName || i.authorMeta?.name || ''
      return {
        fonte: 'tiktok' as const,
        titulo: texto.substring(0, 100),
        url: i.webVideoUrl || '',
        snippet: `${autor ? autor + ': ' : ''}${texto}\n(${i.playCount || 0} views, ${i.diggCount || 0} curtidas)`,
        comentarios: i.commentCount || 0,
        upvotes: i.diggCount || 0,
        coletado_em: new Date().toISOString()
      }
    })
    .filter(item => item.titulo && item.url)
}

// Posts do LinkedIn por busca de palavra-chave (harvestapi/linkedin-post-search). Discurso
// profissional/B2B: o corpo do post JÁ é o argumento (o valor está no texto, não em thread).
// content vira título+snippet; repost.content cobre o caso de compartilhamento. engagement.likes
// →upvotes, engagement.comments→comentarios alimentam densidade. LGPD: NÃO carregamos nome de
// autor pro sinal (o prompt cita a ideia, nunca quem falou); o snippet leva só o conteúdo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLinkedin(items: any[]): RawDataPoint[] {
  return items
    .map((i) => {
      const corpo = String(i.content || i.repost?.content || i.article?.title || '').replace(/\s+/g, ' ').trim()
      const titulo = corpo.substring(0, 100)
      return {
        fonte: 'linkedin' as const,
        titulo,
        url: i.linkedinUrl || i.shareLinkedinUrl || '',
        snippet: corpo.substring(0, 500),
        comentarios: i.engagement?.comments || 0,
        upvotes: i.engagement?.likes || 0,
        coletado_em: new Date().toISOString()
      }
    })
    .filter(item => item.titulo && item.url)
}

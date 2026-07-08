import { RawDataPoint } from '../types'

const APIFY_TOKEN = process.env.APIFY_TOKEN!
const APIFY_BASE = 'https://api.apify.com/v2'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runActor(actorId: string, input: object): Promise<any[]> {
  if (!APIFY_TOKEN) {
    console.error(`[APIFY] APIFY_TOKEN ausente no ambiente — ${actorId} não roda`)
    return []
  }

  // A REST da Apify exige o ID no formato username~actor (til), não username/actor.
  // A barra quebra o path e a API responde 404 "no API endpoint at this URL".
  const actorPath = actorId.replace('/', '~')

  const runRes = await fetch(
    `${APIFY_BASE}/acts/${actorPath}/runs?token=${APIFY_TOKEN}&waitForFinish=60`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }
  )
  if (!runRes.ok) {
    console.error(`[APIFY] ${actorId} falhou ao iniciar: HTTP ${runRes.status} — ${await runRes.text()}`)
    return []
  }

  const run = await runRes.json()
  if (!run?.data?.defaultDatasetId) {
    console.error(`[APIFY] ${actorId} sem dataset (status run: ${run?.data?.status ?? 'desconhecido'})`)
    return []
  }

  const items = await fetch(
    `${APIFY_BASE}/datasets/${run.data.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=30`
  ).then(r => r.json())

  const arr = Array.isArray(items) ? items : []
  console.log(`[APIFY] ${actorId}: ${arr.length} itens`)
  return arr
}

// Escopo BR curado. O actor IGNORA qualquer parâmetro de subreddit (não existe no
// schema dele), então a busca varre o Reddit inteiro — o recorte BR é aplicado
// aqui, filtrando pela comunidade. Sem isso entram r/Nicaragua, r/PuertoRico etc.
const SUBREDDITS_BR = new Set(
  ['eu_nvr', 'conversas', 'internetbrasil', 'brasil', 'desabafos'].map(s => s.toLowerCase())
)

// id do post na URL (compartilhado entre post e seus comentários):
// .../comments/{postId}/... e .../comments/{postId}/comment/{commentId}/
function postIdFromUrl(url: string): string | null {
  const m = url.match(/\/comments\/([a-z0-9]+)\//i)
  return m ? m[1] : null
}

export async function collectReddit(keywords: string[]): Promise<RawDataPoint[]> {
  const query = keywords.slice(0, 3).join(' OR ')
  // includeMediaLinks é o que traz upVotes/numberOfComments — sem ele os contadores
  // não vêm e a densidade fica sempre zero. sort=relevance + time=month evita o run
  // vazio que hot+day dava pra termos de nicho. Limites enxutos porque a raspagem de
  // comentários é lenta (proxy RESIDENTIAL, único disponível na conta) e o
  // waitForFinish=60 do runActor pega dataset parcial se o run passar disso.
  const items = await runActor('trudax/reddit-scraper-lite', {
    searches: [query],
    maxItems: 25,
    maxPostCount: 12,
    skipComments: false,
    maxComments: 6,
    includeMediaLinks: true,
    sort: 'relevance',
    time: 'month'
  })

  // O actor devolve posts e comentários como itens SEPARADOS (dataType). Comentário
  // não tem título, então o filtro antigo (titulo && url) descartava todos — o agente
  // nunca lia a conversa. Aqui os comentários são agrupados no post pai e entram no
  // snippet, que é justamente onde está o sinal cultural (venda casada, ANATEL, etc.).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isBR = (c: any) => SUBREDDITS_BR.has(String(c || '').replace(/^r\//i, '').toLowerCase())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts = items.filter((i: any) => i.dataType === 'post' && isBR(i.communityName))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comments = items.filter((i: any) => i.dataType === 'comment' && isBR(i.communityName))

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

export async function collectNews(keywords: string[]): Promise<RawDataPoint[]> {
  const query = keywords.slice(0, 3).join(' ')
  const items = await runActor('johnvc/GoogleNewsAPI', {
    q: `${query} site:.com.br OR site:.uol.com.br OR site:.g1.globo.com`,
    gl: 'br',
    hl: 'pt-br',
    max_pages: 2
  })
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

export async function collectTwitterTrends(): Promise<RawDataPoint[]> {
  const items = await runActor('data-slayer/twitter-trends-by-location', {
    country: 'Brazil'
  })
  return items.map(item => ({
    fonte: 'twitter' as const,
    titulo: item.name || item.trend || '',
    url: `https://x.com/search?q=${encodeURIComponent(item.name || '')}`,
    snippet: `Volume: ${item.tweetVolume || 'n/d'}`,
    coletado_em: new Date().toISOString()
  })).filter(item => item.titulo)
}

export async function collectAllData(keywords: string[]): Promise<RawDataPoint[]> {
  const [reddit, news, twitter] = await Promise.allSettled([
    collectReddit(keywords),
    collectNews(keywords),
    collectTwitterTrends()
  ])
  return [
    ...(reddit.status === 'fulfilled' ? reddit.value : []),
    ...(news.status === 'fulfilled' ? news.value : []),
    ...(twitter.status === 'fulfilled' ? twitter.value : [])
  ]
}

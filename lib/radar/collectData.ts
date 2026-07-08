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

export async function collectReddit(keywords: string[]): Promise<RawDataPoint[]> {
  const query = keywords.slice(0, 3).join(' OR ')
  const items = await runActor('trudax/reddit-scraper-lite', {
    searches: [query],
    subreddits: ['eu_nvr', 'conversas', 'InternetBrasil', 'brasil', 'desabafos'],
    maxItems: 30,
    skipComments: false,
    sort: 'hot',
    time: 'day'
  })
  return items.map(item => ({
    fonte: 'reddit' as const,
    titulo: item.title || '',
    url: item.url || '',
    snippet: item.selftext?.substring(0, 300) || item.body?.substring(0, 300) || '',
    comentarios: item.numComments || 0,
    upvotes: item.score || 0,
    coletado_em: new Date().toISOString()
  })).filter(item => item.titulo && item.url)
}

export async function collectNews(keywords: string[]): Promise<RawDataPoint[]> {
  const query = keywords.slice(0, 3).join(' ')
  const items = await runActor('johnvc/GoogleNewsAPI', {
    q: `${query} site:.com.br OR site:.uol.com.br OR site:.g1.globo.com`,
    gl: 'br',
    hl: 'pt-br',
    max_pages: 2
  })
  return items.map(item => ({
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

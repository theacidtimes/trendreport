import { RawDataPoint, HypeScore } from '../types'

export function scoreHype(data: RawDataPoint[]): HypeScore {
  const reddit  = data.filter(d => d.fonte === 'reddit')
  const news    = data.filter(d => d.fonte === 'news')
  const twitter = data.filter(d => d.fonte === 'twitter')

  // DIMENSÃO 1 — Densidade Conversacional (40%)
  const totalComentarios = reddit.reduce((acc, d) => acc + (d.comentarios || 0), 0)
  const totalUpvotes     = reddit.reduce((acc, d) => acc + (d.upvotes || 0), 0)
  const threadsQuentes   = reddit.filter(d => (d.comentarios || 0) > 50).length
  const densidade = Math.min(100, Math.round(
    Math.min(totalComentarios / 10, 40) +
    Math.min(totalUpvotes / 100, 30) +
    (threadsQuentes * 10)
  ))

  // DIMENSÃO 2 — Transbordo de Mídia (40%)
  const fontesUnicas = new Set(
    news.map(d => { try { return new URL(d.url).hostname } catch { return d.url } })
  ).size
  const transbordo = Math.min(100, Math.round(
    Math.min(fontesUnicas * 15, 60) +
    Math.min(news.length * 5, 40)
  ))

  // DIMENSÃO 3 — Velocidade e Shares (20%)
  const velocidade = Math.min(100, Math.round(Math.min(twitter.length * 20, 100)))

  const total = Math.round((densidade * 0.40) + (transbordo * 0.40) + (velocidade * 0.20))

  const status: HypeScore['status'] =
    total >= 75 ? 'em_alta'      :
    total >= 50 ? 'subindo'      :
    total >= 30 ? 'estabilizando':
    'esfriando'

  return { total, densidade, transbordo, velocidade, status }
}

// Intensidade específica de UM drop: pontua apenas os sinais que ele cita como
// fonte. Se o drop não mapear pra nenhum sinal coletado, usa o score do run.
export function scoreForDrop(
  data: RawDataPoint[],
  links: string[],
  fallback: HypeScore
): HypeScore {
  if (!links.length) return fallback
  const subset = data.filter(d => links.includes(d.url))
  if (subset.length === 0) return fallback
  return scoreHype(subset)
}

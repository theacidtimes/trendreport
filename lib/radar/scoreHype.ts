import { RawDataPoint, HypeScore } from '../types'

export function scoreHype(data: RawDataPoint[]): HypeScore {
  // Densidade = conversa com profundidade (Reddit + LinkedIn). Velocidade = social rápido
  // (X + TikTok). Transbordo = imprensa (News). O peso reflete a proposta: cultura/
  // comportamento manda (85% densidade+velocidade), fato é só âncora (15%).
  const densos  = data.filter(d => d.fonte === 'reddit' || d.fonte === 'linkedin')
  const news    = data.filter(d => d.fonte === 'news')
  const rapidos = data.filter(d => d.fonte === 'twitter' || d.fonte === 'tiktok')

  // DIMENSÃO 1 — Densidade Conversacional (65%)
  const totalComentarios = densos.reduce((acc, d) => acc + (d.comentarios || 0), 0)
  const totalUpvotes     = densos.reduce((acc, d) => acc + (d.upvotes || 0), 0)
  const threadsQuentes   = densos.filter(d => (d.comentarios || 0) > 50).length
  const densidade = Math.min(100, Math.round(
    Math.min(totalComentarios / 10, 40) +
    Math.min(totalUpvotes / 100, 30) +
    (threadsQuentes * 10)
  ))

  // DIMENSÃO 2 — Velocidade e viralização (20%): X + TikTok, sinal social rápido. Conta
  // volume de itens + engajamento somado (curtidas/comentários mapeados no collectData).
  const engajamentoRapido = rapidos.reduce((acc, d) => acc + (d.upvotes || 0) + (d.comentarios || 0), 0)
  const velocidade = Math.min(100, Math.round(
    Math.min(rapidos.length * 8, 60) +
    Math.min(engajamentoRapido / 500, 40)
  ))

  // DIMENSÃO 3 — Transbordo de Mídia (15%): peso MÍNIMO de propósito. É ancoragem factual
  // pra não alucinar sobre comentário/opinião de fórum, não pode dominar o drop.
  const fontesUnicas = new Set(
    news.map(d => { try { return new URL(d.url).hostname } catch { return d.url } })
  ).size
  const transbordo = Math.min(100, Math.round(
    Math.min(fontesUnicas * 15, 60) +
    Math.min(news.length * 5, 40)
  ))

  const total = Math.round((densidade * 0.65) + (velocidade * 0.20) + (transbordo * 0.15))

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

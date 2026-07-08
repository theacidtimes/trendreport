import { SupabaseClient } from '@supabase/supabase-js'
import { embedQuery } from './embeddings'
import { HypeScore } from '../types'

const WINDOW_MS = 3 * 24 * 60 * 60 * 1000   // janela "recente"
const MIN_SIMILARITY = 0.6
const MATCH_COUNT = 30

export type HypeStatus = HypeScore['status']

// Fallback estático (sem histórico): status derivado só da intensidade.
export function staticStatus(intensity: number): HypeStatus {
  return intensity >= 75 ? 'em_alta'
    : intensity >= 50 ? 'subindo'
    : intensity >= 30 ? 'estabilizando'
    : 'esfriando'
}

// Status temporal REAL: compara o tema do drop com o histórico da marca no
// cérebro para decidir se está subindo, estabilizando ou esfriando.
// runStart separa "runs anteriores" dos sinais inseridos neste run.
export async function computeStatus(
  supabase: SupabaseClient,
  marcaId: string,
  dropText: string,
  intensity: number,
  runStart: number
): Promise<HypeStatus> {
  let hist: { created_at: string }[]
  try {
    const query = await embedQuery(dropText)
    const { data } = await supabase.rpc('match_radar_signals', {
      p_marca_id: marcaId,
      p_query: query,
      p_match_count: MATCH_COUNT,
      p_min_similarity: MIN_SIMILARITY
    })
    hist = (data ?? []) as { created_at: string }[]
  } catch {
    return staticStatus(intensity)
  }

  const before = hist.filter(h => new Date(h.created_at).getTime() < runStart)
  if (before.length === 0) {
    // tema aparecendo agora, sem lastro histórico → emergente
    return intensity >= 60 ? 'em_alta' : 'subindo'
  }

  const cut = runStart - WINDOW_MS
  const recent = before.filter(h => new Date(h.created_at).getTime() >= cut).length
  const older = before.length - recent

  if (recent > older) return intensity >= 60 ? 'em_alta' : 'subindo'
  if (recent < older) return 'esfriando'
  return intensity >= 60 ? 'em_alta' : 'estabilizando'
}

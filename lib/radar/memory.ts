import { SupabaseClient } from '@supabase/supabase-js'
import { RawDataPoint } from '../types'
import { embedDocuments } from './embeddings'
import { forkSignalsToLake, fabricIngestEnabled, ForkItem } from '../fabric/fork'

const DEDUP_THRESHOLD = 0.92   // só corta sinais quase-idênticos
const RETRIEVE_COUNT = 8
const RETRIEVE_MIN_SIMILARITY = 0.5

// Tetos por chamada ao banco. O statement_timeout do PostgREST é 8s e tanto a
// busca quanto a gravação crescem com o lote: 230 queries de dedup numa marca
// pequena levaram 12s (o iterative scan do HNSW varre até achar vizinhos da
// marca) e ~230 inserts estouravam o tempo atualizando o índice — desde 16/09
// nenhum sinal entrava na memória. Lotes pequenos ficam na casa de 1-4s.
const DEDUP_CHUNK = 15
const INSERT_CHUNK = 25

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export interface RetrievedSignal {
  fonte: string
  conteudo: string
  url: string | null
  created_at: string
  similarity: number
}

export interface ProcessedMemory {
  freshData: RawDataPoint[]      // sinais novos deste run (dedup vs. histórico)
  retrieved: RetrievedSignal[]   // memória histórica relevante do cliente
}

function signalText(d: RawDataPoint): string {
  return d.snippet ? `${d.titulo}\n${d.snippet}` : d.titulo
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

function centroid(vectors: number[][]): number[] {
  const dim = vectors[0].length
  const out = new Array(dim).fill(0)
  for (const v of vectors) for (let i = 0; i < dim; i++) out[i] += v[i]
  return out.map(x => x / vectors.length)
}

// Embeda, deduplica (dentro do batch e vs. histórico), recupera memória
// relevante e persiste os sinais novos. Retorna sinais frescos + memória.
export async function processMemory(
  supabase: SupabaseClient,
  marcaId: string,
  data: RawDataPoint[]
): Promise<ProcessedMemory> {
  if (data.length === 0) return { freshData: [], retrieved: [] }

  const embeddings = await embedDocuments(data.map(signalText))

  // 1. dedup dentro do próprio batch (fontes diferentes, mesmo trend)
  const unique: { point: RawDataPoint; emb: number[] }[] = []
  for (let i = 0; i < data.length; i++) {
    const emb = embeddings[i]
    if (!unique.some(u => cosine(u.emb, emb) >= DEDUP_THRESHOLD)) {
      unique.push({ point: data[i], emb })
    }
  }

  // 2. dedup vs. histórico do cliente (não re-surfacear o mesmo trend)
  //
  // match_radar_signals_batch preserva o padrão ANN por query (LATERAL top-1),
  // em lotes de DEDUP_CHUNK pra caber no statement_timeout. Fail-open: lote que
  // falhar é tratado como novidade, mas agora com log — antes o erro sumia.
  const matched = new Set<number>()
  let offset = 0
  for (const lote of chunks(unique, DEDUP_CHUNK)) {
    const { data: batch, error } = await supabase.rpc('match_radar_signals_batch', {
      p_marca_id: marcaId,
      // vetor como texto "[...]": array de arrays numéricos vira literal 2D
      // ({{...}}) no PostgREST e o Postgres recusa como vector[] — o dedup
      // falhava em todo lote e tratava tudo como novidade.
      p_queries: lote.map(u => JSON.stringify(u.emb)),
      p_min_similarity: DEDUP_THRESHOLD
    })
    if (error) console.error('[MEMORY] Falha no dedup vs. histórico (lote tratado como novo):', error.message)
    for (const r of (batch ?? []) as { query_idx: number; has_match: boolean }[]) {
      // query_idx vem 1-based (WITH ORDINALITY) e relativo ao lote
      if (r.has_match) matched.add(offset + r.query_idx - 1)
    }
    offset += lote.length
  }
  const fresh = unique.filter((_, i) => !matched.has(i))

  // 3. recuperar memória histórica ANTES de persistir (evita auto-match)
  let retrieved: RetrievedSignal[] = []
  if (fresh.length > 0) {
    const { data: hist } = await supabase.rpc('match_radar_signals', {
      p_marca_id: marcaId,
      p_query: centroid(fresh.map(f => f.emb)),
      p_match_count: RETRIEVE_COUNT,
      p_min_similarity: RETRIEVE_MIN_SIMILARITY
    })
    retrieved = (hist ?? []) as RetrievedSignal[]
  }

  // 4. persistir sinais novos na memória do cliente
  if (fresh.length > 0) {
    const rows = fresh.map(({ point, emb }) => ({
      marca_id: marcaId,
      fonte: point.fonte,
      conteudo: signalText(point),
      url: point.url,
      metadata: {
        comentarios: point.comentarios ?? null,
        upvotes: point.upvotes ?? null,
        coletado_em: point.coletado_em
      },
      embedding: emb
    }))
    let gravados = 0
    for (const lote of chunks(rows, INSERT_CHUNK)) {
      const { error } = await supabase.from('radar_raw_data').insert(lote)
      if (error) console.error('[MEMORY] Erro ao persistir lote de sinais:', error.message)
      else gravados += lote.length
    }
    console.log(`[MEMORY] ${gravados}/${rows.length} sinais novos gravados na memória`)
  }

  // 5. FORK pra Fabric Lake (Fase 5): so roda com FABRIC_LAKE_INGEST ligada.
  // Reusa os embeddings JA computados aqui (nao paga vetor novo). Awaited (o run
  // e serverless: fire-and-forget perderia sinal ao retornar) mas PARALELIZADO em
  // lotes por dentro — latencia limitada a ceil(N/6) idas ao Haiku, nao N seriais.
  // Fail-safe: erro num sinal e engolido, nunca derruba o run. Off = no-op.
  if (fabricIngestEnabled() && fresh.length > 0) {
    const items: ForkItem[] = fresh.map(({ point, emb }) => ({
      input: {
        fonte: point.fonte,
        titulo: point.titulo,
        snippet: point.snippet,
        url: point.url,
        occurred_at: point.coletado_em,
        upvotes: point.upvotes ?? null,
        comentarios: point.comentarios ?? null
      },
      embedding: emb
    }))
    await forkSignalsToLake(supabase, items)
  }

  return { freshData: fresh.map(f => f.point), retrieved }
}

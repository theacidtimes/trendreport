import { SupabaseClient } from '@supabase/supabase-js'
import { RawDataPoint } from '../types'
import { embedDocuments } from './embeddings'
import { forkSignalsToLake, fabricIngestEnabled, ForkItem } from '../fabric/fork'

const DEDUP_THRESHOLD = 0.92   // só corta sinais quase-idênticos
const RETRIEVE_COUNT = 8
const RETRIEVE_MIN_SIMILARITY = 0.5

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
  const fresh: { point: RawDataPoint; emb: number[] }[] = []
  for (const u of unique) {
    const { data: dup } = await supabase.rpc('match_radar_signals', {
      p_marca_id: marcaId,
      p_query: u.emb,
      p_match_count: 1,
      p_min_similarity: DEDUP_THRESHOLD
    })
    if (!dup || dup.length === 0) fresh.push(u)
  }

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
    const { error } = await supabase.from('radar_raw_data').insert(rows)
    if (error) console.error('[MEMORY] Erro ao persistir sinais:', error)
  }

  // 5. FORK dormente pra Fabric Lake (Fase 5): so roda com FABRIC_LAKE_INGEST
  // ligada. Reusa os embeddings JA computados aqui (nao paga vetor novo) e e
  // fail-safe por dentro — nunca atrasa/derruba o run do cliente. Off = no-op.
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

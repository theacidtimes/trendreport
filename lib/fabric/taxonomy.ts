import { SupabaseClient } from '@supabase/supabase-js'

// Dimensoes do vocabulario controlado (a "lente" da ACID). Espelham as colunas
// de fabric_lake.signal. Estruturais = 1 valor; semanticas = multi-valor.
export type FabricDimension =
  | 'setor' | 'plataforma' | 'formato' | 'regiao' | 'idioma' | 'momento'
  | 'comportamento' | 'emocao' | 'inflexao' | 'lente_negocio'

export const STRUCTURAL_DIMS = [
  'setor', 'plataforma', 'formato', 'regiao', 'idioma', 'momento'
] as const
export const SEMANTIC_DIMS = [
  'comportamento', 'emocao', 'inflexao', 'lente_negocio'
] as const

export interface TaxonomyTerm {
  termo: string
  rotulo: string
  descricao: string | null
}

export interface Taxonomy {
  versao: number
  // por dimensao: os termos ATIVOS daquela versao
  dims: Record<FabricDimension, TaxonomyTerm[]>
  // set de termos validos por dimensao (pra validar a saida do LLM O(1))
  valid: Record<FabricDimension, Set<string>>
}

// Cache por versao: a taxonomia muda raramente (e sempre por nova versao), entao
// segurar em memoria evita um roundtrip por sinal. Chave = versao resolvida.
const cache = new Map<number, Taxonomy>()

const EMPTY_DIMS = (): Record<FabricDimension, TaxonomyTerm[]> => ({
  setor: [], plataforma: [], formato: [], regiao: [], idioma: [], momento: [],
  comportamento: [], emocao: [], inflexao: [], lente_negocio: []
})

// Carrega o vocabulario controlado do banco via a RPC `fabric_taxonomia`
// (fabric_lake nao e exposto no PostgREST, entao a UNICA porta e a funcao em
// public, gated a service_role/is_acid_admin). Sem versao, a RPC resolve a
// vigente (a maior); passamos p_versao pra travar numa versao especifica.
export async function loadTaxonomy(
  supabase: SupabaseClient,
  versao?: number
): Promise<Taxonomy> {
  const cacheKey = versao ?? -1  // -1 = "vigente" (resolvida pela RPC)
  const hit = cache.get(cacheKey)
  if (hit) return hit

  const { data, error } = await supabase.rpc('fabric_taxonomia', {
    p_versao: versao ?? null
  })
  if (error) throw new Error(`[FABRIC] taxonomia: ${error.message}`)

  const rows = (data ?? []) as {
    versao: number; dimensao: FabricDimension
    termo: string; rotulo: string; descricao: string | null
  }[]
  if (rows.length === 0) throw new Error('[FABRIC] taxonomia vazia')

  const ver = rows[0].versao
  const dims = EMPTY_DIMS()
  for (const row of rows) {
    if (dims[row.dimensao]) {
      dims[row.dimensao].push({
        termo: row.termo, rotulo: row.rotulo, descricao: row.descricao
      })
    }
  }

  const valid = {} as Record<FabricDimension, Set<string>>
  for (const d of Object.keys(dims) as FabricDimension[]) {
    valid[d] = new Set(dims[d].map(t => t.termo))
  }

  const tax: Taxonomy = { versao: ver, dims, valid }
  cache.set(cacheKey, tax)     // sob a chave pedida (vigente OU versao fixa)
  cache.set(ver, tax)          // e tambem sob a versao resolvida
  return tax
}

// Zera o cache (util em teste offline ao editar a taxonomia).
export function clearTaxonomyCache() {
  cache.clear()
}

// Mantem so os termos que EXISTEM na dimensao (descarta alucinacao do LLM).
export function keepValid(
  tax: Taxonomy, dim: FabricDimension, termos: string[]
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of termos) {
    if (tax.valid[dim].has(t) && !seen.has(t)) { seen.add(t); out.push(t) }
  }
  return out
}

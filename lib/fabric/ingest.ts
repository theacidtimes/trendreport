import { SupabaseClient } from '@supabase/supabase-js'
import { Interpretation } from './interpret'

// Persiste UMA leitura no substrato via a RPC gated `fabric_ingest_signal`
// (fabric_lake nao e alcancavel direto). O embedding e o VETOR JA PAGO no run
// do cliente (voyage-3, 1024-dim) — a lake nao paga embedding novo. Retorna o
// id do sinal ou null em erro (fail-safe: nunca derruba o run do cliente).
export async function ingestSignal(
  supabase: SupabaseClient,
  interp: Interpretation,
  embedding: number[]
): Promise<string | null> {
  // JSON.stringify de um array de floats ja e "[...]", o literal do pgvector.
  const embLiteral = embedding.length === 1024 ? JSON.stringify(embedding) : null

  const { data, error } = await supabase.rpc('fabric_ingest_signal', {
    p_row: {
      occurred_at: interp.occurred_at,
      setor: interp.setor,
      plataforma: interp.plataforma,
      formato: interp.formato,
      regiao: interp.regiao,
      idioma: interp.idioma,
      momento: interp.momento,
      comportamento: interp.comportamento,
      emocao: interp.emocao,
      inflexao: interp.inflexao,
      lente_negocio: interp.lente_negocio,
      tema_deid: interp.tema_deid,
      engajamento_faixa: interp.engajamento_faixa,
      taxonomia_versao: interp.taxonomia_versao,
      modelo_versao: interp.modelo_versao
    },
    p_embedding: embLiteral
  })

  if (error) {
    console.error('[FABRIC] ingestSignal falhou:', error.message)
    return null
  }
  return (data as string | null) ?? null
}

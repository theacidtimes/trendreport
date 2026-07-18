import { SupabaseClient } from '@supabase/supabase-js'
import { interpretSignal, isReadIngestWorthy, RawSignalInput } from './interpret'
import { ingestSignal } from './ingest'

// Item do fork: o sinal bruto + o embedding JA COMPUTADO no run do cliente
// (voyage-3, 1024-dim). A lake NAO paga embedding novo — reusa o que foi pago.
export interface ForkItem {
  input: RawSignalInput
  embedding: number[]
}

// Flag mestre: a lake so ingere quando FABRIC_LAKE_INGEST estiver ligada.
// Default DESLIGADA — o fork existe no codigo mas nao grava nada ate voce mandar.
export function fabricIngestEnabled(): boolean {
  const v = (process.env.FABRIC_LAKE_INGEST ?? '').toLowerCase()
  return v === '1' || v === 'true' || v === 'on'
}

// Tamanho do lote de interpretacao concorrente. O fork roda DENTRO do run pago
// (serverless cron, teto de 300s): NAO pode ser fire-and-forget (o runtime mata
// promise pendente ao retornar a resposta → perderia sinal), entao e awaited mas
// PARALELIZADO — o custo de tempo vira ceil(N/lote) idas ao Haiku, nao N seriais.
// 6 mantem o paralelismo sem estourar rate limit (mesmo lote do survey offline).
const LOTE_INTERPRET = 6

// Deriva a Fabric Lake a partir dos sinais frescos de um run. DORMENTE por
// padrao (flag off → no-op). Totalmente FAIL-SAFE: qualquer erro e engolido, a
// lake NUNCA pode atrasar nem derrubar o run do cliente (ela pega carona num
// run pago, nao e o produto do cliente). Best-effort, em lotes concorrentes.
export async function forkSignalsToLake(
  supabase: SupabaseClient,
  items: ForkItem[]
): Promise<{ ingeridos: number }> {
  if (!fabricIngestEnabled() || items.length === 0) return { ingeridos: 0 }

  let ingeridos = 0
  let descartados = 0   // leitura fina demais (setor nulo + rodas vazias) — vira ruido no trend_cell

  // Processa um sinal — fail-safe por dentro (erro engolido, nunca propaga: a
  // lake e carona, nao carga). Devolve o veredito pra agregar apos o lote.
  const processar = async (item: ForkItem): Promise<'ingerido' | 'descartado' | 'nulo'> => {
    try {
      const interp = await interpretSignal(supabase, item.input)
      if (!interp) return 'nulo'
      if (!isReadIngestWorthy(interp)) return 'descartado'
      const id = await ingestSignal(supabase, interp, item.embedding)
      return id ? 'ingerido' : 'nulo'
    } catch (e) {
      console.error('[FABRIC] fork falhou num sinal:', e)
      return 'nulo'
    }
  }

  // Lotes concorrentes: mantem o fork awaited (sem perder sinal no serverless)
  // mas paralelo (nao onera o teto de 300s do run pago sinal-a-sinal).
  for (let i = 0; i < items.length; i += LOTE_INTERPRET) {
    const veredictos = await Promise.all(items.slice(i, i + LOTE_INTERPRET).map(processar))
    for (const v of veredictos) {
      if (v === 'ingerido') ingeridos++
      else if (v === 'descartado') descartados++
    }
  }
  if (ingeridos > 0 || descartados > 0) {
    console.log(`[FABRIC] ${ingeridos}/${items.length} sinais na lake (${descartados} descartados por leitura fina)`)
  }
  return { ingeridos }
}

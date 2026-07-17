import { SupabaseClient } from '@supabase/supabase-js'
import { interpretSignal, RawSignalInput } from './interpret'
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

// Deriva a Fabric Lake a partir dos sinais frescos de um run. DORMENTE por
// padrao (flag off → no-op). Totalmente FAIL-SAFE: qualquer erro e engolido, a
// lake NUNCA pode atrasar nem derrubar o run do cliente (ela pega carona num
// run pago, nao e o produto do cliente). Best-effort, sinal a sinal.
export async function forkSignalsToLake(
  supabase: SupabaseClient,
  items: ForkItem[]
): Promise<{ ingeridos: number }> {
  if (!fabricIngestEnabled() || items.length === 0) return { ingeridos: 0 }

  let ingeridos = 0
  for (const item of items) {
    try {
      const interp = await interpretSignal(supabase, item.input)
      if (!interp) continue
      const id = await ingestSignal(supabase, interp, item.embedding)
      if (id) ingeridos++
    } catch (e) {
      // Nunca propaga: a lake e carona, nao carga.
      console.error('[FABRIC] fork falhou num sinal:', e)
    }
  }
  if (ingeridos > 0) console.log(`[FABRIC] ${ingeridos}/${items.length} sinais na lake`)
  return { ingeridos }
}

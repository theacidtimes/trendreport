import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════
// CRON de rebuild da Fabric Lake — reagrega signal → trend_cell (o agregado que
// a torneira /console/lake lê). Fecha o ciclo: ingest enche `signal` (fork no
// run pago), este endpoint constroi o `trend_cell` k-anonimizado, a tela mostra.
//
// Idempotente: cada chamada deleta+reinsere o range do bucket (a RPC cuida).
// Independente do FABRIC_LAKE_INGEST: se `signal` estiver vazio, retorna 0 (no-op
// barato). Gated pelo MESMO segredo do radar-cron (mesma fronteira de confiança,
// zero env nova). Usa service_role — a RPC exige service_role OU is_acid_admin, e
// o cron nao tem sessao de usuario.
// ═══════════════════════════════════════════════════════════════════════════

// Agregacao pura em Postgres (sem LLM/coleta); rapida, mas deixo folga.
export const maxDuration = 60

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.RADAR_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Reagrega os dois buckets (a tela hoje le 'semana'; 'mes' fica pronto pra
    // uso futuro e o custo e desprezivel). p_desde null = reconstroi todo o range.
    const out: Record<string, number> = {}
    for (const bucket of ['semana', 'mes'] as const) {
      const { data, error } = await supabase.rpc('fabric_rebuild_trend_cells', {
        p_bucket: bucket
      })
      if (error) throw new Error(`${bucket}: ${error.message}`)
      out[bucket] = (data as number) ?? 0
    }
    return NextResponse.json({ ok: true, cells: out, timestamp: new Date().toISOString() })
  } catch (e) {
    console.error('[FABRIC] rebuild falhou:', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

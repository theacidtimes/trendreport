import { SupabaseClient } from '@supabase/supabase-js'

export interface ClienteSummary {
  captados_total: number
  captados_30d: number
  captados_7d: number
  drops_total: number
  drops_30d: number
  drops_7d: number
  runs_total: number
  runs_30d: number
  runs_7d: number
  reports_total: number
  reports_30d: number
  reports_7d: number
  pico_captados: number
  ultima_run: string | null
  modelos: string[]
}

export interface DailyMetric {
  dia: string
  captados: number
  drops: number
  runs: number
}

const EMPTY: ClienteSummary = {
  captados_total: 0, captados_30d: 0, captados_7d: 0,
  drops_total: 0, drops_30d: 0, drops_7d: 0,
  runs_total: 0, runs_30d: 0, runs_7d: 0,
  reports_total: 0, reports_30d: 0, reports_7d: 0,
  pico_captados: 0, ultima_run: null, modelos: []
}

export async function getClienteSummary(
  supabase: SupabaseClient,
  marcaId: string,
  nome: string
): Promise<ClienteSummary> {
  const { data } = await supabase.rpc('radar_client_summary', {
    p_marca_id: marcaId,
    p_nome: nome
  })
  return (data as ClienteSummary) ?? EMPTY
}

export async function getDailyMetrics(
  supabase: SupabaseClient,
  marcaId: string,
  days = 30
): Promise<DailyMetric[]> {
  const { data } = await supabase.rpc('radar_daily_metrics', {
    p_marca_id: marcaId,
    p_days: days
  })
  return (data as DailyMetric[]) ?? []
}

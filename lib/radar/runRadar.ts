import { createClient } from '@supabase/supabase-js'
import { collectAllData } from './collectData'
import { scoreHype, scoreForDrop } from './scoreHype'
import { buildRadarPrompt } from './radarPrompt'
import { computeStatus } from './momentum'
import { processMemory, RetrievedSignal } from './memory'
import { Marca, RawDataPoint } from '../types'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

type SupabaseLike = ReturnType<typeof getSupabase>

// Fecha o run: registra volume/uso em radar_runs e marca a última varredura.
// Chamado em TODOS os caminhos de saída para o ledger de uso ficar completo.
async function closeRun(
  supabase: SupabaseLike,
  marcaId: string,
  log: {
    sinais_captados?: number
    sinais_novos?: number
    drops_gerados?: number
    modelo?: string | null
    status: string
  }
): Promise<void> {
  await supabase.from('radar_runs').insert({
    marca_id: marcaId,
    sinais_captados: log.sinais_captados ?? 0,
    sinais_novos: log.sinais_novos ?? 0,
    drops_gerados: log.drops_gerados ?? 0,
    modelo: log.modelo ?? null,
    status: log.status
  })
  await supabase.from('marcas')
    .update({ ultima_varredura: new Date().toISOString() })
    .eq('id', marcaId)
}

export async function runRadarForMarca(marca: Marca): Promise<void> {
  console.log(`[RADAR] Iniciando: ${marca.nome}`)
  const supabase = getSupabase()
  const anthropic = getAnthropic()
  const k = marca.yaml_conhecimento
  // termos_busca são as palavras-chave curadas pro search. Fallback pra marca+
  // produto só cobre registros antigos ainda sem termos — o DNA editorial
  // (universos_culturais) NÃO entra aqui: como query cru ele retorna zero.
  const keywords = k.termos_busca?.length
    ? k.termos_busca
    : [k.marca, k.produto].filter(Boolean)

  const rawData = await collectAllData(keywords)
  if (rawData.length < 3) {
    console.log(`[RADAR] Dados insuficientes para ${marca.nome}`)
    await closeRun(supabase, marca.id, { sinais_captados: rawData.length, status: 'sem_dados' })
    return
  }

  const hype = scoreHype(rawData)
  if (hype.total < 20) {
    console.log(`[RADAR] Score baixo (${hype.total}), pulando ${marca.nome}`)
    await closeRun(supabase, marca.id, { sinais_captados: rawData.length, status: 'score_baixo' })
    return
  }

  // Fronteira temporal: sinais deste run entram no cérebro depois daqui, então
  // runStart separa "runs anteriores" do agora ao calcular momentum.
  const runStart = Date.now()

  // Cérebro vetorial: dedup vs. histórico + memória relevante do cliente.
  // Falha no embedding não derruba o run — cai pro comportamento sem memória.
  let freshData: RawDataPoint[] = rawData
  let retrieved: RetrievedSignal[] = []
  try {
    const memory = await processMemory(supabase, marca.id, rawData)
    freshData = memory.freshData
    retrieved = memory.retrieved
  } catch (e) {
    console.error(`[RADAR] Cérebro indisponível para ${marca.nome}, seguindo sem memória:`, e)
  }

  if (freshData.length === 0) {
    console.log(`[RADAR] Nenhum sinal novo para ${marca.nome} (tudo já visto)`)
    await closeRun(supabase, marca.id, {
      sinais_captados: rawData.length, sinais_novos: 0, status: 'sem_novidade'
    })
    return
  }

  const { system, user } = buildRadarPrompt(k, freshData, retrieved)
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system,
    messages: [{ role: 'user', content: user }]
  })

  const raw = response.content.map(b => b.type === 'text' ? b.text : '').join('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let drops: any[]
  try {
    drops = JSON.parse(raw.replace(/```json|```/g, '').trim())
    if (!Array.isArray(drops)) drops = [drops]
  } catch (e) {
    console.error(`[RADAR] Erro ao parsear drops:`, e)
    await closeRun(supabase, marca.id, {
      sinais_captados: rawData.length, sinais_novos: freshData.length, modelo: MODEL, status: 'erro'
    })
    return
  }

  // Score e status POR DROP: intensidade a partir das fontes que o drop cita,
  // status a partir do momentum real vs. histórico da marca no cérebro.
  const rows = await Promise.all(drops.map(async drop => {
    const links = drop.links_fontes || []
    const dropScore = scoreForDrop(rawData, links, hype)
    const status = await computeStatus(
      supabase,
      marca.id,
      `${drop.insight_titulo}. ${drop.descricao_fato}`,
      dropScore.total,
      runStart
    )
    return {
      marca_id:                    marca.id,
      insight_titulo:              drop.insight_titulo,
      categoria_funil:             drop.categoria_funil,
      status_hype:                 status,
      indice_hype:                 dropScore.total,
      descricao_fato:              drop.descricao_fato,
      gancho_produto:              drop.gancho_produto,
      insight_criativo_cccaramelo: drop.insight_criativo_cccaramelo,
      links_fontes:                links,
      score_densidade:             dropScore.densidade,
      score_transbordo:            dropScore.transbordo,
      score_velocidade:            dropScore.velocidade
    }
  }))

  const { error } = await supabase.from('trends_radar').insert(rows)
  if (error) console.error(`[RADAR] Erro ao salvar:`, error)
  else console.log(`[RADAR] ${rows.length} drops salvos para ${marca.nome}`)

  await closeRun(supabase, marca.id, {
    sinais_captados: rawData.length,
    sinais_novos: freshData.length,
    drops_gerados: rows.length,
    modelo: MODEL,
    status: error ? 'erro' : 'ok'
  })
}

// A marca está "vencida" quando já passou o intervalo_horas dela desde a última
// varredura. Marca nunca varrida entra na hora. É isso que faz cada cliente ter
// a própria cadência: o cron bate de hora em hora, mas só roda quem venceu.
function isDue(marca: Marca, now: number): boolean {
  if (!marca.ultima_varredura) return true
  const intervaloMs = (marca.intervalo_horas || 6) * 3_600_000
  return now - new Date(marca.ultima_varredura).getTime() >= intervaloMs
}

export async function runAllActiveRadars(): Promise<void> {
  const supabase = getSupabase()
  const { data: marcas, error } = await supabase
    .from('marcas').select('*').eq('status_varredura', true)

  if (error || !marcas?.length) {
    console.log('[RADAR] Nenhuma marca ativa')
    return
  }

  const now = Date.now()
  const due = (marcas as Marca[]).filter(m => isDue(m, now))
  if (!due.length) {
    console.log(`[RADAR] ${marcas.length} ativa(s), nenhuma vencida ainda`)
    return
  }

  for (const marca of due) {
    try {
      await runRadarForMarca(marca)
      await new Promise(r => setTimeout(r, 5000))
    } catch (e) {
      console.error(`[RADAR] Erro em ${marca.nome}:`, e)
    }
  }
  console.log(`[RADAR] Varredura completa (${due.length}/${marcas.length})`)
}

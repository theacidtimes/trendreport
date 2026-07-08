import { randomUUID } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import {
  Fonte,
  startScrape,
  getRunStatus,
  fetchDataset,
  mapItems,
  TERMINAL_FAIL
} from './collectData'
import { scoreHype, scoreForDrop } from './scoreHype'
import { buildRadarPrompt } from './radarPrompt'
import { computeStatus } from './momentum'
import { processMemory, RetrievedSignal } from './memory'
import { Marca, RawDataPoint } from '../types'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'
const FONTES: Fonte[] = ['reddit', 'news', 'twitter']
// Run pendura preso derruba o batch inteiro (nunca fica só-terminal). A Apify já
// impõe timeout próprio, mas um blip na consulta de status pode deixar a linha em
// 'running' — passado esse teto, tratamos como falha pra não travar a fila.
const JOB_STALE_MS = 30 * 60 * 1000

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
type AnthropicLike = ReturnType<typeof getAnthropic>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ScrapeJob = any

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

function keywordsFor(marca: Marca): string[] {
  const k = marca.yaml_conhecimento
  // termos_busca são as palavras-chave curadas pro search. Fallback pra marca+
  // produto só cobre registros antigos ainda sem termos — o DNA editorial
  // (universos_culturais) NÃO entra aqui: como query cru ele retorna zero.
  return k.termos_busca?.length
    ? k.termos_busca
    : [k.marca, k.produto].filter(Boolean)
}

// DISPARO: começa os 3 scrapes da marca (sem esperar), grava uma linha de job por
// fonte e marca a varredura como feita. O ultima_varredura sai daqui pra o isDue não
// re-disparar a mesma marca antes do resultado voltar num tick seguinte.
async function kickoffMarca(supabase: SupabaseLike, marca: Marca, batchId: string): Promise<void> {
  const keywords = keywordsFor(marca)
  const runIds = await Promise.all(FONTES.map(f => startScrape(f, keywords)))
  const rows = FONTES.map((fonte, i) => ({
    batch_id: batchId,
    marca_id: marca.id,
    fonte,
    apify_run_id: runIds[i],
    status: runIds[i] ? 'running' : 'failed'
  }))
  await supabase.from('radar_scrape_jobs').insert(rows)
  await supabase.from('marcas')
    .update({ ultima_varredura: new Date().toISOString() })
    .eq('id', marca.id)
  console.log(`[RADAR] Disparado: ${marca.nome} (${rows.filter(r => r.status === 'running').length}/3 fontes)`)
}

// Poll dos jobs 'running': SUCCEEDED vira 'done' com o dataset guardado; terminal de
// falha (ou run velho demais) vira 'failed'. Muta os jobs em memória pra o
// agrupamento seguinte enxergar o estado atualizado sem re-consultar.
async function pollRunningJobs(supabase: SupabaseLike, jobs: ScrapeJob[]): Promise<void> {
  const now = Date.now()
  for (const job of jobs) {
    if (job.status !== 'running') continue
    if (!job.apify_run_id) {
      await markJob(supabase, job, 'failed')
      continue
    }
    const { status, datasetId } = await getRunStatus(job.apify_run_id)
    if (status === 'SUCCEEDED' && datasetId) {
      const raw = await fetchDataset(datasetId)
      job.raw = raw
      await supabase.from('radar_scrape_jobs')
        .update({ status: 'done', dataset_id: datasetId, raw, updated_at: new Date().toISOString() })
        .eq('id', job.id)
      job.status = 'done'
    } else if (TERMINAL_FAIL.has(status)) {
      await markJob(supabase, job, 'failed')
    } else if (now - new Date(job.created_at).getTime() > JOB_STALE_MS) {
      console.error(`[RADAR] Job ${job.id} (${job.fonte}) travado em ${status}, marcando failed`)
      await markJob(supabase, job, 'failed')
    }
  }
}

async function markJob(supabase: SupabaseLike, job: ScrapeJob, status: string): Promise<void> {
  job.status = status
  await supabase.from('radar_scrape_jobs')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', job.id)
}

// FINALIZAÇÃO: pega todo job ainda não processado, atualiza os 'running', e roda a
// pipeline por marca assim que TODOS os jobs do batch dela ficam terminais. Batches
// com alguma fonte ainda 'running' esperam o próximo tick.
async function finalize(supabase: SupabaseLike, anthropic: AnthropicLike): Promise<void> {
  const { data: jobs } = await supabase
    .from('radar_scrape_jobs')
    .select('*')
    .neq('status', 'processed')

  if (!jobs?.length) return

  await pollRunningJobs(supabase, jobs as ScrapeJob[])

  // Agrupa por batch+marca: cada marca aparece uma vez por batch, com 3 jobs.
  const groups = new Map<string, ScrapeJob[]>()
  for (const job of jobs as ScrapeJob[]) {
    const key = `${job.batch_id}|${job.marca_id}`
    const arr = groups.get(key)
    if (arr) arr.push(job)
    else groups.set(key, [job])
  }

  for (const group of Array.from(groups.values())) {
    if (group.some((j: ScrapeJob) => j.status === 'running')) continue // batch ainda coletando

    const marcaId = group[0].marca_id
    const { data: marca } = await supabase.from('marcas').select('*').eq('id', marcaId).single()
    if (marca) {
      try {
        await processMarcaBatch(supabase, anthropic, marca as Marca, group)
      } catch (e) {
        console.error(`[RADAR] Erro ao processar batch de ${(marca as Marca).nome}:`, e)
        await closeRun(supabase, marcaId, { status: 'erro' })
      }
    }
    // Processado (ou marca sumiu): tira os jobs da fila.
    await supabase.from('radar_scrape_jobs')
      .update({ status: 'processed', updated_at: new Date().toISOString() })
      .in('id', group.map((j: ScrapeJob) => j.id))
  }
}

// PIPELINE: reconstrói rawData a partir dos datasets guardados e roda score →
// memória → LLM → drops, igual ao fluxo inline antigo, só que sobre dados já
// coletados de forma assíncrona.
async function processMarcaBatch(
  supabase: SupabaseLike,
  anthropic: AnthropicLike,
  marca: Marca,
  jobs: ScrapeJob[]
): Promise<void> {
  console.log(`[RADAR] Finalizando: ${marca.nome}`)
  const rawData: RawDataPoint[] = jobs
    .filter(j => j.status === 'done')
    .flatMap(j => mapItems(j.fonte as Fonte, j.raw || []))

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

  const k = marca.yaml_conhecimento
  const { system, user } = buildRadarPrompt(k, freshData, retrieved)
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
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
  // Anti-alucinação: só sobrevive link que existe de fato nos dados coletados E
  // que seja fonte real navegável. Twitter Trends não tem post — só página de
  // busca (x.com/search) — então fica de fora das fontes clicáveis (vira fake).
  const urlsReais = new Set(
    rawData.filter(d => d.fonte !== 'twitter').map(d => d.url)
  )
  const rows = await Promise.all(drops.map(async drop => {
    const links = (drop.links_fontes || []).filter((u: string) => urlsReais.has(u))
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
// a própria cadência: o cron bate de tempos em tempos, mas só dispara quem venceu.
function isDue(marca: Marca, now: number): boolean {
  if (!marca.ultima_varredura) return true
  const intervaloMs = (marca.intervalo_horas || 6) * 3_600_000
  return now - new Date(marca.ultima_varredura).getTime() >= intervaloMs
}

// Cada tick faz duas coisas: FINALIZA batches pendentes de ticks anteriores (o
// resultado da Apify que já ficou pronto) e DISPARA novos scrapes pras marcas
// vencidas. Assim nenhum passo espera run lento inline — o cron cobre a latência.
export async function runAllActiveRadars(): Promise<void> {
  const supabase = getSupabase()
  const anthropic = getAnthropic()

  // 1. Finaliza o que já voltou.
  await finalize(supabase, anthropic)

  // 2. Dispara as vencidas.
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

  const batchId = randomUUID()
  for (const marca of due) {
    try {
      await kickoffMarca(supabase, marca, batchId)
    } catch (e) {
      console.error(`[RADAR] Erro ao disparar ${marca.nome}:`, e)
    }
  }
  console.log(`[RADAR] Disparo completo (${due.length}/${marcas.length})`)
}

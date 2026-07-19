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
// Run pendura preso derruba o batch inteiro (nunca fica só-terminal). A Apify já
// impõe timeout próprio, mas um blip na consulta de status pode deixar a linha em
// 'running' — passado esse teto, tratamos como falha pra não travar a fila.
const JOB_STALE_MS = 30 * 60 * 1000

// Orçamento de tempo do finalize: antes de começar CADA marca, se já passou deste
// teto a gente para e deixa o resto dos batches como não-processados — o próximo
// tick os pega (mesmo comportamento de um batch ainda coletando). Isso garante
// que a gente sempre cede o controle de forma limpa antes do host matar o processo
// no meio de uma marca (foi assim que a VOLL ficou com memória órfã e sem drops).
// Folga confortável abaixo do timeout-minutes do workflow (30min).
const FINALIZE_BUDGET_MS = 25 * 60 * 1000

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
  const { data: run } = await supabase.from('radar_runs').insert({
    marca_id: marcaId,
    sinais_captados: log.sinais_captados ?? 0,
    sinais_novos: log.sinais_novos ?? 0,
    drops_gerados: log.drops_gerados ?? 0,
    modelo: log.modelo ?? null,
    status: log.status
  }).select('id').single()
  await supabase.from('marcas')
    .update({ ultima_varredura: new Date().toISOString() })
    .eq('id', marcaId)

  // Metering (Fase 3A): 1 varredura = 1 crédito, resolvido pelo tenant da marca.
  // Idempotente por run e NÃO bloqueia — se o débito falhar, o ledger fica
  // incompleto mas a coleta/geração segue normal. Débito só se o run foi gravado.
  if (run?.id) {
    try {
      await supabase.rpc('cobrar_radar_run', { p_marca: marcaId, p_ref: run.id })
    } catch (e) {
      console.error('[RADAR] Falha ao debitar credito (nao bloqueia):', e)
    }
  }
}

// Uma lane é um scrape (fonte + query). O composto nasce daqui: várias lanes por
// marca, cada uma com seu recorte. O grupo em finalize é count-agnóstico, então N
// lanes de reddit convivem sem migração — só somam sinais no mesmo batch.
type ScrapeLane = { fonte: Fonte; keywords: string[] }

function brandKeywords(marca: Marca): string[] {
  const k = marca.yaml_conhecimento
  // termos_busca são as palavras-chave curadas pro search. Fallback pra marca+
  // produto só cobre registros antigos ainda sem termos — o DNA editorial
  // (universos_culturais) NÃO entra aqui: como query cru ele retorna zero.
  return k.termos_busca?.length
    ? k.termos_busca
    : [k.marca, k.produto].filter(Boolean)
}

// COMPOSTO PROPORCIONAL (Brasil 65% / global 20% / setor 15%). A lane CULTURAL
// (interesse/contexto, sem citar a marca) é o coração dominante: Reddit + TikTok + X,
// onde a audiência já vive, estilo interest targeting do Meta. News é âncora de MARCA e
// tem peso mínimo (anti-alucinação, não domina drop). news_global pega early signals antes
// de chegarem ao BR. LinkedIn é a ÚNICA fonte ligável (B2B/B2BC). Guardas por termo garantem
// compat: sem termos_culturais roda só marca; sem termos_culturais_en pula o global.
function lanesFor(marca: Marca): ScrapeLane[] {
  const k = marca.yaml_conhecimento
  const brand = brandKeywords(marca)
  const cultural = k.termos_culturais ?? []
  const culturalEn = k.termos_culturais_en ?? []
  const lanes: ScrapeLane[] = []

  // Coração cultural (dominante): a conversa real onde a audiência vive.
  if (cultural.length) {
    lanes.push({ fonte: 'reddit', keywords: cultural })
    lanes.push({ fonte: 'tiktok', keywords: cultural })
    lanes.push({ fonte: 'twitter', keywords: cultural })
  }
  // Early signals global (20%): o sinal antes de virar mainstream no BR.
  if (culturalEn.length) {
    lanes.push({ fonte: 'news_global', keywords: culturalEn })
  }
  // Âncora de marca: Reddit direto na marca + News pt-br (peso mínimo, só ancoragem factual).
  lanes.push({ fonte: 'reddit', keywords: brand })
  lanes.push({ fonte: 'news', keywords: brand })
  // Única fonte ligável: LinkedIn, discurso profissional. Só liga se há termo cultural.
  if (k.linkedin_ativo && cultural.length) {
    lanes.push({ fonte: 'linkedin', keywords: cultural })
  }
  return lanes
}

// DISPARO: começa os scrapes das lanes da marca (sem esperar), grava uma linha de
// job por lane e marca a varredura como feita. O ultima_varredura sai daqui pra o
// isDue não re-disparar a mesma marca antes do resultado voltar num tick seguinte.
async function kickoffMarca(supabase: SupabaseLike, marca: Marca, batchId: string): Promise<void> {
  const lanes = lanesFor(marca)
  const runIds = await Promise.all(lanes.map(l => startScrape(l.fonte, l.keywords)))
  const rows = lanes.map((lane, i) => ({
    batch_id: batchId,
    marca_id: marca.id,
    fonte: lane.fonte,
    apify_run_id: runIds[i],
    status: runIds[i] ? 'running' : 'failed'
  }))
  await supabase.from('radar_scrape_jobs').insert(rows)
  await supabase.from('marcas')
    .update({ ultima_varredura: new Date().toISOString() })
    .eq('id', marca.id)
  console.log(`[RADAR] Disparado: ${marca.nome} (${rows.filter(r => r.status === 'running').length}/${rows.length} lanes)`)
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
async function finalize(supabase: SupabaseLike, anthropic: AnthropicLike, deadline: number): Promise<void> {
  const { data: jobs } = await supabase
    .from('radar_scrape_jobs')
    .select('*')
    .neq('status', 'processed')

  if (!jobs?.length) return

  await pollRunningJobs(supabase, jobs as ScrapeJob[])

  // Agrupa por batch+marca: cada marca aparece uma vez por batch, com N jobs (lanes).
  const groups = new Map<string, ScrapeJob[]>()
  for (const job of jobs as ScrapeJob[]) {
    const key = `${job.batch_id}|${job.marca_id}`
    const arr = groups.get(key)
    if (arr) arr.push(job)
    else groups.set(key, [job])
  }

  for (const group of Array.from(groups.values())) {
    // Cede o controle antes de o host matar o processo no meio de uma marca. O que
    // sobrar fica não-processado e o próximo tick reprocessa (idempotente por batch).
    if (Date.now() > deadline) {
      console.log('[RADAR] Orçamento de finalize atingido, adiando batches restantes pro próximo tick')
      break
    }
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
  // Anti-alucinação: só sobrevive link que existe de fato nos dados coletados. Todas as
  // fontes atuais (Reddit, News, TikTok, X real, LinkedIn) trazem URL navegável de verdade
  // — o antigo Twitter Trends (só página de busca) foi aposentado, então nada é excluído.
  const urlsReais = new Set(
    rawData.map(d => d.url).filter(Boolean)
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
  const intervaloMs = (marca.intervalo_horas || 24) * 3_600_000
  return now - new Date(marca.ultima_varredura).getTime() >= intervaloMs
}

// Cada tick faz duas coisas: FINALIZA batches pendentes de ticks anteriores (o
// resultado da Apify que já ficou pronto) e DISPARA novos scrapes pras marcas
// vencidas. Assim nenhum passo espera run lento inline — o cron cobre a latência.
export async function runAllActiveRadars(): Promise<void> {
  const supabase = getSupabase()
  const anthropic = getAnthropic()

  const deadline = Date.now() + FINALIZE_BUDGET_MS

  // 1. Finaliza o que já voltou.
  await finalize(supabase, anthropic, deadline)

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

  // Enforcement (Fase 3B + status + modulo): a varredura é PULADA quando o tenant
  // está sem saldo, não está ativo (suspenso/cancelado), OU não assinou o módulo
  // "radar" — em todos os casos não gasta scrape. Radar não quebra: a marca volta
  // a rodar sozinha quando o tenant recarrega/reativa/reassina. Resolvido em
  // queries batch pelos tenants das due (service_role bypassa RLS).
  const tenantIds = Array.from(
    new Set(due.map(m => m.tenant_id).filter((id): id is string => Boolean(id)))
  )
  const { data: tenantsRow } = tenantIds.length
    ? await supabase.from('tenants').select('id, saldo_creditos, status').in('id', tenantIds)
    : { data: [] }
  // Modulo radar ativo por tenant. FAIL-OPEN: se a query falhar, NÃO enforça
  // (modInfo=false) pra não derrubar o radar por um blip; estrito quando há dados.
  const modResult = tenantIds.length
    ? await supabase.from('tenant_modulos').select('tenant_id')
        .eq('modulo', 'radar').eq('ativo', true).in('tenant_id', tenantIds)
    : { data: [], error: null }
  const modInfo = !modResult.error
  const comRadar = new Set((modResult.data ?? []).map(r => r.tenant_id))
  // Map tenant -> apto (ativo E com saldo E com módulo radar) + motivo do log.
  const apto = new Map<string, boolean>()
  const motivo = new Map<string, string>()
  for (const t of tenantsRow ?? []) {
    const ativo = t.status === 'ativo'
    const temSaldo = (t.saldo_creditos ?? 0) > 0
    const temRadar = !modInfo || comRadar.has(t.id)
    apto.set(t.id, ativo && temSaldo && temRadar)
    if (!ativo) motivo.set(t.id, `conta ${t.status}`)
    else if (!temSaldo) motivo.set(t.id, 'sem saldo de creditos')
    else if (!temRadar) motivo.set(t.id, 'modulo radar inativo')
  }

  const batchId = randomUUID()
  let disparadas = 0
  for (const marca of due) {
    if (!marca.tenant_id || !apto.get(marca.tenant_id)) {
      const razao = marca.tenant_id
        ? motivo.get(marca.tenant_id) ?? 'tenant nao elegivel'
        : 'sem tenant'
      console.log(`[RADAR] Pulada (${razao}): ${marca.nome}`)
      continue
    }
    try {
      await kickoffMarca(supabase, marca, batchId)
      disparadas++
    } catch (e) {
      console.error(`[RADAR] Erro ao disparar ${marca.nome}:`, e)
    }
  }
  console.log(`[RADAR] Disparo completo (${disparadas}/${due.length} due, ${marcas.length} ativas)`)
}

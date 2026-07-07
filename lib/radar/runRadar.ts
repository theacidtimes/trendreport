import { createClient } from '@supabase/supabase-js'
import { collectAllData } from './collectData'
import { scoreHype } from './scoreHype'
import { buildRadarPrompt } from './radarPrompt'
import { Marca } from '../types'
import Anthropic from '@anthropic-ai/sdk'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
}

export async function runRadarForMarca(marca: Marca): Promise<void> {
  console.log(`[RADAR] Iniciando: ${marca.nome}`)
  const supabase = getSupabase()
  const anthropic = getAnthropic()
  const k = marca.yaml_conhecimento
  const keywords = [k.marca, k.produto, ...k.universos_culturais.slice(0, 3)]

  const rawData = await collectAllData(keywords)
  if (rawData.length < 3) {
    console.log(`[RADAR] Dados insuficientes para ${marca.nome}`)
    return
  }

  const hype = scoreHype(rawData)
  if (hype.total < 20) {
    console.log(`[RADAR] Score baixo (${hype.total}), pulando ${marca.nome}`)
    await supabase.from('marcas').update({ ultima_varredura: new Date().toISOString() }).eq('id', marca.id)
    return
  }

  const { system, user } = buildRadarPrompt(k, rawData)
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
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
    return
  }

  const rows = drops.map(drop => ({
    marca_id:                    marca.id,
    insight_titulo:              drop.insight_titulo,
    categoria_funil:             drop.categoria_funil,
    status_hype:                 hype.status,
    indice_hype:                 hype.total,
    descricao_fato:              drop.descricao_fato,
    gancho_produto:              drop.gancho_produto,
    insight_criativo_cccaramelo: drop.insight_criativo_cccaramelo,
    links_fontes:                drop.links_fontes || [],
    score_densidade:             hype.densidade,
    score_transbordo:            hype.transbordo,
    score_velocidade:            hype.velocidade
  }))

  const { error } = await supabase.from('trends_radar').insert(rows)
  if (error) console.error(`[RADAR] Erro ao salvar:`, error)
  else console.log(`[RADAR] ${rows.length} drops salvos para ${marca.nome}`)

  await supabase.from('marcas').update({ ultima_varredura: new Date().toISOString() }).eq('id', marca.id)
}

export async function runAllActiveRadars(): Promise<void> {
  const supabase = getSupabase()
  const { data: marcas, error } = await supabase
    .from('marcas').select('*').eq('status_varredura', true)

  if (error || !marcas?.length) {
    console.log('[RADAR] Nenhuma marca ativa')
    return
  }

  for (const marca of marcas) {
    try {
      await runRadarForMarca(marca as Marca)
      await new Promise(r => setTimeout(r, 5000))
    } catch (e) {
      console.error(`[RADAR] Erro em ${marca.nome}:`, e)
    }
  }
  console.log('[RADAR] Varredura completa')
}

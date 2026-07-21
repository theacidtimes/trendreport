import { Fonte } from './collectData'
import { Marca, PulsoCultural } from '../types'

// Uma lane e um scrape (fonte + query). O planner e o unico lugar que compoe as
// lanes de uma marca: evergreen (comportamento eterno) + agenda viva assinada +
// ancoras de marca. Downstream (scrape jobs, grouping, scoring, prompt) trata lane
// como caixa-preta {fonte, keywords}, entao N lanes por fonte convivem sem migracao.
export type ScrapeLane = { fonte: Fonte; keywords: string[] }

// As tres fontes do coracao cultural: onde a audiencia vive. Cada cluster de termos
// vira um trio destes. News/news_global/linkedin sao ancoras, ficam fora do fan-out.
const CULTURAL_FONTES: Fonte[] = ['reddit', 'tiktok', 'twitter']

// Teto de clusters de AGENDA por varredura quando peso_cultural = 1. O dial escala
// linearmente daqui. Segura o custo de Apify: mais clusters = mais runs por marca.
const CAP_AGENDA_CLUSTERS = 6
// Teto de clusters EVERGREEN. Sem isto, uma marca com 30 termos viraria 10 trios.
const MAX_EVERGREEN_CLUSTERS = 3
// O scraper corta em 3 termos (reddit/twitter) / 2 (tiktok). Cluster de 3 mapeia 1:1
// numa query focada; passar disso so alimenta termo que nunca e buscado.
const CLUSTER_SIZE = 3
const PESO_CULTURAL_DEFAULT = 0.5

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n))
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function brandKeywords(marca: Marca): string[] {
  const k = marca.yaml_conhecimento
  return k.termos_busca?.length ? k.termos_busca : [k.marca, k.produto].filter(Boolean)
}

// Um trio reddit/tiktok/twitter pro mesmo conjunto de termos focados.
function culturalTrio(termos: string[]): ScrapeLane[] {
  if (!termos.length) return []
  return CULTURAL_FONTES.map(fonte => ({ fonte, keywords: termos }))
}

// Ancoras que NAO entram no fan-out: early signals global (culturalEn), ancora de
// marca (reddit direto + news pt-br) e LinkedIn (unica fonte ligavel por marca).
// Identicas ao lanesFor legado — o que muda entre os dois caminhos e so o miolo cultural.
function anchorLanes(marca: Marca): ScrapeLane[] {
  const k = marca.yaml_conhecimento
  const brand = brandKeywords(marca)
  const lanes: ScrapeLane[] = []
  if (k.termos_culturais_en?.length) lanes.push({ fonte: 'news_global', keywords: k.termos_culturais_en })
  lanes.push({ fonte: 'reddit', keywords: brand })
  lanes.push({ fonte: 'news', keywords: brand })
  if (k.linkedin_ativo) {
    const linkedinTerms = k.termos_linkedin?.length ? k.termos_linkedin : (k.termos_culturais ?? [])
    if (linkedinTerms.length) lanes.push({ fonte: 'linkedin', keywords: linkedinTerms })
  }
  return lanes
}

// Uma marca so entra no motor novo (fan-out + agenda) quando declara assinatura ou
// dial. Sem isso, roda IDENTICA ao comportamento legado — additive, opt-in, sem mudar
// custo de quem ainda nao foi migrado.
function optedIn(marca: Marca): boolean {
  const k = marca.yaml_conhecimento
  return (k.dominios_culturais?.length ?? 0) > 0 || k.peso_cultural != null
}

// Seleciona a agenda vigente pra ESTA marca: rows globais (tenant_id null) ou do
// proprio tenant, no(s) dominio(s) assinado(s), dentro da janela, ativas. Ordena por
// peso desc pra o corte por CAP pegar o mais relevante primeiro.
export function selectAgenda(marca: Marca, agenda: PulsoCultural[], now: Date): PulsoCultural[] {
  const dominios = new Set(marca.yaml_conhecimento.dominios_culturais ?? [])
  if (!dominios.size) return []
  const today = now.toISOString().slice(0, 10)
  return agenda
    .filter(a => a.ativo)
    .filter(a => a.tenant_id === null || a.tenant_id === marca.tenant_id)
    .filter(a => dominios.has(a.dominio))
    .filter(a => (!a.janela_inicio || a.janela_inicio <= today) &&
                 (!a.janela_fim || a.janela_fim >= today))
    .sort((x, y) => y.peso - x.peso)
}

// Compoe todas as lanes da varredura de uma marca. agenda = rows de pulso_cultural
// ja carregadas no tick (globais + do tenant). Marca nao-migrada ignora a agenda.
export function planLanes(marca: Marca, agenda: PulsoCultural[], now: Date = new Date()): ScrapeLane[] {
  const k = marca.yaml_conhecimento
  const evergreen = k.termos_culturais ?? []

  // LEGADO (nao opted-in): miolo cultural = um unico trio com o array inteiro (o
  // scraper corta em 3/2). Byte-identico ao lanesFor antigo.
  if (!optedIn(marca)) {
    return [...culturalTrio(evergreen), ...anchorLanes(marca)]
  }

  // NOVO: evergreen em clusters focados + agenda viva escalada pelo dial.
  const lanes: ScrapeLane[] = []

  for (const cluster of chunk(evergreen, CLUSTER_SIZE).slice(0, MAX_EVERGREEN_CLUSTERS)) {
    lanes.push(...culturalTrio(cluster))
  }

  const peso = k.peso_cultural ?? PESO_CULTURAL_DEFAULT
  const nAgenda = Math.round(clamp01(peso) * CAP_AGENDA_CLUSTERS)
  for (const a of selectAgenda(marca, agenda, now).slice(0, nAgenda)) {
    lanes.push(...culturalTrio(a.termos))
  }

  lanes.push(...anchorLanes(marca))
  return lanes
}

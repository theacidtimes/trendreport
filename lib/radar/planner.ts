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
// EXPORTADO porque é a unidade em que a derivação de perfil (perfilCultural.ts) e a
// tela pensam: ninguém avalia "0,67", todo mundo avalia "4 de 6 vagas". Duplicar o
// número lá seria deixar dois tetos divergirem em silêncio.
export const CAP_AGENDA_CLUSTERS = 6
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

/**
 * Por que esta marca está recebendo (ou não) agenda cultural nesta varredura.
 *
 * Existe porque as quatro situações abaixo produziam EXATAMENTE o mesmo efeito
 * observável — zero lanes de agenda, zero linhas de log — e têm causas e
 * correções completamente diferentes:
 *
 *  - `legado`     a marca nunca passou pela derivação. Não é decisão, é omissão:
 *                 os campos só existiam via SQL direto, então toda marca criada
 *                 pela tela caía aqui por construção. ISTO era o buraco.
 *  - `nao_assina` a derivação rodou e concluiu que a agenda não serve à marca.
 *                 Resposta legítima e barata (bloco de agenda ≈ $15–20/mês).
 *  - `sem_vagas`  assina domínios mas o dial está em 0. Config contraditória:
 *                 alguém escolheu domínios e depois zerou o peso.
 *  - `sem_linha`  assina e tem vagas, mas NADA casou. É o estado mais caro de
 *                 diagnosticar sem log, porque parece funcionando: o país pode
 *                 não bater (marca AU num acervo 100% BR), o domínio pode não
 *                 ter linha ativa, ou tudo pode estar fora de janela hoje.
 *
 * Não decide nada — `planLanes` continua sendo quem monta. Isto só dá NOME ao
 * que aconteceu, para o log e para a tela.
 */
export type DiagnosticoAgenda = {
  estado: 'legado' | 'nao_assina' | 'sem_vagas' | 'sem_linha' | 'ativa'
  vagas: number
  escolhidas: PulsoCultural[]
  resumo: string
}

export function diagnosticarAgenda(
  marca: Marca,
  agenda: PulsoCultural[],
  now: Date = new Date()
): DiagnosticoAgenda {
  const k = marca.yaml_conhecimento
  const nome = k.marca || marca.nome
  const vazio = { vagas: 0, escolhidas: [] as PulsoCultural[] }

  if (!optedIn(marca)) {
    return {
      ...vazio,
      estado: 'legado',
      resumo: `${nome}: agenda NÃO derivada (perfil cultural nunca foi calculado) — rodando no caminho legado`
    }
  }

  const dominios = k.dominios_culturais ?? []
  const vagas = Math.round(clamp01(k.peso_cultural ?? PESO_CULTURAL_DEFAULT) * CAP_AGENDA_CLUSTERS)
  const porque = k.justificativa_cultural ? ` — "${k.justificativa_cultural}"` : ''

  if (!dominios.length) {
    return { ...vazio, estado: 'nao_assina', resumo: `${nome}: sem agenda por decisão${porque}` }
  }
  if (vagas === 0) {
    return {
      ...vazio,
      estado: 'sem_vagas',
      resumo: `${nome}: assina [${dominios.join(', ')}] mas peso_cultural=${k.peso_cultural} dá 0 vaga — config contraditória`
    }
  }

  const vigentes = selectAgenda(marca, agenda, now)
  if (!vigentes.length) {
    // O acervo é medido aqui de propósito: "0 linha em massa/esporte para BR"
    // e "0 linha em massa/esporte para AU" são o mesmo sintoma com causas
    // opostas, e só o número separa as duas.
    const doDominio = agenda.filter(a => a.ativo && dominios.includes(a.dominio))
    const doPais = doDominio.filter(a => !a.pais || String(a.pais).toUpperCase() === paisDaMarca(marca))
    return {
      ...vazio,
      estado: 'sem_linha',
      resumo:
        `${nome}: assina [${dominios.join(', ')}] com ${vagas} vaga(s), mas NENHUMA linha vigente ` +
        `(${doDominio.length} no domínio, ${doPais.length} em ${paisDaMarca(marca)}, 0 na janela de hoje)`
    }
  }

  const escolhidas = distribuirVagas(vigentes, vagas)
  return {
    estado: 'ativa',
    vagas,
    escolhidas,
    resumo:
      `${nome}: agenda ${escolhidas.length}/${vagas} vaga(s) de ${vigentes.length} vigente(s) [${paisDaMarca(marca)}] — ` +
      escolhidas.map(a => `${a.titulo}${ehDatada(a) ? '*' : ''}`).join(', ')
  }
}

// País do calendário da marca. Default 'BR' porque todos os tenants nasceram BR e
// toda linha de agenda existente é brasileira — mudar o default silenciaria a agenda
// de quem já roda. Normalizado porque isto passa por formulário e por JSONB.
export function paisDaMarca(marca: Marca): string {
  const p = marca.yaml_conhecimento.pais
  return typeof p === 'string' && p.trim() ? p.trim().toUpperCase() : 'BR'
}

// Seleciona a agenda vigente pra ESTA marca: rows globais (tenant_id null) ou do
// proprio tenant, no(s) dominio(s) assinado(s), no calendario do pais da marca,
// dentro da janela, ativas.
// Filtra QUEM pode entrar; quem decide a ORDEM e o corte e distribuirVagas.
export function selectAgenda(marca: Marca, agenda: PulsoCultural[], now: Date): PulsoCultural[] {
  const dominios = new Set(marca.yaml_conhecimento.dominios_culturais ?? [])
  if (!dominios.size) return []
  const pais = paisDaMarca(marca)
  const today = now.toISOString().slice(0, 10)
  return agenda
    .filter(a => a.ativo)
    .filter(a => a.tenant_id === null || a.tenant_id === marca.tenant_id)
    .filter(a => dominios.has(a.dominio))
    // Linha sem país é universal e vale pra todo mundo; linha com país só entra no
    // calendário dela. O erro que isto impede é sutil e caro: a marca australiana
    // NÃO fica sem agenda por engano — ela cai no Dia dos Pais brasileiro (agosto),
    // que passa por todos os outros filtros e vira briefing convincente e errado.
    .filter(a => !a.pais || String(a.pais).toUpperCase() === pais)
    .filter(a => (!a.janela_inicio || a.janela_inicio <= today) &&
                 (!a.janela_fim || a.janela_fim >= today))
}

/**
 * Uma linha da agenda é DATADA quando tem janela; PERENE quando vale sempre.
 *
 * A distinção não é decorativa: as duas dizem coisas diferentes com o mesmo
 * campo `peso`. Perene peso 3 = "este tema sempre importa". Datada peso 3 =
 * "nestas duas semanas isto domina". Ordenar as duas na mesma régua foi o erro
 * que deixou três perenes ocuparem as vagas da Vivo permanentemente.
 */
export function ehDatada(a: PulsoCultural): boolean {
  return Boolean(a.janela_inicio || a.janela_fim)
}

// Empate no peso desempata por título: arbitrário, mas ESTÁVEL. A query que
// carrega a agenda não tem ORDER BY, então antes disto o desempate vinha na
// ordem que o Postgres devolvesse — quatro linhas peso 3 disputando três vagas
// davam cara ou coroa a cada varredura. Config previsível vale mais que rodízio
// acidental; se um dia quisermos rodízio, que seja decisão explícita.
function porPeso(x: PulsoCultural, y: PulsoCultural): number {
  return y.peso - x.peso || String(x.titulo).localeCompare(String(y.titulo))
}

/**
 * Distribui as vagas de agenda entre datadas vigentes e perenes.
 *
 * MEDIDO na Vivo em 01/08/2026: as três únicas perenes peso 3 ("Lançamentos de
 * streaming", "Brasileirão", "Comportamento nas redes") ocupavam as três vagas
 * TODO dia, e o "Dia dos Pais" — janela 27/07–09/08, acontecendo naquele exato
 * momento — ficava na 7ª posição, fora. Qualquer pauta datada de peso menor era
 * inalcançável por construção, não por azar da semana.
 *
 * Datada vigente entra primeiro, até METADE das vagas (mínimo 1). O teto existe
 * porque a perene não é enfeite: "Comportamento nas redes" (`viralizou`,
 * `trend do tiktok`, `todo mundo falando`) é o pescador genérico de trend, e foi
 * ELE que trouxe o Homem-Aranha — o tweet coletado é literalmente "todo mundo
 * falando de homem aranha ou avatar". Entregar todas as vagas para datas
 * comemorativas trocaria um cego por outro.
 *
 * Vaga que sobra de um lado vai para o outro: nunca devolve menos do que cabe.
 */
export function distribuirVagas(vigentes: PulsoCultural[], nVagas: number): PulsoCultural[] {
  if (nVagas <= 0) return []
  const datadas = vigentes.filter(ehDatada).sort(porPeso)
  const perenes = vigentes.filter(a => !ehDatada(a)).sort(porPeso)

  const tetoDatadas = Math.min(nVagas, Math.max(1, Math.floor(nVagas / 2)))
  const escolhidas = datadas.slice(0, tetoDatadas)
  escolhidas.push(...perenes.slice(0, nVagas - escolhidas.length))
  // Sem perene suficiente, a datada excedente completa (e vice-versa já saiu de
  // graça acima): o teto é proteção da perene, não desperdício de vaga.
  if (escolhidas.length < nVagas) {
    escolhidas.push(...datadas.slice(tetoDatadas, tetoDatadas + (nVagas - escolhidas.length)))
  }
  return escolhidas
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

  // Quem escolhe as linhas é o MESMO código que explica a escolha no log. Se a
  // seleção morasse aqui e o diagnóstico calculasse de novo, os dois divergiriam
  // na primeira mudança e o log passaria a mentir — que é pior do que não ter log.
  for (const a of diagnosticarAgenda(marca, agenda, now).escolhidas) {
    lanes.push(...culturalTrio(a.termos))
  }

  lanes.push(...anchorLanes(marca))
  return lanes
}

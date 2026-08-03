import Anthropic from '@anthropic-ai/sdk'
import { MarcaKnowledge } from '../types'
import { CAP_AGENDA_CLUSTERS } from './planner'

// DERIVA o perfil cultural de uma marca em vez de exigir que alguém o declare.
//
// Antes disto, `dominios_culturais` e `peso_cultural` eram os dois únicos campos
// do DNA que NÃO existiam no formulário de admin: a única forma de preenchê-los
// era SQL direto no banco. Marca nova entrava pela tela e saía de lá, por
// construção, sem agenda cultural nenhuma — e a ausência não dava erro nem log,
// só uma varredura mais cega. É o mesmo modo de falha silenciosa do corte por
// ordem de chegada no radarPrompt.
//
// A marca JÁ declara quem ela é (produto, perfil comportamental, universos
// culturais). O trabalho de traduzir isso para "quais domínios da agenda ela
// assina e quanto pesam" é derivação, não digitação.

const MODELO_PERFIL = 'claude-haiku-4-5-20251001'

// O que sai da derivação. `justificativa` não é enfeite: é o que permite a
// alguém olhar a tela e discordar com fundamento — sem ela, o campo derivado
// vira número mágico que ninguém ousa mexer.
export type PerfilCultural = {
  dominios_culturais: string[]
  peso_cultural: number
  justificativa: string
}

// Perfil de quem NÃO se beneficia da agenda. Não é erro nem fallback: é uma
// resposta legítima e o motivo de a derivação existir em vez de um default
// ligado pra todo mundo. Bloco de agenda custa da ordem de $15–20/mês por
// marca; ligar em marca B2B sem calendário correspondente é gasto puro.
export const SEM_AGENDA: PerfilCultural = {
  dominios_culturais: [],
  peso_cultural: 0,
  justificativa: 'Nenhum domínio da agenda tem relação com o território da marca.'
}

const SYSTEM = `Você configura o radar cultural de uma marca.

A AGENDA é um calendário compartilhado de assuntos ("Dia dos Pais", "Black
Friday", "Brasileirão"). Cada assunto pertence a um DOMÍNIO. A marca assina
domínios e recebe, a cada varredura, os assuntos vigentes daqueles domínios.

Sua tarefa: dado o DNA da marca, decidir QUAIS domínios ela assina e QUANTAS
vagas de agenda ela merece por varredura.

REGRAS:

1. Assine um domínio só se um assunto dele puder virar conteúdo DESSA marca.
   A pergunta é "a marca teria o que dizer sobre isso?", não "a marca tem
   alguma relação distante com isso?".

2. RELAÇÃO INDIRETA CONTA quando é real. Uma seguradora não fala de clima por
   hobby: chuva forte é o contexto em que se contrata seguro. Um hospital tem
   território legítimo em datas de saúde. Uma marca de sementes vive o
   calendário de safra. Procure o vínculo com o NEGÓCIO, não só com o tema.

3. NÃO assinar é uma resposta boa e frequente. Marca B2B de nicho, cujo público
   decide por critério técnico e não por conversa cultural, deve sair com
   ZERO domínios. Cada vaga custa dinheiro real em raspagem. Na dúvida entre
   assinar por perto e não assinar, não assine.

4. VAGAS (0 a ${CAP_AGENDA_CLUSTERS}) medem quanto a agenda deve ocupar a varredura:
   - 0 = a marca não vive de assunto do momento
   - 1-2 = a marca é puxada pela categoria; a agenda é tempero
   - 3-4 = a marca conversa com cultura com regularidade
   - 5-6 = a marca É pauta cultural (entretenimento, esporte, IP de massa)
   Nunca peça vagas se não assinou nenhum domínio, e nunca assine domínio
   pedindo zero vaga — as duas coisas juntas ou nenhuma.

5. Respeite "o que evitar". Se o território da marca é sensível, prefira menos.

Justifique em UMA frase, citando o que no DNA sustentou a decisão.`

// A tool carrega o vocabulário REAL de domínios como enum: o modelo não
// consegue inventar um domínio que não existe na agenda. Sem isto ele produz
// nomes plausíveis ("lifestyle", "negocios") que passariam no banco e seriam
// filtrados a zero pelo selectAgenda — config que MENTE, porque a tela mostra
// um domínio assinado que nunca casa com linha nenhuma.
export function buildPerfilTool(dominiosDisponiveis: string[]): Anthropic.Tool {
  return {
    name: 'perfil_cultural',
    description: 'Domínios da agenda que a marca assina e quantas vagas por varredura.',
    input_schema: {
      type: 'object',
      properties: {
        dominios: {
          type: 'array',
          items: { type: 'string', enum: dominiosDisponiveis },
          description: 'Domínios assinados. Lista vazia é resposta válida.'
        },
        vagas: {
          type: 'integer',
          minimum: 0,
          maximum: CAP_AGENDA_CLUSTERS,
          description: 'Quantos assuntos da agenda por varredura.'
        },
        justificativa: { type: 'string', description: 'Uma frase.' }
      },
      required: ['dominios', 'vagas', 'justificativa']
    }
  }
}

// O DNA que alimenta a decisão. Só o que descreve QUEM a marca é — nada de
// termos de busca, que são operacionais e não dizem nada sobre território.
export function descreverMarca(k: MarcaKnowledge): string {
  const linhas = [
    `Marca: ${k.marca}`,
    `Produto: ${k.produto}`,
    `Público: ${k.perfil_comportamental}`,
    `Universos culturais: ${(k.universos_culturais ?? []).join('; ') || '(não declarado)'}`,
    `Ambição: ${k.ambicao_de_marca}`,
    `O que evitar: ${(k.o_que_evitar ?? []).join('; ') || '(nada declarado)'}`,
    `País: ${k.pais ?? 'BR'}`
  ]
  return linhas.join('\n')
}

/**
 * Valida o que o modelo devolveu contra a realidade da agenda.
 *
 * O enum da tool já barra domínio inventado, mas isto NÃO é redundante: o
 * schema é uma instrução ao modelo, não uma garantia do runtime — e esta função
 * também é o ponto por onde passa o que um humano digitou na tela, que não tem
 * enum nenhum.
 *
 * As duas metades (domínios e vagas) têm que concordar. Domínio assinado com
 * zero vaga é config que parece ligada e não roda; vaga pedida sem domínio é
 * custo reservado para uma agenda vazia. Nos dois casos o resultado correto é
 * SEM_AGENDA, e explícito.
 */
export function normalizarPerfil(
  bruto: { dominios?: unknown; vagas?: unknown; justificativa?: unknown },
  dominiosDisponiveis: string[]
): PerfilCultural {
  const validos = new Set(dominiosDisponiveis)
  const dominios = Array.isArray(bruto.dominios)
    ? Array.from(new Set(bruto.dominios.filter((d): d is string => typeof d === 'string' && validos.has(d))))
    : []

  const vagasCru = typeof bruto.vagas === 'number' && Number.isFinite(bruto.vagas) ? bruto.vagas : 0
  const vagas = Math.max(0, Math.min(CAP_AGENDA_CLUSTERS, Math.round(vagasCru)))

  const justificativa =
    typeof bruto.justificativa === 'string' && bruto.justificativa.trim()
      ? bruto.justificativa.trim()
      : SEM_AGENDA.justificativa

  if (!dominios.length || vagas === 0) return { ...SEM_AGENDA, justificativa }

  // Guarda-se `peso_cultural` (0..1) porque é o que o planner lê, mas quem
  // decide é o número de VAGAS — inteiro, legível, e que se traduz direto em
  // custo (1 vaga = 3 lanes de raspagem). Pedir um float 0..1 a um modelo é
  // pedir ruído; `vagas / CAP` reconstrói o peso exato sem perda, porque o
  // planner faz `round(peso × CAP)` de volta.
  return {
    dominios_culturais: dominios.sort(),
    peso_cultural: vagas / CAP_AGENDA_CLUSTERS,
    justificativa
  }
}

// Quantas vagas aquele peso representa. Usado na tela e no log — ninguém
// consegue avaliar "0.67", todo mundo entende "4 de 6".
export function vagasDoPeso(peso: number | undefined): number {
  if (typeof peso !== 'number' || !Number.isFinite(peso)) return 0
  return Math.round(Math.max(0, Math.min(1, peso)) * CAP_AGENDA_CLUSTERS)
}

let _anthropic: Anthropic | null = null
function anthropicClient(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic()
  return _anthropic
}

/**
 * Deriva o perfil chamando o modelo. Roda no SAVE da marca, não na varredura:
 * é decisão de configuração, muda quando o DNA muda, e não pode virar custo
 * por rodada.
 *
 * `dominiosDisponiveis` vem do banco (`select distinct dominio from
 * pulso_cultural`), nunca de uma lista fixa no código. É o que faz um domínio
 * novo na agenda ficar disponível para todas as marcas sem deploy.
 *
 * Falha de rede devolve SEM_AGENDA: perder a chamada não pode impedir alguém
 * de salvar uma marca, e agenda vazia é o estado seguro (não gasta).
 */
export async function derivarPerfilCultural(
  k: MarcaKnowledge,
  dominiosDisponiveis: string[]
): Promise<PerfilCultural> {
  if (!dominiosDisponiveis.length) return SEM_AGENDA
  try {
    const res = await anthropicClient().messages.create({
      model: MODELO_PERFIL,
      max_tokens: 400,
      system: SYSTEM,
      tools: [buildPerfilTool(dominiosDisponiveis)],
      tool_choice: { type: 'tool', name: 'perfil_cultural' },
      messages: [{ role: 'user', content: descreverMarca(k) }]
    })
    const bloco = res.content.find(c => c.type === 'tool_use')
    if (!bloco || bloco.type !== 'tool_use') return SEM_AGENDA
    return normalizarPerfil(bloco.input as Record<string, unknown>, dominiosDisponiveis)
  } catch (e) {
    console.error(`[PERFIL] derivação falhou para ${k.marca}:`, e)
    return SEM_AGENDA
  }
}

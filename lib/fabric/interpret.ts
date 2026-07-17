import { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import {
  loadTaxonomy, keepValid, Taxonomy, TaxonomyTerm, FabricDimension
} from './taxonomy'

const anthropic = new Anthropic()

// Modelo da camada de interpretacao. Versionado junto do resultado (signal.
// modelo_versao) pra sabermos com QUE lente + QUE modelo um sinal foi lido.
const INTERPRET_MODEL = 'claude-haiku-4-5-20251001'
const MODELO_VERSAO = 'interpret-haiku45-v1'

// Sinal bruto de entrada (o que o radar ja coletou). NAO entra na lake — e a
// materia-prima da leitura. So o resultado des-identificado (Interpretation) e
// que vira signal.
export interface RawSignalInput {
  fonte: string                 // reddit | news | twitter | tiktok | linkedin
  titulo: string
  snippet?: string | null
  url?: string | null           // usado so pra dedup no radar; NUNCA vai pra lake
  occurred_at?: string | null   // quando o sinal aconteceu (post)
  upvotes?: number | null
  comentarios?: number | null
  idioma_hint?: string | null   // se o coletor souber; senao o LLM infere
  regiao_hint?: string | null
}

// O resultado des-identificado — exatamente o payload de fabric_lake.signal
// (menos id/ingested_at/embedding, que o caller anexa).
export interface Interpretation {
  occurred_at: string | null
  setor: string | null
  plataforma: string | null
  formato: string | null
  regiao: string | null
  idioma: string | null
  momento: string | null
  comportamento: string[]
  emocao: string[]
  inflexao: string[]
  lente_negocio: string[]
  tema_deid: string | null
  engajamento_faixa: string | null
  taxonomia_versao: number
  modelo_versao: string
}

// fonte do radar → termo controlado de `plataforma` (deterministico, sem LLM).
const FONTE_PLATAFORMA: Record<string, string> = {
  reddit: 'reddit',
  news: 'news',
  twitter: 'twitter',
  tiktok: 'tiktok',
  linkedin: 'linkedin',
  instagram: 'instagram',
  youtube: 'youtube'
}

// Faixa de engajamento por BUCKET (nunca numero cru rastreavel). Rascunho v1:
// soma bruta de sinais de interacao. Thresholds sao um chute inicial, editaveis.
function faixaEngajamento(input: RawSignalInput): string | null {
  const total = (input.upvotes ?? 0) + (input.comentarios ?? 0)
  if (input.upvotes == null && input.comentarios == null) return null
  if (total >= 500) return 'alto'
  if (total >= 50) return 'medio'
  return 'baixo'
}

// Scrub de defesa: mesmo instruindo o LLM a nao citar identidade, removemos
// URLs e @handles do tema por regex antes de persistir. Cinto e suspensorio.
function scrubIdentity(text: string | null): string | null {
  if (!text) return null
  const cleaned = text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/@[\w.]+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return cleaned.length > 0 ? cleaned : null
}

// Lista "termo — descricao" pra injetar no prompt (guia de anotacao). A descricao
// e o que qualifica um sinal pra aquela tag; sem ela o LLM vira adivinhacao.
function vocabGuide(terms: TaxonomyTerm[]): string {
  return terms
    .map(t => t.descricao ? `${t.termo} (${t.descricao})` : t.termo)
    .join(', ')
}

// Monta a tool com ENUMS dos termos validos — a garantia mais forte de que a
// saida fica dentro do vocabulario controlado (o modelo nao inventa termo).
function buildTool(tax: Taxonomy): Anthropic.Tool {
  const enumOf = (d: FabricDimension) => tax.dims[d].map(t => t.termo)
  const single = (d: FabricDimension, desc: string) => ({
    type: 'string' as const, enum: enumOf(d), description: desc
  })
  const multi = (d: FabricDimension, desc: string) => ({
    type: 'array' as const, items: { type: 'string' as const, enum: enumOf(d) },
    description: desc
  })

  return {
    name: 'ler_sinal',
    description:
      'Interpreta um sinal cultural bruto e devolve a leitura des-identificada ' +
      'usando SOMENTE o vocabulario controlado. Nunca cite marca, produto, ' +
      'empresa, pessoa, @perfil ou URL em nenhum campo.',
    input_schema: {
      type: 'object',
      properties: {
        setor: single('setor', 'Setor economico do tema. Omita se ambiguo.'),
        formato: single('formato', 'Formato do conteudo do sinal.'),
        regiao: single('regiao', 'Regiao geografica predominante. Omita se incerto.'),
        idioma: single('idioma', 'Idioma predominante do sinal.'),
        momento: single('momento', 'Estagio do ciclo do tema (leitura do agora).'),
        comportamento: multi('comportamento', 'O que as pessoas estao FAZENDO com o tema (0 a 3).'),
        emocao: multi('emocao', 'Tom afetivo dominante (0 a 3).'),
        inflexao: multi('inflexao', 'A mudanca cultural que o sinal denuncia (0 a 2).'),
        lente_negocio: multi('lente_negocio', 'Traducao pra oportunidade de negocio (0 a 2).'),
        tema_deid: {
          type: 'string',
          description:
            'O tema em 1 frase curta e NEUTRA, sem nenhum nome proprio de ' +
            'marca/produto/empresa/pessoa. Ex.: "cansaco com assinaturas que ' +
            'sobem de preco sem aviso", nao "gente reclamando da Netflix".'
        }
      },
      required: ['comportamento', 'emocao', 'tema_deid']
    }
  }
}

function buildSystem(tax: Taxonomy): string {
  return [
    'Voce e a camada de percepcao da ACID: le um sinal cultural bruto (post, ',
    'comentario, noticia) e devolve uma LEITURA estruturada usando um ',
    'vocabulario controlado. Regras absolutas:',
    '- Use SOMENTE os termos oferecidos em cada dimensao (a tool restringe).',
    '- NUNCA inclua nome de marca, produto, empresa, pessoa, @perfil ou URL ',
    '  em nenhum campo, principalmente em tema_deid. A lake e des-identificada.',
    '- Prefira PRECISAO a cobertura: se uma dimensao nao se aplica com clareza, ',
    '  deixe vazia. Nao force tags.',
    '- Voce interpreta o que o sinal MOSTRA agora, nao preve o futuro.',
    '',
    'Guia de anotacao das dimensoes semanticas:',
    `comportamento: ${vocabGuide(tax.dims.comportamento)}`,
    `emocao: ${vocabGuide(tax.dims.emocao)}`,
    `inflexao: ${vocabGuide(tax.dims.inflexao)}`,
    `lente_negocio: ${vocabGuide(tax.dims.lente_negocio)}`
  ].join('\n')
}

const cleanList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
       .map(x => x.trim())
    : []

const cleanStr = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null

// Interpreta um sinal bruto → leitura des-identificada. NAO persiste (o caller
// anexa o embedding ja pago e chama fabric_ingest_signal). Determinismo primeiro
// (plataforma, faixa), LLM so pra semantica; toda saida do LLM e validada contra
// o vocabulario (descarta alucinacao). Erro na chamada = null (fail-safe: o
// radar do cliente nao pode quebrar por causa da lake).
export async function interpretSignal(
  supabase: SupabaseClient,
  input: RawSignalInput,
  versao?: number
): Promise<Interpretation | null> {
  let tax: Taxonomy
  try {
    tax = await loadTaxonomy(supabase, versao)
  } catch (e) {
    console.error('[FABRIC] loadTaxonomy falhou:', e)
    return null
  }

  const plataforma = FONTE_PLATAFORMA[input.fonte.toLowerCase()] ?? null
  const engajamento_faixa = faixaEngajamento(input)

  const userText = [
    `PLATAFORMA: ${plataforma ?? 'desconhecida'}`,
    input.idioma_hint ? `IDIOMA (dica): ${input.idioma_hint}` : null,
    input.regiao_hint ? `REGIAO (dica): ${input.regiao_hint}` : null,
    `TITULO: ${input.titulo}`,
    input.snippet ? `TRECHO: ${input.snippet}` : null
  ].filter(Boolean).join('\n')

  let out: Record<string, unknown>
  try {
    const res = await anthropic.messages.create({
      model: INTERPRET_MODEL,
      max_tokens: 400,
      system: buildSystem(tax),
      tools: [buildTool(tax)],
      tool_choice: { type: 'tool', name: 'ler_sinal' },
      messages: [{ role: 'user', content: userText }]
    })
    const toolUse = res.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use'
    )
    if (!toolUse) return null
    out = toolUse.input as Record<string, unknown>
  } catch (e) {
    console.error('[FABRIC] interpret LLM falhou:', e)
    return null
  }

  // valida structural single-value contra o vocab
  const singleValid = (d: FabricDimension, v: unknown): string | null => {
    const s = cleanStr(v)
    return s && tax.valid[d].has(s) ? s : null
  }

  return {
    occurred_at: cleanStr(input.occurred_at),
    setor: singleValid('setor', out.setor),
    plataforma,   // deterministico, ja e termo valido (ou null)
    formato: singleValid('formato', out.formato),
    regiao: singleValid('regiao', out.regiao) ?? (input.regiao_hint ?? null),
    idioma: singleValid('idioma', out.idioma) ?? (input.idioma_hint ?? null),
    momento: singleValid('momento', out.momento),
    comportamento: keepValid(tax, 'comportamento', cleanList(out.comportamento)).slice(0, 3),
    emocao: keepValid(tax, 'emocao', cleanList(out.emocao)).slice(0, 3),
    inflexao: keepValid(tax, 'inflexao', cleanList(out.inflexao)).slice(0, 2),
    lente_negocio: keepValid(tax, 'lente_negocio', cleanList(out.lente_negocio)).slice(0, 2),
    tema_deid: scrubIdentity(cleanStr(out.tema_deid)),
    engajamento_faixa,
    taxonomia_versao: tax.versao,
    modelo_versao: MODELO_VERSAO
  }
}

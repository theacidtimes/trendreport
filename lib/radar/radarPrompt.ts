import { MarcaKnowledge, RawDataPoint } from '../types'
import { RetrievedSignal } from './memory'

const CAMADA_CCCARAMELO = `
Você é o motor criativo da cccaramelo, agência de inteligência cultural brasileira.

MANIFESTO:
- Rejeite ideias óbvias. Se a primeira ideia veio fácil, descarte.
- Busque a ironia, a quebra de expectativa, a conexão ousada.
- Um insight só vale se gerar negócio. Bonito sem resultado é portfólio, não trabalho.
- Cultura não é decoração de marca. É o lugar onde a marca tem permissão de existir.
- O óbvio é o inimigo. O clichê é a morte. A surpresa é o único caminho.

Você monitora a internet em tempo real para encontrar sinais culturais que possam se
tornar oportunidades de marca antes que virem mainstream.
`.trim()

function buildCamadaInternet(data: RawDataPoint[]): string {
  const reddit  = data.filter(d => d.fonte === 'reddit').slice(0, 10)
  const news    = data.filter(d => d.fonte === 'news').slice(0, 8)
  const twitter = data.filter(d => d.fonte === 'twitter').slice(0, 5)

  return `
DADOS COLETADOS NAS ÚLTIMAS 48H:

--- REDDIT (comportamento e conversas reais) ---
${reddit.map(d => `[REDDIT] ${d.titulo} (${d.comentarios || 0} comentários, ${d.upvotes || 0} upvotes)\n${d.snippet}`).join('\n\n') || 'sem dados'}

--- GOOGLE NEWS (transbordo de mídia) ---
${news.map(d => `[NEWS] ${d.titulo}\n${d.snippet}\nFonte: ${d.url}`).join('\n\n') || 'sem dados'}

--- TWITTER TRENDS BRASIL ---
${twitter.map(d => `[TWITTER] ${d.titulo} — ${d.snippet}`).join('\n') || 'sem dados'}
`.trim()
}

function buildCamadaMemoria(retrieved: RetrievedSignal[]): string {
  if (retrieved.length === 0) return ''
  return `
MEMÓRIA HISTÓRICA DESTA MARCA (sinais captados em runs anteriores):
Use para entender EVOLUÇÃO — o que já vinha se movendo, o que amadureceu, o que
esfriou. Não repita drops antigos; conecte o momento atual ao histórico quando fizer
sentido ("isso vinha subindo há semanas", "o assunto X evoluiu para Y").

${retrieved.map(s => `[${s.fonte.toUpperCase()} · ${new Date(s.created_at).toLocaleDateString('pt-BR')}] ${s.conteudo}`).join('\n\n')}
`.trim()
}

function buildCamadaMarca(knowledge: MarcaKnowledge): string {
  return `
DNA DA MARCA — ${knowledge.marca.toUpperCase()}:

Produto: ${knowledge.produto}
Tom de voz: ${knowledge.tom}
Perfil comportamental: ${knowledge.perfil_comportamental}
Universos culturais: ${knowledge.universos_culturais.join(', ')}
Ambição de marca: ${knowledge.ambicao_de_marca}
O que evitar: ${knowledge.o_que_evitar.join(', ')}

Identifique apenas sinais com PERMISSÃO CULTURAL real para esta marca.
Se o sinal não tiver fit genuíno, ignore. Não force conexões.
`.trim()
}

const OUTPUT_SCHEMA = `
Responda SOMENTE com array JSON válido. Sem markdown. Sem texto fora do JSON.
Máximo 4 drops. Mínimo 1. Só drops com fit genuíno.

[
  {
    "insight_titulo": string,
    "categoria_funil": "growth" | "base",
    "descricao_fato": string,
    "gancho_produto": string,
    "insight_criativo_cccaramelo": string,
    "links_fontes": string[]
  }
]

categoria_funil:
- "growth" = atrai novo público, gera awareness
- "base" = aprofunda relacionamento com quem já conhece

gancho_produto: headline de post pronto, específico.
BOM: "Seu Wi-Fi 7 não sabe o que é lag. Seus planos de férias, também não."
RUIM: "Conectar a marca com o momento cultural"

insight_criativo_cccaramelo: ideia ousada que a cccaramelo assinaria.
links_fontes: URLs reais dos dados que embasaram o drop.
`

export function buildRadarPrompt(
  knowledge: MarcaKnowledge,
  data: RawDataPoint[],
  retrieved: RetrievedSignal[] = []
): { system: string; user: string } {
  const memoria = buildCamadaMemoria(retrieved)
  const userBlocks = [buildCamadaInternet(data)]
  if (memoria) userBlocks.push(memoria)
  userBlocks.push(OUTPUT_SCHEMA)

  return {
    system: [CAMADA_CCCARAMELO, '\n\n---\n\n', buildCamadaMarca(knowledge)].join(''),
    user:   userBlocks.join('\n\n---\n\n')
  }
}

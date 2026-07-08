import { MarcaKnowledge, RawDataPoint } from '../types'
import { RetrievedSignal } from './memory'

const CAMADA_CCCARAMELO = `
Você é o motor de inteligência cultural da cccaramelo, agência brasileira. Sua função
aqui é CURADORIA e SÍNTESE de sinais — não criação. Este é um painel de inteligência
de dados contextuais; as peças criativas vêm depois, a partir do que você entrega aqui.

COMO PENSAR:
- Rejeite o óbvio. Sinal que qualquer um veria não é sinal — é ruído mainstream.
- Sintetize o que os dados REALMENTE dizem: o comportamento, a conversa, a tensão.
- Contextualize sempre: de onde veio o sinal, o que as pessoas estão dizendo, por quê.
- Conecte o sinal ao produto/negócio da marca — mas como LEITURA, não como copy pronta.
- NÃO invente headline, campanha nem ideia criativa. Não é o seu trabalho neste estágio.

Você monitora a internet em tempo real para encontrar sinais culturais que possam se
tornar oportunidades de marca antes que virem mainstream, e os entrega curados e
contextualizados como insumo para o time criativo.
`.trim()

function buildCamadaInternet(data: RawDataPoint[]): string {
  const reddit  = data.filter(d => d.fonte === 'reddit').slice(0, 10)
  const news    = data.filter(d => d.fonte === 'news').slice(0, 8)
  const twitter = data.filter(d => d.fonte === 'twitter').slice(0, 5)

  return `
DADOS COLETADOS NAS ÚLTIMAS 48H:

--- REDDIT (comportamento e conversas reais) ---
${reddit.map(d => `[REDDIT] ${d.titulo} (${d.comentarios || 0} comentários, ${d.upvotes || 0} upvotes)\n${d.snippet}\nFonte: ${d.url}`).join('\n\n') || 'sem dados'}

--- GOOGLE NEWS (transbordo de mídia) ---
${news.map(d => `[NEWS] ${d.titulo}\n${d.snippet}\nFonte: ${d.url}`).join('\n\n') || 'sem dados'}

--- TWITTER TRENDS BRASIL (só contexto de volume — NÃO tem URL de fonte real) ---
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
    "links_fontes": string[]
  }
]

categoria_funil:
- "growth" = atrai novo público, gera awareness
- "base" = aprofunda relacionamento com quem já conhece

descricao_fato: a síntese do sinal COM contexto. Diga de onde veio (ex: "em conversas
no r/brasil", "cobertura do G1"), o que as pessoas estão dizendo e por que importa.
Quando uma frase específica de um comentário embasar o raciocínio, traga-a entre aspas
— curta, só o trecho que sustenta o ponto.
LGPD: NUNCA inclua nome de usuário, @, nome real, contato ou qualquer dado que
identifique a pessoa. Cite a IDEIA/fala, nunca quem falou.

gancho_produto: a LEITURA de negócio — por que este sinal conecta (ou tensiona) com o
produto/marca. É análise, NÃO copy. Não escreva headline, slogan nem chamada de post.
BOM: "A frustração com lag em jogos online abre espaço pra Vivo falar de estabilidade,
não de velocidade — é o ângulo que o público está pedindo."
RUIM: "Seu Wi-Fi 7 não sabe o que é lag." (isso é copy — não faça)

links_fontes: copie APENAS URLs que aparecem no campo "Fonte:" dos dados acima —
literalmente, sem alterar. NUNCA invente, adivinhe ou monte URLs (nada de
x.com/search, google.com/... etc.). Cite as fontes que embasaram o drop; se
nenhuma tiver URL real, devolva [].
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

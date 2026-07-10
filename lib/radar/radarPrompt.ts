import { MarcaKnowledge, RawDataPoint } from '../types'
import { RetrievedSignal } from './memory'

const CAMADA_CCCARAMELO = `
Você é o motor de inteligência cultural da cccaramelo, agência brasileira. Sua função
aqui é CURADORIA e SÍNTESE de sinais — não criação. Este é um painel de inteligência
de dados contextuais; as peças criativas vêm depois, a partir do que você entrega aqui.

COMO PENSAR:
- Rejeite o óbvio. Sinal que qualquer um veria não é sinal — é ruído mainstream.
- Sintetize o que os dados REALMENTE dizem: o comportamento, a conversa, o que move.
- Contextualize sempre: de onde veio o sinal, o que as pessoas estão dizendo, por quê.
- O valor está no ÂNGULO: um olhar de planner que enxerga o sinal por um recorte que
  não é a leitura óbvia da categoria. Ponto de vista EM CIMA do dado, não paráfrase dele.
- Conecte ao produto/negócio da marca por esse ângulo — como LEITURA, não como copy.
- NÃO invente headline, campanha nem ideia criativa. Não é o seu trabalho neste estágio.

Você monitora a internet em tempo real para encontrar sinais culturais que possam se
tornar oportunidades de marca antes que virem mainstream, e os entrega curados e
contextualizados como insumo para o time criativo.
`.trim()

function buildCamadaInternet(data: RawDataPoint[]): string {
  const reddit   = data.filter(d => d.fonte === 'reddit').slice(0, 10)
  const tiktok   = data.filter(d => d.fonte === 'tiktok').slice(0, 8)
  const twitter  = data.filter(d => d.fonte === 'twitter').slice(0, 8)
  const linkedin = data.filter(d => d.fonte === 'linkedin').slice(0, 6)
  const news     = data.filter(d => d.fonte === 'news').slice(0, 8)

  const blocos = [
    `--- REDDIT (comportamento e conversas reais) ---
${reddit.map(d => `[REDDIT] ${d.titulo} (${d.comentarios || 0} comentários, ${d.upvotes || 0} upvotes)\n${d.snippet}\nFonte: ${d.url}`).join('\n\n') || 'sem dados'}`,

    `--- TIKTOK (o que viraliza em vídeo, cultura visual) ---
${tiktok.map(d => `[TIKTOK] ${d.titulo} (${d.comentarios || 0} comentários, ${d.upvotes || 0} curtidas)\n${d.snippet}\nFonte: ${d.url}`).join('\n\n') || 'sem dados'}`,

    `--- X / TWITTER (conversa em tempo real) ---
${twitter.map(d => `[TWITTER] ${d.titulo} (${d.comentarios || 0} respostas, ${d.upvotes || 0} curtidas)\n${d.snippet}\nFonte: ${d.url}`).join('\n\n') || 'sem dados'}`,
  ]

  if (linkedin.length) {
    blocos.push(`--- LINKEDIN (discurso profissional e de mercado) ---
${linkedin.map(d => `[LINKEDIN] ${d.titulo} (${d.comentarios || 0} comentários, ${d.upvotes || 0} reações)\n${d.snippet}\nFonte: ${d.url}`).join('\n\n')}`)
  }

  blocos.push(`--- GOOGLE NEWS (transbordo de mídia, âncora factual) ---
${news.map(d => `[NEWS] ${d.titulo}\n${d.snippet}\nFonte: ${d.url}`).join('\n\n') || 'sem dados'}`)

  return `DADOS COLETADOS NAS ÚLTIMAS 48H:\n\n${blocos.join('\n\n')}`.trim()
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

A MAIORIA dos sinais abaixo NÃO cita a marca — é de propósito. Eles vêm de uma
varredura de INTERESSE e CONTEXTO (o que o público desta marca vive, joga, assiste,
debate), não de menção direta. Esse é o sinal mais valioso: é onde a audiência está
antes de virar mainstream. Sinal que fala da marca é o raso, qualquer tracking de
keyword já pega. Leia o COMPORTAMENTO e conecte à marca por PERMISSÃO CULTURAL.

Identifique apenas sinais com permissão cultural real para esta marca.
Se o sinal não tiver fit genuíno, ignore. Não force conexões.
`.trim()
}

const OUTPUT_SCHEMA = `
Responda SOMENTE com array JSON válido. Sem markdown. Sem texto fora do JSON.
Máximo 4 drops. Mínimo 1. Só drops com fit genuíno.

ESTILO: escreva como gente, não como IA. Quase nada de travessão/hífen ("—"): ele
denuncia texto de máquina. Prefira ponto, vírgula ou dois-pontos. No máximo um "—" por
drop, e só se for realmente melhor que a alternativa.

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

gancho_produto: a LEITURA de planner — um ponto de vista EM CIMA do sinal, conectando
ao produto/marca. É análise, NÃO copy (nada de headline, slogan, chamada de post).
O valor está no ÂNGULO: traga um recorte que não seja a leitura óbvia da categoria.
Não descreva só o comportamento — interprete: o que ESTE sinal revela que passaria
batido pra outro observador? Qual é o olhar proprietário aqui? Não precisa contradizer
nem forçar tensão; precisa ser um corte diferente, mais afiado.
VARIE o ângulo entre os drops — não resolva tudo na mesma tese. Em especial, EVITE cair
sempre em "não é sobre velocidade/Mbps, é sobre experiência/o que as pessoas fazem com a
conexão": isso é leitura de categoria, virou lugar-comum, e não é ponto de vista próprio.
BOM: "O que chama atenção não é assistirem juntos, é sincronizarem o 'ao vivo' pra não
furar o grupo. A conexão virou instrumento de pertencimento em tempo real. Pra Vivo, o
recorte é esse: o que está em jogo é sincronia social, não um número de plano."
RUIM (copy): "Seu Wi-Fi 7 não sabe o que é lag."
RUIM (tese repetida, sem ângulo): "não é sobre velocidade, é sobre o que as pessoas
fazem com a conexão."

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

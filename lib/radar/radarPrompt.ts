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

// ── Quantos sinais de cada fonte chegam ao modelo ─────────────────────────
//
// MEDIDO (Vivo, 10 dias de jul/2026): a coleta entrega 99–197 tweets, 56–114
// TikToks, 39–80 notícias e 17–46 posts de Reddit POR DIA. Os limites antigos
// (10/8/8/6/8) mandavam ~34 itens ao modelo, ou seja ~9% do que foi raspado e
// pago. O resto era descartado — e, pior, descartado por ordem de chegada.
//
// Os tetos abaixo dobram o que o modelo enxerga. O custo é só token de input:
// ~7k → ~15k tokens por varredura, algo como +$0,02 por run no Sonnet (menos
// de $2/mês no volume atual, contra os $69 que o sistema já gasta). Barato
// perto de raspar 400 itens e mostrar 34.
//
// Reddit tem o teto mais alto em relação ao volume porque é onde está a
// conversa (post + até 5 comentários por item); Twitter e TikTok são o grosso
// da coleta e é lá que o corte doía mais.
const LIMITES: Record<string, number> = {
  reddit: 20,
  tiktok: 20,
  twitter: 20,
  linkedin: 12,
  news: 15
}

function numero(v: unknown): number {
  // Comparador que devolve NaN deixa a ordenação indefinida — um único item com
  // campo sujo bagunçaria a lista inteira, em silêncio.
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/**
 * Engajamento de um sinal: reações + conversa.
 *
 * Só é usado para ordenar DENTRO de uma mesma fonte, e é por isso que somar os
 * dois campos crus funciona sem normalização: 400 upvotes é topo do Reddit no
 * mesmo dia em que 250 mil curtidas é topo do Twitter, mas essas duas listas
 * nunca se comparam entre si.
 *
 * Não inventei peso para "comentário vale N curtidas": não tenho dado que
 * sustente o número, e chutar um multiplicador aqui seria trocar um viés
 * arbitrário (ordem de chegada) por outro mais difícil de enxergar.
 */
export function engajamento(d: RawDataPoint): number {
  return numero(d.upvotes) + numero(d.comentarios)
}

/**
 * Os `limite` sinais mais engajados de uma fonte.
 *
 * O bug que isto corrige: antes era `.filter(...).slice(0, 8)`, sem ordenar.
 * O `.slice` pegava os primeiros na ordem em que a Apify devolveu, o que na
 * prática é sorteio. Consequência medida na Vivo em 01/08/2026: um drop foi
 * construído sobre dois tweets de 2 e 9 curtidas (posições 92 e 82 de 99),
 * postados em 2019 e 2023, enquanto o tweet nº 11 do dia — 16.885 curtidas,
 * sobre a estreia do Homem-Aranha — nunca chegou ao modelo.
 *
 * O `.filter` já devolve array novo, então o `.sort` NÃO reordena o array do
 * chamador: `rawData` continua na ordem original para o `urlsReais` e o
 * `scoreForDrop` do runRadar.
 *
 * A ordenação é estável (garantia da spec desde ES2019) e o comparador devolve
 * 0 no empate. Isso importa para o `news`, que não tem contador de engajamento
 * nenhum: todos empatam em 0 e a lista preserva a ordem de chegada, que ali é
 * a ordem de relevância do próprio Google News.
 */
export function maisRelevantes(
  data: RawDataPoint[],
  fonte: RawDataPoint['fonte'],
  limite: number
): RawDataPoint[] {
  return data
    .filter(d => d.fonte === fonte)
    .sort((a, b) => engajamento(b) - engajamento(a))
    .slice(0, limite)
}

/** Quanto da coleta ficou de fora, por fonte. Vira log em runRadar. */
export function resumirCorte(data: RawDataPoint[]): string {
  const partes = Object.keys(LIMITES).map(fonte => {
    const total = data.filter(d => d.fonte === fonte).length
    return `${fonte} ${Math.min(total, LIMITES[fonte])}/${total}`
  })
  return partes.join(', ')
}

function buildCamadaInternet(data: RawDataPoint[]): string {
  const reddit   = maisRelevantes(data, 'reddit',   LIMITES.reddit)
  const tiktok   = maisRelevantes(data, 'tiktok',   LIMITES.tiktok)
  const twitter  = maisRelevantes(data, 'twitter',  LIMITES.twitter)
  const linkedin = maisRelevantes(data, 'linkedin', LIMITES.linkedin)
  const news     = maisRelevantes(data, 'news',     LIMITES.news)

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

  // O cabeçalho dizia "COLETADOS NAS ÚLTIMAS 48H" e isso era FALSO: só o
  // Reddit (time=month) e o TikTok (PAST_MONTH) têm janela; a busca do Twitter
  // roda com sort=Top e recorte nenhum. Medido na Vivo (1.215 tweets em 10
  // dias): 45,9% eram das últimas 48h e 123 tinham mais de um ano — havia coisa
  // de 2015. Enquanto a lane não ganhar janela (correção separada), o prompt
  // não afirma uma recência que o dado não tem, e avisa o modelo para conferir.
  return `SINAIS COLETADOS NESTA VARREDURA (mais engajados primeiro, dentro de cada fonte):

A data de publicação NÃO vem nos dados. Boa parte da coleta é recente, mas há
material antigo misturado. Antes de tratar um sinal como "está acontecendo
agora", procure a âncora temporal no próprio conteúdo (o que ele cita, a que
responde). Na dúvida, prefira o sinal que várias fontes sustentam ao mesmo
tempo — e não descreva como novidade o que pode ser reprise.

${blocos.join('\n\n')}`.trim()
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
): { system: string; user: string; corte: string } {
  const memoria = buildCamadaMemoria(retrieved)
  const userBlocks = [buildCamadaInternet(data)]
  if (memoria) userBlocks.push(memoria)
  userBlocks.push(OUTPUT_SCHEMA)

  return {
    system: [CAMADA_CCCARAMELO, '\n\n---\n\n', buildCamadaMarca(knowledge)].join(''),
    user:   userBlocks.join('\n\n---\n\n'),
    corte:  resumirCorte(data)
  }
}

import type { PulsoCultural } from '../types'

/**
 * Normalização e validação de uma linha da agenda cultural (`pulso_cultural`).
 *
 * Existe separado da tela e do banco porque toda regra aqui protege contra a
 * MESMA família de falha: linha que o Postgres aceita sem reclamar, que aparece
 * na tela parecendo configurada, e que `selectAgenda` filtra a zero para sempre.
 * Nenhuma delas dá erro. Todas custam uma vaga que a marca acha que está usando.
 */

// Campos que a tela manda. `id` ausente = linha nova.
export type EntradaLinha = {
  id?: string
  dominio: string
  titulo: string
  termos: string[]
  janela_inicio?: string | null
  janela_fim?: string | null
  peso: number
  ativo: boolean
  pais?: string | null
  tenant_id?: string | null
}

export type LinhaNormalizada = {
  dominio: string
  titulo: string
  termos: string[]
  janela_inicio: string | null
  janela_fim: string | null
  peso: number
  ativo: boolean
  pais: string | null
  tenant_id: string | null
}

export type Validacao =
  | { ok: true; linha: LinhaNormalizada }
  | { ok: false; erro: string }

// Peso da linha. Faixa curta de propósito: o peso só existe para ordenar dentro
// do próprio grupo (datada com datada, perene com perene) em `distribuirVagas`.
// Régua larga dá ilusão de precisão e produz empate na mesma frequência.
export const PESO_MIN = 1
export const PESO_MAX = 3

/**
 * `dominio` é chave de junção por igualdade EXATA de string: `selectAgenda` faz
 * `dominios.has(a.dominio)` contra o que está gravado no DNA da marca. "Saúde" e
 * "saude" são dois domínios diferentes para o Set — a marca assina um, a linha
 * mora no outro, e o resultado é agenda vazia sem uma única mensagem de erro.
 * Por isso a normalização é obrigatória na escrita, e não uma sugestão da tela.
 */
export function normalizarDominio(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * 'YYYY-MM-DD' exato, e a data tem que EXISTIR.
 *
 * As duas coisas importam pelo mesmo motivo: o planner compara janela com
 * `now.toISOString().slice(0,10)` como STRING. '2026-8-5' não quebra nada — só
 * passa a ser maior que '2026-08-03' na ordem lexicográfica, e a linha fica
 * vigente no ano errado, calada.
 *
 * O round-trip sozinho basta, e havia um regex de formato antes daqui que o
 * mutation testing mostrou ser redundante: `toISOString()` só emite mês e dia com
 * zero à esquerda, então qualquer grafia frouxa já falha nesta comparação. De
 * quebra, ele pega o que o regex NÃO pegava — 2026-02-31 casa com o formato e
 * não existe; o JS normaliza para 2026-03-03 e a string deixa de bater.
 */
function dataValida(v: string): boolean {
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

function limpar(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  return t ? t : null
}

export function normalizarLinha(e: EntradaLinha): Validacao {
  const dominio = normalizarDominio(e.dominio ?? '')
  if (!dominio) return { ok: false, erro: 'Informe o domínio (ex.: saude, agro, clima).' }

  const titulo = (e.titulo ?? '').trim()
  if (!titulo) {
    // Não é enfeite: `porPeso` desempata por `localeCompare(titulo)`, e o título
    // é o que identifica a linha no log do diagnóstico. Sem ele o desempate vira
    // cara-ou-coroa de novo e o log fica ilegível.
    return { ok: false, erro: 'Informe o título da linha.' }
  }

  // Termo com 1 caractere vira query de raspagem que traz o mundo inteiro; termo
  // vazio vira lane com query em branco. Os dois custam o mesmo que um termo bom.
  const termos = Array.from(
    new Set((e.termos ?? []).map(t => t.trim()).filter(t => t.length >= 2))
  )
  if (!termos.length) {
    return { ok: false, erro: 'Informe ao menos um termo com 2+ caracteres.' }
  }

  const janela_inicio = limpar(e.janela_inicio)
  const janela_fim = limpar(e.janela_fim)
  for (const [rotulo, v] of [['início', janela_inicio], ['fim', janela_fim]] as const) {
    if (v && !dataValida(v)) {
      return { ok: false, erro: `Data de ${rotulo} inválida — use AAAA-MM-DD.` }
    }
  }
  if (janela_inicio && janela_fim && janela_inicio > janela_fim) {
    // Janela invertida passa em todos os outros filtros e nunca é vigente:
    // `inicio <= today && fim >= today` é insatisfazível. Linha morta e ativa.
    return { ok: false, erro: 'A janela termina antes de começar.' }
  }

  const peso = Math.round(Number(e.peso))
  if (!Number.isFinite(peso) || peso < PESO_MIN || peso > PESO_MAX) {
    return { ok: false, erro: `Peso precisa ser um inteiro entre ${PESO_MIN} e ${PESO_MAX}.` }
  }

  // '' e null se comportam igual em `selectAgenda` (`!a.pais`), mas só null entra
  // no índice parcial e só null LÊ como "universal" para quem abrir a tabela.
  const paisBruto = limpar(e.pais)
  const pais = paisBruto ? paisBruto.toUpperCase() : null
  if (pais && !/^[A-Z]{2}$/.test(pais)) {
    return { ok: false, erro: 'País precisa ser ISO-2 (BR, AU, US) ou vazio para universal.' }
  }

  return {
    ok: true,
    linha: {
      dominio,
      titulo,
      termos,
      janela_inicio,
      janela_fim,
      peso,
      ativo: Boolean(e.ativo),
      pais,
      tenant_id: limpar(e.tenant_id),
    },
  }
}

/**
 * Em que ponto da vida a linha está HOJE.
 *
 * `ativo` é intenção; isto é efeito. Uma linha do Oscar 2026 com `ativo = true`
 * em agosto não está errada nem ligada — está `encerrada`, e a tela precisa
 * dizer isso, senão a lista de "25 linhas ativas" mente sobre quantas rodam.
 */
export type EstadoLinha = 'desligada' | 'futura' | 'encerrada' | 'vigente'

export function estadoDaLinha(
  a: Pick<PulsoCultural, 'ativo' | 'janela_inicio' | 'janela_fim'>,
  now: Date = new Date()
): EstadoLinha {
  if (!a.ativo) return 'desligada'
  const hoje = now.toISOString().slice(0, 10)
  if (a.janela_inicio && a.janela_inicio > hoje) return 'futura'
  if (a.janela_fim && a.janela_fim < hoje) return 'encerrada'
  return 'vigente'
}

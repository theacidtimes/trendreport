import type { MarcaKnowledge } from './types'

// Como o DNA de uma marca sobrevive a um save da tela.
//
// O `updateMarca` montava `yaml_conhecimento` DO ZERO a cada save, copiando campo
// a campo os que o formulário conhece. O efeito: todo campo que existe no DNA mas
// não está na tela — `dominios_culturais`, `peso_cultural`, `termos_linkedin`,
// `idioma` — era apagado por quem só quis corrigir uma vírgula no "tom".
//
// A gravidade não é o apagão em si, é a DIREÇÃO da falha: o formato falhava para
// o lado inseguro. Campo novo no DNA nascia sendo destruído, e destruído em
// silêncio — nenhum erro, nenhum log, e a marca continuava rodando (só que sem
// agenda). Foi assim que o `peso_cultural` da Vivo podia sumir a qualquer save.
//
// Aqui a direção se inverte: parte-se do que ESTÁ gravado e sobrepõe-se só o que
// a tela realmente mandou. Campo novo passa a ser preservado por padrão, e para
// apagá-lo é preciso pedir explicitamente.

// `undefined` = "a tela não falou sobre isto, mantenha". Distinto de `[]`/`''`,
// que são "a tela falou e o valor é vazio". A diferença é o que separa "o form
// não tem esse campo" de "o usuário limpou esse campo".
export type PatchDNA = Partial<MarcaKnowledge>

export function mesclarDNA(atual: MarcaKnowledge | undefined | null, patch: PatchDNA): MarcaKnowledge {
  const base = (atual ?? {}) as MarcaKnowledge
  const out = { ...base } as unknown as Record<string, unknown>
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) out[k] = v
  }
  return out as unknown as MarcaKnowledge
}

// Os campos que a derivação de perfil cultural LÊ. Mudou algum, a conclusão pode
// ter mudado junto; não mudou nenhum, re-derivar é pagar Haiku para receber a
// mesma resposta — e, pior, para sobrescrever um ajuste manual sem motivo.
const ENTRADAS_DA_DERIVACAO: (keyof MarcaKnowledge)[] = [
  'marca',
  'produto',
  'perfil_comportamental',
  'universos_culturais',
  'ambicao_de_marca',
  'o_que_evitar',
  'pais'
]

function mesmoValor(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const x = Array.isArray(a) ? a : []
    const y = Array.isArray(b) ? b : []
    return x.length === y.length && x.every((v, i) => v === y[i])
  }
  return (a ?? '') === (b ?? '')
}

/**
 * Quando re-rodar a derivação no save.
 *
 * Três respostas, e a ordem importa:
 *
 * 1. Se o save traz `dominios_culturais` ou `peso_cultural` explícitos, o humano
 *    decidiu — não deriva. A derivação é um chute bom, não uma autoridade; quem
 *    olhou a marca e discordou tem a palavra final, e sobrescrever isso faria a
 *    tela parecer quebrada ("editei, salvei, voltou").
 * 2. Se a marca ainda não tem perfil nenhum, deriva. É o caso que motivou tudo:
 *    marca criada pela tela nascia sem agenda e ninguém era avisado.
 * 3. Caso contrário, só deriva se o DNA que alimenta a decisão mudou.
 */
export function precisaDerivar(atual: MarcaKnowledge | undefined | null, patch: PatchDNA): boolean {
  if (patch.dominios_culturais !== undefined || patch.peso_cultural !== undefined) return false
  const base = (atual ?? {}) as MarcaKnowledge
  if (base.peso_cultural == null && !(base.dominios_culturais?.length)) return true
  return ENTRADAS_DA_DERIVACAO.some(campo => {
    if (patch[campo] === undefined) return false
    return !mesmoValor(base[campo], patch[campo])
  })
}

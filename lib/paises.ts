/**
 * Países com calendário próprio na agenda cultural.
 *
 * Curto de propósito: cada país aqui implica linhas de `pulso_cultural` naquele
 * calendário. Hoje só BR tem acervo — os outros existem para a marca sair com
 * agenda VAZIA e visível em vez de cair no calendário brasileiro por omissão.
 *
 * Módulo separado (e sem dependência) porque as duas telas que oferecem país —
 * o DNA da marca e a linha da agenda — precisam oferecer o MESMO conjunto. Se a
 * marca pudesse ser 'AU' e a linha não, o país da marca viraria um filtro que
 * zera tudo; se a linha pudesse ser 'CA' e a marca não, a linha nunca casaria.
 * Nos dois casos, silêncio.
 */
export const PAISES = ['BR', 'AU', 'US', 'PT', 'ES', 'MX', 'AR'] as const

export type Pais = (typeof PAISES)[number]

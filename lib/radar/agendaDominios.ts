import { createClient } from '@/lib/supabase/server'

/**
 * Vocabulário REAL de domínios da agenda, lido do banco.
 *
 * Nunca uma lista fixa no código, por dois motivos que puxam na mesma direção:
 * um domínio novo em `pulso_cultural` fica disponível para todas as marcas sem
 * deploy, e nem a derivação nem a tela conseguem oferecer um domínio que não
 * existe. Domínio inventado passaria no JSONB sem reclamar e seria filtrado a
 * zero no `selectAgenda` — config que MENTE: a tela mostra um domínio assinado
 * que nunca casa com linha nenhuma.
 */
export async function dominiosDaAgenda(pais?: string): Promise<string[]> {
  const supabase = createClient()
  const { data } = await supabase.from('pulso_cultural').select('dominio, pais').eq('ativo', true)
  const linhas = (data ?? []) as { dominio: string; pais: string | null }[]
  // Filtrado pelo país da marca porque um domínio sem linha NAQUELE calendário é
  // uma opção falsa. MEDIDO na derivação real (02/08/2026): a Harts (AU) assinou
  // `economia, entretenimento, musica` e pediu 2 vagas — e o acervo é 100% BR,
  // então `selectAgenda` devolveria ZERO linhas. Sem este filtro a marca sai da
  // tela parecendo configurada, com custo reservado, e nunca raspa nada.
  // Oferecer só o que existe faz a derivação concluir "não assino" — que é a
  // resposta verdadeira, e a que aparece no log como `nao_assina`.
  const doPais = pais
    ? linhas.filter(r => !r.pais || r.pais.toUpperCase() === pais.toUpperCase())
    : linhas
  return Array.from(new Set(doPais.map(r => r.dominio))).sort()
}

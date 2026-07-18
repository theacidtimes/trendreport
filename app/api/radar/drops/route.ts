import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  // Paginação do infinite feed: janela [offset, offset+limit). Busca limit+1 itens
  // pra saber se há próxima página sem uma query de count separada.
  const limit  = Math.min(Math.max(Number(searchParams.get('limit')) || 12, 1), 50)
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0)

  let query = supabase
    .from('trends_radar')
    .select('*, marca:marcas(nome)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit)

  const marca_id = searchParams.get('marca_id')
  const status   = searchParams.get('status')
  const funil    = searchParams.get('funil')
  const desde    = searchParams.get('desde')
  const ate      = searchParams.get('ate')

  if (marca_id) query = query.eq('marca_id', marca_id)
  if (status)   query = query.eq('status_hype', status)
  if (funil)    query = query.eq('categoria_funil', funil)
  if (desde)    query = query.gte('created_at', desde)
  if (ate)      query = query.lte('created_at', ate)

  const { data, error } = await query
  if (error) return NextResponse.json({ error }, { status: 500 })

  const rows = data ?? []
  const hasMore = rows.length > limit
  return NextResponse.json({ drops: hasMore ? rows.slice(0, limit) : rows, hasMore })
}

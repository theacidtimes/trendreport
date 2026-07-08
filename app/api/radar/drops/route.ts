import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  let query = supabase
    .from('trends_radar')
    .select('*, marca:marcas(nome)')
    .order('created_at', { ascending: false })
    .limit(50)

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
  return NextResponse.json({ drops: data })
}

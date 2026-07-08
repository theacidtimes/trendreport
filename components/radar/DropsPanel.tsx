'use client'
import { useEffect, useState } from 'react'
import { TrendDrop, Marca } from '@/lib/types'
import DropCard from './DropCard'

type Periodo = '' | 'semana' | 'mes' | 'custom'

// Início do intervalo em ISO, a partir do preset. 'custom' usa os inputs de data.
function desdeISO(periodo: Periodo, customDe: string): string {
  const now = Date.now()
  if (periodo === 'semana') return new Date(now - 7 * 864e5).toISOString()
  if (periodo === 'mes')    return new Date(now - 30 * 864e5).toISOString()
  if (periodo === 'custom' && customDe) return new Date(customDe).toISOString()
  return ''
}

export default function DropsPanel({ marcas = [], marcaId }: { marcas?: Marca[]; marcaId?: string }) {
  const [drops, setDrops] = useState<TrendDrop[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroFunil, setFiltroFunil] = useState('')
  const [filtroMarca, setFiltroMarca] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('')
  const [customDe, setCustomDe] = useState('')
  const [customAte, setCustomAte] = useState('')

  const marcaAtiva = marcaId || filtroMarca

  useEffect(() => {
    const params = new URLSearchParams()
    if (marcaAtiva)   params.set('marca_id', marcaAtiva)
    if (filtroStatus) params.set('status', filtroStatus)
    if (filtroFunil)  params.set('funil', filtroFunil)
    const desde = desdeISO(periodo, customDe)
    if (desde) params.set('desde', desde)
    if (periodo === 'custom' && customAte) params.set('ate', new Date(customAte).toISOString())

    setLoading(true)
    fetch(`/api/radar/drops?${params}`)
      .then(r => r.json())
      .then(d => { setDrops(d.drops || []); setLoading(false) })
  }, [marcaAtiva, filtroStatus, filtroFunil, periodo, customDe, customAte])

  const filterBtn = (label: string, value: string, current: string, setter: (v: string) => void) => (
    <button
      onClick={() => setter(current === value ? '' : value)}
      style={{
        fontSize: 11, fontWeight: 500, letterSpacing: '0.06em',
        padding: '4px 12px', borderRadius: 20, border: '0.5px solid',
        cursor: 'pointer',
        background: current === value ? '#660099' : 'transparent',
        color: current === value ? '#fff' : '#9B8FAA',
        borderColor: current === value ? '#660099' : '#1E0029'
      }}
    >
      {label}
    </button>
  )

  const dateInput = (value: string, setter: (v: string) => void, label: string) => (
    <input
      type="date" aria-label={label} value={value}
      onChange={e => setter(e.target.value)}
      style={{
        fontSize: 11, padding: '3px 8px', borderRadius: 8,
        background: '#0F0015', color: '#C9BCD8',
        border: '0.5px solid #1E0029', colorScheme: 'dark'
      }}
    />
  )

  return (
    <div>
      {/* Filtro por cliente */}
      {!marcaId && marcas.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {filterBtn('TODOS', '', filtroMarca, setFiltroMarca)}
          {marcas.map(m => filterBtn(m.nome.toUpperCase(), m.id, filtroMarca, setFiltroMarca))}
        </div>
      )}

      {/* Filtro por período */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {filterBtn('SEMANA', 'semana', periodo, v => setPeriodo(v as Periodo))}
        {filterBtn('MÊS', 'mes', periodo, v => setPeriodo(v as Periodo))}
        {filterBtn('PERÍODO', 'custom', periodo, v => setPeriodo(v as Periodo))}
        {periodo === 'custom' && (
          <>
            {dateInput(customDe, setCustomDe, 'Data inicial')}
            <span style={{ color: '#555', fontSize: 11 }}>até</span>
            {dateInput(customAte, setCustomAte, 'Data final')}
          </>
        )}
      </div>

      {/* Filtro por status/funil */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {filterBtn('EM ALTA', 'em_alta', filtroStatus, setFiltroStatus)}
        {filterBtn('SUBINDO', 'subindo', filtroStatus, setFiltroStatus)}
        {filterBtn('ESTABILIZANDO', 'estabilizando', filtroStatus, setFiltroStatus)}
        <div style={{ width: 1, background: '#1E0029', margin: '0 4px' }} />
        {filterBtn('GROWTH', 'growth', filtroFunil, setFiltroFunil)}
        {filterBtn('BASE', 'base', filtroFunil, setFiltroFunil)}
      </div>

      {loading && <p style={{ color: '#555', fontSize: 14 }}>carregando drops...</p>}
      {!loading && drops.length === 0 && (
        <p style={{ color: '#555', fontSize: 14 }}>nenhum drop encontrado. ative uma marca e aguarde a próxima varredura.</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {drops.map(drop => <DropCard key={drop.id} drop={drop} />)}
      </div>
    </div>
  )
}

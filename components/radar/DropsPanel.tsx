'use client'
import { useEffect, useState } from 'react'
import { TrendDrop } from '@/lib/types'
import DropCard from './DropCard'

export default function DropsPanel({ marcaId }: { marcaId?: string }) {
  const [drops, setDrops] = useState<TrendDrop[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroFunil, setFiltroFunil] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (marcaId)     params.set('marca_id', marcaId)
    if (filtroStatus) params.set('status', filtroStatus)
    if (filtroFunil)  params.set('funil', filtroFunil)

    fetch(`/api/radar/drops?${params}`)
      .then(r => r.json())
      .then(d => { setDrops(d.drops || []); setLoading(false) })
  }, [marcaId, filtroStatus, filtroFunil])

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

  return (
    <div>
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

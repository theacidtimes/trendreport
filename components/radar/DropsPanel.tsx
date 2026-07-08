'use client'
import { useEffect, useCallback, useRef, useState } from 'react'
import { TrendDrop, Marca } from '@/lib/types'
import DropCard from './DropCard'

// Ritmo do auto-refresh silencioso. O cron gera drops a cada ~15min; 60s pega os novos
// logo depois de salvos sem martelar a API.
const POLL_MS = 60_000

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

  // silent=true no auto-refresh: atualiza a lista sem acender o loader (evita piscar).
  const fetchDrops = useCallback(async (silent = false) => {
    const params = new URLSearchParams()
    if (marcaAtiva)   params.set('marca_id', marcaAtiva)
    if (filtroStatus) params.set('status', filtroStatus)
    if (filtroFunil)  params.set('funil', filtroFunil)
    const desde = desdeISO(periodo, customDe)
    if (desde) params.set('desde', desde)
    if (periodo === 'custom' && customAte) params.set('ate', new Date(customAte).toISOString())

    if (!silent) setLoading(true)
    try {
      const d = await fetch(`/api/radar/drops?${params}`).then(r => r.json())
      setDrops(d.drops || [])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [marcaAtiva, filtroStatus, filtroFunil, periodo, customDe, customAte])

  // Carga a cada mudança de filtro (com loader).
  useEffect(() => { fetchDrops(false) }, [fetchDrops])

  // Auto-refresh silencioso enquanto a aba está visível. Ref evita recriar o intervalo a
  // cada mudança de filtro sem perder o filtro atual no tick.
  const fetchRef = useRef(fetchDrops)
  fetchRef.current = fetchDrops
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') fetchRef.current(true)
    }
    const id = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [])

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
      {/* Loader fino: barra deslizante sutil enquanto os drops carregam. */}
      <div style={{ height: 2, marginBottom: 14, borderRadius: 2, overflow: 'hidden', background: loading ? 'rgba(129,211,0,0.08)' : 'transparent' }}>
        {loading && <div className="drops-loader-bar" />}
      </div>
      <style>{`
        .drops-loader-bar {
          position: relative; height: 100%; width: 35%; border-radius: 2px;
          background: linear-gradient(90deg, transparent, #81D300, transparent);
          animation: dropsSlide 1.1s ease-in-out infinite;
        }
        @keyframes dropsSlide { 0% { left: -35%; } 100% { left: 100%; } }
      `}</style>

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

      {!loading && drops.length === 0 && (
        <p style={{ color: '#555', fontSize: 14 }}>nenhum drop encontrado. ative uma marca e aguarde a próxima varredura.</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {drops.map(drop => <DropCard key={drop.id} drop={drop} />)}
      </div>
    </div>
  )
}

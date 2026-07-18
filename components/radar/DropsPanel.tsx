'use client'
import { useEffect, useCallback, useRef, useState } from 'react'
import { TrendDrop, Marca } from '@/lib/types'
import DropCard from './DropCard'

// Ritmo do auto-refresh silencioso. O cron gera drops a cada ~15min; 60s pega os novos
// logo depois de salvos sem martelar a API.
const POLL_MS = 60_000
// Tamanho da página do infinite feed. Carrega em blocos e vai anexando no scroll.
const PAGE_SIZE = 12

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
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroFunil, setFiltroFunil] = useState('')
  const [filtroMarca, setFiltroMarca] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('')
  const [customDe, setCustomDe] = useState('')
  const [customAte, setCustomAte] = useState('')

  const marcaAtiva = marcaId || filtroMarca

  // Monta os params de filtro; paginação (offset/limit) entra por cima em cada chamada.
  const buildParams = useCallback((offset: number, limit: number) => {
    const params = new URLSearchParams()
    if (marcaAtiva)   params.set('marca_id', marcaAtiva)
    if (filtroStatus) params.set('status', filtroStatus)
    if (filtroFunil)  params.set('funil', filtroFunil)
    const desde = desdeISO(periodo, customDe)
    if (desde) params.set('desde', desde)
    if (periodo === 'custom' && customAte) params.set('ate', new Date(customAte).toISOString())
    params.set('offset', String(offset))
    params.set('limit', String(limit))
    return params
  }, [marcaAtiva, filtroStatus, filtroFunil, periodo, customDe, customAte])

  // Página inicial: troca a lista inteira (com loader). Dispara a cada mudança de filtro.
  const loadFirst = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/radar/drops?${buildParams(0, PAGE_SIZE)}`).then(r => r.json())
      setDrops(d.drops || [])
      setHasMore(!!d.hasMore)
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { loadFirst() }, [loadFirst])

  // Próxima página: anexa ao fim, deduplicando por id. O offset é o tamanho atual.
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const d = await fetch(`/api/radar/drops?${buildParams(drops.length, PAGE_SIZE)}`).then(r => r.json())
      setDrops(prev => {
        const vistos = new Set(prev.map(x => x.id))
        const novos = ((d.drops || []) as TrendDrop[]).filter(x => !vistos.has(x.id))
        return [...prev, ...novos]
      })
      setHasMore(!!d.hasMore)
    } finally {
      setLoadingMore(false)
    }
  }, [buildParams, drops.length, loading, loadingMore, hasMore])

  // Auto-refresh silencioso: só o topo. Atualiza status dos drops já vistos e prepende os
  // novos, sem descartar o que o usuário já scrollou. Ordena por created_at desc.
  const refreshHead = useCallback(async () => {
    const d = await fetch(`/api/radar/drops?${buildParams(0, PAGE_SIZE)}`).then(r => r.json())
    const fresh = (d.drops || []) as TrendDrop[]
    setDrops(prev => {
      if (prev.length === 0) return fresh
      const porId = new Map(prev.map(x => [x.id, x]))
      for (const f of fresh) porId.set(f.id, f)
      return Array.from(porId.values()).sort((a, b) => b.created_at.localeCompare(a.created_at))
    })
  }, [buildParams])

  // Refs evitam recriar interval/observer a cada mudança de filtro sem perder o estado atual.
  const refreshRef = useRef(refreshHead)
  refreshRef.current = refreshHead
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') refreshRef.current()
    }
    const id = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [])

  // Sentinela do infinite scroll: quando entra na viewport (com folga de 400px), puxa a
  // próxima página. rootMargin adianta a carga antes do usuário bater no fim.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) loadMoreRef.current() },
      { rootMargin: '400px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const filterBtn = (label: string, value: string, current: string, setter: (v: string) => void) => (
    <button
      onClick={() => setter(current === value ? '' : value)}
      style={{
        fontSize: 11, fontWeight: 500, letterSpacing: '0.06em',
        padding: '4px 12px', borderRadius: 20, border: '1px solid',
        cursor: 'pointer',
        background: current === value ? '#181818' : 'transparent',
        color: current === value ? '#f5f3ef' : '#a8a29e',
        borderColor: current === value ? '#3a3a3a' : '#232323'
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
        background: '#121212', color: '#f5f3ef',
        border: '1px solid #232323', colorScheme: 'dark'
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
            <span style={{ color: '#6e6a66', fontSize: 11 }}>até</span>
            {dateInput(customAte, setCustomAte, 'Data final')}
          </>
        )}
      </div>

      {/* Filtro por status/funil */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {filterBtn('EM ALTA', 'em_alta', filtroStatus, setFiltroStatus)}
        {filterBtn('SUBINDO', 'subindo', filtroStatus, setFiltroStatus)}
        {filterBtn('ESTABILIZANDO', 'estabilizando', filtroStatus, setFiltroStatus)}
        <div style={{ width: 1, background: '#232323', margin: '0 4px' }} />
        {filterBtn('GROWTH', 'growth', filtroFunil, setFiltroFunil)}
        {filterBtn('BASE', 'base', filtroFunil, setFiltroFunil)}
      </div>

      {!loading && drops.length === 0 && (
        <p style={{ color: '#6e6a66', fontSize: 14 }}>nenhum drop encontrado. ative uma marca e aguarde a próxima varredura.</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {drops.map(drop => <DropCard key={drop.id} drop={drop} />)}
      </div>

      {/* Sentinela sempre montada pra o observer poder rastreá-la desde o início. */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {loadingMore && (
        <p style={{ textAlign: 'center', color: '#6e6a66', fontSize: 12, marginTop: 20 }}>carregando mais…</p>
      )}
      {!loading && !hasMore && drops.length > 0 && (
        <p style={{ textAlign: 'center', color: '#6e6a66', fontSize: 12, marginTop: 20 }}>fim dos drops.</p>
      )}
    </div>
  )
}

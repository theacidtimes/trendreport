'use client'
import { useMemo, useState } from 'react'
import { TrendDrop } from '@/lib/types'
import DropCard from './DropCard'

type Periodo = '' | 'semana' | 'mes'

// Início do intervalo em ms a partir do preset. Diferente do DropsPanel autenticado, aqui
// a filtragem é em memória (a página pública já recebe todos os drops da marca), então não
// há fetch nem período custom — só os presets que o time de planejamento usa no dia a dia.
function desdeMs(periodo: Periodo): number {
  const now = Date.now()
  if (periodo === 'semana') return now - 7 * 864e5
  if (periodo === 'mes') return now - 30 * 864e5
  return 0
}

type Ordem = 'hype' | 'recentes'

export default function PublicDropsPanel({ drops }: { drops: TrendDrop[] }) {
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroFunil, setFiltroFunil] = useState('')
  const [periodo, setPeriodo] = useState<Periodo>('')
  // Padrão = hype: quem recebe o link vê primeiro o que está mais quente, não o
  // mais recente. "Recentes" fica como opção pra quem quer acompanhar o fluxo.
  const [ordem, setOrdem] = useState<Ordem>('hype')

  const filtered = useMemo(() => {
    const desde = desdeMs(periodo)
    const list = drops.filter(
      d =>
        (!filtroStatus || d.status_hype === filtroStatus) &&
        (!filtroFunil || d.categoria_funil === filtroFunil) &&
        (!desde || new Date(d.created_at).getTime() >= desde)
    )
    const sorted = [...list]
    if (ordem === 'hype') sorted.sort((a, b) => b.indice_hype - a.indice_hype)
    else sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    return sorted
  }, [drops, filtroStatus, filtroFunil, periodo, ordem])

  const filterBtn = (
    label: string,
    value: string,
    current: string,
    setter: (v: string) => void
  ) => (
    <button
      onClick={() => setter(current === value ? '' : value)}
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.06em',
        padding: '4px 12px',
        borderRadius: 20,
        border: '0.5px solid',
        cursor: 'pointer',
        background: current === value ? '#660099' : 'transparent',
        color: current === value ? '#fff' : '#9B8FAA',
        borderColor: current === value ? '#660099' : '#1E0029',
      }}
    >
      {label}
    </button>
  )

  // Igual ao filterBtn mas sempre mantém uma opção ativa (ordenação não desliga).
  const ordemBtn = (label: string, value: Ordem) => (
    <button
      onClick={() => setOrdem(value)}
      style={{
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.06em',
        padding: '4px 12px',
        borderRadius: 20,
        border: '0.5px solid',
        cursor: 'pointer',
        background: ordem === value ? '#241033' : 'transparent',
        color: ordem === value ? '#fff' : '#9B8FAA',
        borderColor: ordem === value ? '#3A1A52' : '#1E0029',
      }}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        {filterBtn('SEMANA', 'semana', periodo, v => setPeriodo(v as Periodo))}
        {filterBtn('MÊS', 'mes', periodo, v => setPeriodo(v as Periodo))}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'center' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.08em', color: '#7A6A8A' }}>ORDENAR</span>
          {ordemBtn('MAIS QUENTES', 'hype')}
          {ordemBtn('RECENTES', 'recentes')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {filterBtn('EM ALTA', 'em_alta', filtroStatus, setFiltroStatus)}
        {filterBtn('SUBINDO', 'subindo', filtroStatus, setFiltroStatus)}
        {filterBtn('ESTABILIZANDO', 'estabilizando', filtroStatus, setFiltroStatus)}
        <div style={{ width: 1, background: '#1E0029', margin: '0 4px' }} />
        {filterBtn('GROWTH', 'growth', filtroFunil, setFiltroFunil)}
        {filterBtn('BASE', 'base', filtroFunil, setFiltroFunil)}
      </div>

      {filtered.length === 0 && (
        <p style={{ color: '#555', fontSize: 14 }}>nenhum drop para esse filtro.</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {filtered.map(drop => (
          <DropCard key={drop.id} drop={drop} />
        ))}
      </div>
    </div>
  )
}

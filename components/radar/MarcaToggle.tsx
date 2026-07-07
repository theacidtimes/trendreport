'use client'
import { useState } from 'react'
import { Marca } from '@/lib/types'

export default function MarcaToggle({ marca, onToggle }: {
  marca: Marca
  onToggle: (id: string, status: boolean) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(marca.status_varredura)

  async function handleToggle() {
    setLoading(true)
    const next = !active
    setActive(next)
    await onToggle(marca.id, next)
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0F0015', border: '0.5px solid #1E0029', borderRadius: 12, padding: '0.875rem 1rem' }}>
      <div>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#fff' }}>{marca.nome}</div>
        <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
          {marca.ultima_varredura
            ? `última varredura: ${new Date(marca.ultima_varredura).toLocaleString('pt-BR')}`
            : 'nunca varrida'}
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: active ? '#81D300' : '#1E0029',
          position: 'relative', transition: 'background 0.2s'
        }}
      >
        <span style={{
          position: 'absolute', top: 2, left: active ? 22 : 2,
          width: 20, height: 20, borderRadius: 10,
          background: active ? '#1a1a1a' : '#555',
          transition: 'left 0.2s'
        }} />
      </button>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { toggleMarca } from '@/app/dashboard/radar/actions'
import { Marca } from '@/lib/types'

// Toggle compacto pro bento de cada cliente na página admin. Vive DENTRO de um <Link>,
// então preventDefault + stopPropagation evitam que o clique navegue pro detalhe.
export default function ClienteToggle({ marca }: { marca: Marca }) {
  const [active, setActive] = useState(marca.status_varredura)
  const [loading, setLoading] = useState(false)

  async function handle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    const next = !active
    setActive(next)
    try {
      await toggleMarca(marca.id, next)
    } catch {
      setActive(!next)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handle}
      disabled={loading}
      role="switch"
      aria-checked={active}
      aria-label={active ? `Desativar captura de ${marca.nome}` : `Ativar captura de ${marca.nome}`}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-wait cursor-pointer ${
        active
          ? 'bg-lime shadow-[0_0_0_1px_rgba(129,211,0,0.45),0_6px_16px_-6px_rgba(129,211,0,0.55)]'
          : 'bg-surface-2 border border-border hover:border-lime/50'
      }`}
    >
      <span
        className={`absolute top-1 left-1 w-4 h-4 rounded-full transition-all duration-200 ${
          active ? 'translate-x-5 bg-black' : 'bg-muted'
        }`}
      />
    </button>
  )
}

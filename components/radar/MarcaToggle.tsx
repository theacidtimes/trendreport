'use client'
import { useState } from 'react'
import { Marca } from '@/lib/types'

export default function MarcaToggle({ marca, onToggle }: {
  marca: Marca
  onToggle: (id: string, status: boolean) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(marca.status_varredura)

  const cadencia = `a cada ${marca.intervalo_horas}h`
  const proxima = marca.ultima_varredura
    ? new Date(
        new Date(marca.ultima_varredura).getTime() +
          marca.intervalo_horas * 3_600_000
      )
    : null
  const proximaLabel = !proxima
    ? 'na próxima varredura'
    : proxima.getTime() <= Date.now()
      ? 'na próxima varredura (vencida)'
      : proxima.toLocaleString('pt-BR')

  async function handleToggle() {
    if (loading) return
    setLoading(true)
    const next = !active
    setActive(next)
    try {
      await onToggle(marca.id, next)
    } catch {
      setActive(!next) // reverte se a persistência falhar
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="group flex items-center justify-between gap-4 rounded-xl bg-surface border border-border px-4 py-3.5 transition-colors hover:border-lime/30">
      <div className="min-w-0">
        <div className="text-white text-[15px] font-medium truncate">{marca.nome}</div>
        <div className="text-muted text-xs mt-0.5">
          {marca.ultima_varredura
            ? `última: ${new Date(marca.ultima_varredura).toLocaleString('pt-BR')}`
            : 'nunca varrida'}
          {' · '}
          {cadencia}
        </div>
        {active && (
          <div className="text-muted/70 text-xs mt-0.5">
            próxima: {proximaLabel}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        role="switch"
        aria-checked={active}
        aria-label={active ? `Desativar varredura de ${marca.nome}` : `Ativar varredura de ${marca.nome}`}
        className={`relative shrink-0 w-12 h-7 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-wait cursor-pointer ${
          active
            ? 'bg-lime shadow-[0_0_0_1px_rgba(129,211,0,0.45),0_6px_16px_-6px_rgba(129,211,0,0.55)]'
            : 'bg-surface-2 border border-border hover:border-lime/50'
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-5 h-5 rounded-full transition-all duration-200 group-hover:scale-110 ${
            active
              ? 'translate-x-5 bg-black'
              : 'bg-muted group-hover:bg-white'
          }`}
        />
      </button>
    </div>
  )
}

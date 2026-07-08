'use client'
import { useEffect, useState } from 'react'
import { CircleCheck } from 'lucide-react'
import { Marca } from '@/lib/types'

// O cron bate de hora em hora (minuto 0). A próxima run de uma marca é o
// primeiro minuto-zero DEPOIS dela vencer o intervalo — ou o próximo, se já
// estiver vencida. Isso reflete a janela real, não só ultima+intervalo.
function nextHourlyTick(fromMs: number): Date {
  const d = new Date(fromMs)
  d.setMinutes(0, 0, 0)
  if (d.getTime() <= fromMs) d.setHours(d.getHours() + 1)
  return d
}

function proximaVarredura(marca: Marca): Date {
  const now = Date.now()
  const due = marca.ultima_varredura
    ? new Date(marca.ultima_varredura).getTime() +
      marca.intervalo_horas * 3_600_000
    : now
  return nextHourlyTick(Math.max(due, now))
}

export default function MarcaToggle({ marca, onToggle }: {
  marca: Marca
  onToggle: (id: string, status: boolean) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(marca.status_varredura)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 9000)
    return () => clearTimeout(t)
  }, [aviso])

  const cadencia = `a cada ${marca.intervalo_horas}h`
  const proximaLabel = proximaVarredura(marca).toLocaleString('pt-BR')

  async function handleToggle() {
    if (loading) return
    setLoading(true)
    const next = !active
    setActive(next)
    try {
      await onToggle(marca.id, next)
      setAviso(
        next
          ? `Agente ligado. Próxima varredura prevista para ${proximaVarredura(marca).toLocaleString('pt-BR')}.`
          : 'Agente desligado. As varreduras foram pausadas.'
      )
    } catch {
      setActive(!next) // reverte se a persistência falhar
      setAviso(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-0 rounded-xl bg-surface border border-border overflow-hidden transition-colors hover:border-lime/30">
      <div className="group flex items-center justify-between gap-4 px-4 py-3.5">
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

      {aviso && (
        <div
          role="status"
          className={`flex items-center gap-2 px-4 py-2.5 text-xs border-t ${
            active
              ? 'bg-lime/10 border-lime/25 text-lime'
              : 'bg-surface-2 border-border text-muted'
          }`}
        >
          <CircleCheck className="w-3.5 h-3.5 shrink-0" strokeWidth={2.2} />
          {aviso}
        </div>
      )}
    </div>
  )
}

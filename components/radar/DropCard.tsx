'use client'
import { TrendDrop } from '@/lib/types'

const STATUS_CONFIG = {
  em_alta:       { bg: '#81D300', color: '#1a1a1a', label: 'EM ALTA' },
  subindo:       { bg: '#660099', color: '#fff',    label: 'SUBINDO' },
  estabilizando: { bg: 'transparent', color: '#9B8FAA', label: 'ESTABILIZANDO', border: '0.5px solid #9B8FAA' },
  esfriando:     { bg: 'transparent', color: '#555',    label: 'ESFRIANDO',     border: '0.5px solid #333' },
}

const FUNIL_CONFIG = {
  growth: { color: '#81D300', label: '↗ GROWTH' },
  base:   { color: '#9B8FAA', label: '→ BASE' },
}

export default function DropCard({ drop }: { drop: TrendDrop }) {
  const s = STATUS_CONFIG[drop.status_hype]
  const f = FUNIL_CONFIG[drop.categoria_funil]

  return (
    <div style={{ background: '#0F0015', border: '0.5px solid #1E0029', borderRadius: 16, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, border: 'border' in s ? s.border : undefined }}>
          {s.label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 500, color: f.color, letterSpacing: '0.06em' }}>{f.label}</span>
        <span style={{ fontSize: 11, color: '#555', marginLeft: 'auto' }}>HYPE {drop.indice_hype}/100</span>
      </div>

      <div style={{ fontSize: 18, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{drop.insight_titulo}</div>

      <p style={{ fontSize: 14, color: '#9B8FAA', margin: 0, lineHeight: 1.5 }}>{drop.descricao_fato}</p>

      <div style={{ borderLeft: '2px solid #81D300', paddingLeft: 12, fontSize: 14, color: '#81D300', fontStyle: 'italic', lineHeight: 1.4 }}>
        {drop.gancho_produto}
      </div>

      <div style={{ background: '#660099', borderRadius: 10, padding: '0.875rem', fontSize: 13, color: '#fff', lineHeight: 1.5 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.08em', opacity: 0.7, display: 'block', marginBottom: 4 }}>IDEIA CCCARAMELO</span>
        {drop.insight_criativo_cccaramelo}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { label: 'DENSIDADE', value: drop.score_densidade },
          { label: 'TRANSBORDO', value: drop.score_transbordo },
          { label: 'VELOCIDADE', value: drop.score_velocidade },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: '#7A6A8A', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
            <div style={{ height: 6, borderRadius: 3, background: '#241033', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${value}%`, background: 'linear-gradient(90deg, #660099, #81D300)', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 11, color: '#C9BCD8', marginTop: 3, fontWeight: 500 }}>{value}</div>
          </div>
        ))}
      </div>

      {drop.links_fontes?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {drop.links_fontes.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: '#9B8FAA', textDecoration: 'none', border: '0.5px solid #1E0029', borderRadius: 20, padding: '2px 10px' }}>
              fonte {i + 1} ↗
            </a>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: '#333' }}>
        {new Date(drop.created_at).toLocaleString('pt-BR')}
        {drop.marca && ` · ${drop.marca.nome}`}
      </div>
    </div>
  )
}

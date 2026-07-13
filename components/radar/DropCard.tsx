'use client'
import { TrendDrop } from '@/lib/types'

const STATUS_CONFIG = {
  em_alta:       { bg: '#81D300', color: '#0b0b0b', label: 'EM ALTA' },
  subindo:       { bg: '#a063e8', color: '#fff',    label: 'SUBINDO' },
  estabilizando: { bg: 'transparent', color: '#a8a29e', label: 'ESTABILIZANDO', border: '1px solid #232323' },
  esfriando:     { bg: 'transparent', color: '#6e6a66', label: 'ESFRIANDO',     border: '1px solid #232323' },
}

const FUNIL_CONFIG = {
  growth: { color: '#81D300', label: '↗ GROWTH' },
  base:   { color: '#a8a29e', label: '→ BASE' },
}

export default function DropCard({ drop }: { drop: TrendDrop }) {
  const s = STATUS_CONFIG[drop.status_hype]
  const f = FUNIL_CONFIG[drop.categoria_funil]

  return (
    <div style={{ background: '#121212', border: '1px solid #232323', borderRadius: 24, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {drop.marca && (
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', padding: '3px 10px', borderRadius: 20, background: '#181818', color: '#f5f3ef', border: '1px solid #232323' }}>
            {drop.marca.nome}
          </span>
        )}
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, border: 'border' in s ? s.border : undefined }}>
          {s.label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 500, color: f.color, letterSpacing: '0.06em' }}>{f.label}</span>
        <span style={{ fontSize: 11, color: '#6e6a66', marginLeft: 'auto' }}>HYPE {drop.indice_hype}/100</span>
      </div>

      <div style={{ fontSize: 18, fontWeight: 600, color: '#f5f3ef', lineHeight: 1.3 }}>{drop.insight_titulo}</div>

      <p style={{ fontSize: 14, color: '#a8a29e', margin: 0, lineHeight: 1.5 }}>{drop.descricao_fato}</p>

      <div style={{ borderLeft: '2px solid #81D300', paddingLeft: 12, lineHeight: 1.5 }}>
        <span style={{ fontSize: 10, letterSpacing: '0.08em', color: '#81D300', display: 'block', marginBottom: 4 }}>INSIGHT</span>
        <span style={{ fontSize: 14, color: '#f5f3ef' }}>{drop.gancho_produto}</span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {[
          { label: 'DENSIDADE', value: drop.score_densidade },
          { label: 'TRANSBORDO', value: drop.score_transbordo },
          { label: 'VELOCIDADE', value: drop.score_velocidade },
        ].map(({ label, value }) => (
          <div key={label} style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: '#6e6a66', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
            <div style={{ height: 6, borderRadius: 3, background: '#181818', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${value}%`, background: 'linear-gradient(90deg, #4a2e63, #81d300)', borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 11, color: '#a8a29e', marginTop: 3, fontWeight: 500 }}>{value}</div>
          </div>
        ))}
      </div>

      {drop.links_fontes?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {drop.links_fontes.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: '#a8a29e', textDecoration: 'none', border: '1px solid #232323', borderRadius: 20, padding: '2px 10px' }}>
              fonte {i + 1} ↗
            </a>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11, color: '#6e6a66' }}>
        {new Date(drop.created_at).toLocaleString('pt-BR')}
      </div>
    </div>
  )
}

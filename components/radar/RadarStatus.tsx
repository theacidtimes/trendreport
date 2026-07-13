'use client'
import { Marca } from '@/lib/types'

// Painel de status da captura no Radar. NÃO controla nada (ligar/desligar é no admin) —
// só mostra: uma animação de radar quando há captura ativa + cápsulas ON/OFF por cliente.
export default function RadarStatus({ marcas }: { marcas: Marca[] }) {
  const anyActive = marcas.some(m => m.status_varredura)

  return (
    <div style={{
      display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center',
      background: '#121212', border: '1px solid #232323', borderRadius: 24,
      padding: '1.25rem 1.5rem'
    }}>
      <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
        {anyActive ? (
          <>
            <span className="radar-ring" style={{ animationDelay: '0s' }} />
            <span className="radar-ring" style={{ animationDelay: '0.8s' }} />
            <span className="radar-ring" style={{ animationDelay: '1.6s' }} />
            <span className="radar-core" />
          </>
        ) : (
          <span style={{
            position: 'absolute', inset: '40%', borderRadius: '50%',
            background: '#232323'
          }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, letterSpacing: '0.03em', marginBottom: 12,
          color: anyActive ? '#81D300' : '#6e6a66'
        }}>
          {anyActive ? 'Capturando sinais em tempo real' : 'Captura pausada'}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {marcas.map(m => {
            const on = m.status_varredura
            return (
              <span key={m.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                padding: '5px 12px', borderRadius: 20,
                background: on ? 'rgba(129,211,0,0.10)' : '#181818',
                color: on ? '#81D300' : '#6e6a66',
                border: `1px solid ${on ? 'rgba(129,211,0,0.40)' : '#232323'}`
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: on ? '#81D300' : '#6e6a66',
                  boxShadow: on ? '0 0 6px #81D300' : 'none'
                }} />
                {m.nome} · {on ? 'ON' : 'OFF'}
              </span>
            )
          })}
        </div>
      </div>

      <style>{`
        .radar-ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 1.5px solid rgba(129,211,0,0.5);
          opacity: 0; animation: radarPulse 2.4s ease-out infinite;
        }
        @keyframes radarPulse {
          0%   { transform: scale(0.18); opacity: 0.9; }
          100% { transform: scale(1);    opacity: 0;   }
        }
        .radar-core {
          position: absolute; inset: 42%; border-radius: 50%;
          background: #81D300; box-shadow: 0 0 12px 2px rgba(129,211,0,0.7);
          animation: radarCore 2.4s ease-in-out infinite;
        }
        @keyframes radarCore {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1;    }
        }
      `}</style>
    </div>
  )
}

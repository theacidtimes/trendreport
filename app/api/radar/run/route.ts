import { NextResponse } from 'next/server'
import { runAllActiveRadars } from '@/lib/radar/runRadar'

// Cada marca roda inline (~100s: coleta + embeddings + LLM). O default da Vercel
// corta o segundo cliente no meio; 300s (teto do plano Pro) dá folga pra fila.
export const maxDuration = 300

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.RADAR_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await runAllActiveRadars()
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

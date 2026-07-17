// Teste OFFLINE da camada de interpretacao da Fabric Lake (Fase 5, Fatia 2).
// Le sinais REAIS ja coletados em radar_raw_data, roda interpretSignal em cada
// um e imprime a leitura des-identificada pra calibrar a taxonomia. Por padrao
// e DRY-RUN (nao escreve na lake). Com --ingest, persiste via fabric_ingest_signal.
//
// Uso:
//   tsx --env-file=.env.local scripts/fabric-interpret-test.ts [N] [--ingest]
//
// Requer: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY.

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { interpretSignal, RawSignalInput } from '../lib/fabric/interpret'
import { ingestSignal } from '../lib/fabric/ingest'

// Loader minimo de .env.local (o --env-file do Node pula linhas em certos
// formatos de valor). Preenche so o que ainda nao esta no ambiente.
function loadEnvLocal() {
  try {
    for (const raw of readFileSync('.env.local', 'utf8').split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const k = line.slice(0, eq).trim()
      let v = line.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (!process.env[k]) process.env[k] = v   // seta se ausente OU vazio
    }
  } catch { /* sem .env.local: assume ambiente ja setado */ }
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('falta ANTHROPIC_API_KEY')

  const args = process.argv.slice(2)
  const doIngest = args.includes('--ingest')
  const n = parseInt(args.find(a => /^\d+$/.test(a)) ?? '8', 10)

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const { data, error } = await supabase
    .from('radar_raw_data')
    .select('id, fonte, conteudo, url, metadata, embedding, created_at')
    .order('created_at', { ascending: false })
    .limit(n)
  if (error) throw new Error(`radar_raw_data: ${error.message}`)

  const rows = data ?? []
  console.log(`\n=== ${rows.length} sinais reais | modo=${doIngest ? 'INGEST' : 'dry-run'} ===\n`)

  for (const r of rows) {
    const conteudo = (r.conteudo as string) ?? ''
    const nl = conteudo.indexOf('\n')
    const titulo = nl >= 0 ? conteudo.slice(0, nl) : conteudo
    const snippet = nl >= 0 ? conteudo.slice(nl + 1) : null
    const meta = (r.metadata ?? {}) as { upvotes?: number; comentarios?: number; coletado_em?: string }

    const input: RawSignalInput = {
      fonte: r.fonte as string,
      titulo,
      snippet,
      url: r.url as string | null,
      occurred_at: (meta.coletado_em as string) ?? (r.created_at as string),
      upvotes: meta.upvotes ?? null,
      comentarios: meta.comentarios ?? null
    }

    const interp = await interpretSignal(supabase, input)
    console.log('─'.repeat(72))
    console.log(`[${input.fonte}] ${titulo.slice(0, 70)}`)
    if (!interp) { console.log('  → interpretacao NULL (ver erro acima)\n'); continue }

    console.log(`  tema_deid : ${interp.tema_deid ?? '—'}`)
    console.log(`  setor     : ${interp.setor ?? '—'}   formato: ${interp.formato ?? '—'}   momento: ${interp.momento ?? '—'}`)
    console.log(`  regiao    : ${interp.regiao ?? '—'}   idioma: ${interp.idioma ?? '—'}   engaj: ${interp.engajamento_faixa ?? '—'}`)
    console.log(`  comport.  : ${interp.comportamento.join(', ') || '—'}`)
    console.log(`  emocao    : ${interp.emocao.join(', ') || '—'}`)
    console.log(`  inflexao  : ${interp.inflexao.join(', ') || '—'}`)
    console.log(`  negocio   : ${interp.lente_negocio.join(', ') || '—'}`)

    // sanity anti-vazamento: tema_deid nao pode conter @ ou http
    if (interp.tema_deid && /@|https?:\/\//i.test(interp.tema_deid)) {
      console.log('  ⚠️  ALERTA: tema_deid contem identificador! revisar prompt/scrub')
    }

    if (doIngest) {
      const emb = parseEmbedding(r.embedding)
      const id = emb ? await ingestSignal(supabase, interp, emb) : null
      console.log(`  → ingest  : ${id ?? 'FALHOU (embedding invalido?)'}`)
    }
    console.log()
  }
}

// pgvector via PostgREST volta como string "[a,b,...]" (ou array, dependendo).
function parseEmbedding(v: unknown): number[] | null {
  if (Array.isArray(v)) return v as number[]
  if (typeof v === 'string') {
    try {
      const arr = JSON.parse(v)
      return Array.isArray(arr) ? arr : null
    } catch { return null }
  }
  return null
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })

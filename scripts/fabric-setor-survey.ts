// Levantamento OFFLINE de DISTRIBUICAO da camada de interpretacao (Fase 5).
// Diferente do fabric-interpret-test (que imprime N sinais recentes um a um),
// este pega uma amostra ALEATORIA de radar_raw_data, roda interpretSignal em
// cada e agrega a DISTRIBUICAO de setor + das 4 rodas semanticas. Objetivo:
// responder com DADO REAL "que setores/tags saem do nosso conteudo?", sem chute.
// DRY-RUN sempre (nunca escreve na lake).
//
// Uso: npx tsx scripts/fabric-setor-survey.ts [N]     (default 45)

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { interpretSignal, isReadIngestWorthy, RawSignalInput, Interpretation } from '../lib/fabric/interpret'

function loadEnvLocal() {
  try {
    for (const raw of readFileSync('.env.local', 'utf8').split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const k = line.slice(0, eq).trim()
      let v = line.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!process.env[k]) process.env[k] = v
    }
  } catch { /* ambiente ja setado */ }
}

function tally(map: Map<string, number>, keys: string[]) {
  for (const k of keys) map.set(k, (map.get(k) ?? 0) + 1)
}

function printDist(titulo: string, map: Map<string, number>, total: number) {
  console.log(`\n${titulo}`)
  const rows = Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  if (rows.length === 0) { console.log('  (vazio)'); return }
  for (const [k, n] of rows) {
    const pct = Math.round((n / total) * 100)
    const bar = '█'.repeat(Math.round(n / total * 24))
    console.log(`  ${k.padEnd(22)} ${String(n).padStart(3)}  ${String(pct).padStart(3)}%  ${bar}`)
  }
}

async function main() {
  loadEnvLocal()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('falta ANTHROPIC_API_KEY')

  const n = parseInt(process.argv.slice(2).find(a => /^\d+$/.test(a)) ?? '45', 10)
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  // marcas pra rotular a amostra (sem expor nada — so pra eu ver a diversidade)
  const { data: marcas } = await supabase.from('marcas').select('id, nome')
  const marcaNome = new Map((marcas ?? []).map((m: { id: string; nome: string }) => [m.id, m.nome]))

  // pool leve (sem embedding, que e pesado), embaralha e amostra N
  const { data: pool, error } = await supabase
    .from('radar_raw_data')
    .select('id, fonte, conteudo, url, metadata, marca_id, created_at')
    .limit(2000)
  if (error) throw new Error(`radar_raw_data: ${error.message}`)
  const all = pool ?? []
  for (let i = all.length - 1; i > 0; i--) {   // Fisher-Yates (swap via temp, downlevel-safe)
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = all[i]; all[i] = all[j]; all[j] = tmp
  }
  const sample = all.slice(0, n)
  console.log(`\n=== levantamento de distribuicao | ${sample.length} sinais aleatorios de ${all.length} ===\n`)

  const setor = new Map<string, number>()
  const formato = new Map<string, number>()
  const momento = new Map<string, number>()
  const comport = new Map<string, number>()
  const emocao = new Map<string, number>()
  const inflexao = new Map<string, number>()
  const negocio = new Map<string, number>()
  const porMarca = new Map<string, number>()
  let nulos = 0, semTema = 0, vazamentos = 0, ingeriveis = 0, descartaveis = 0

  // roda em lotes pequenos pra ir mais rapido sem estourar rate limit
  for (let i = 0; i < sample.length; i += 6) {
    const lote = sample.slice(i, i + 6)
    const results = await Promise.all(lote.map(async (r) => {
      const conteudo = (r.conteudo as string) ?? ''
      const nl = conteudo.indexOf('\n')
      const titulo = nl >= 0 ? conteudo.slice(0, nl) : conteudo
      const snippet = nl >= 0 ? conteudo.slice(nl + 1) : null
      const meta = (r.metadata ?? {}) as { upvotes?: number; comentarios?: number; coletado_em?: string }
      const input: RawSignalInput = {
        fonte: r.fonte as string, titulo, snippet, url: r.url as string | null,
        occurred_at: meta.coletado_em ?? (r.created_at as string),
        upvotes: meta.upvotes ?? null, comentarios: meta.comentarios ?? null
      }
      const interp = await interpretSignal(supabase, input)
      return { r, titulo, interp }
    }))

    for (const { r, titulo, interp } of results) {
      const marca = marcaNome.get(r.marca_id as string) ?? '(sem)'
      porMarca.set(marca, (porMarca.get(marca) ?? 0) + 1)
      if (!interp) { nulos++; console.log(`  [null] ${(r.fonte as string).padEnd(8)} ${titulo.slice(0, 60)}`); continue }
      const I = interp as Interpretation
      tally(setor, [I.setor ?? '(nulo)'])
      tally(formato, [I.formato ?? '(nulo)'])
      tally(momento, [I.momento ?? '(nulo)'])
      tally(comport, I.comportamento.length ? I.comportamento : ['(vazio)'])
      tally(emocao, I.emocao.length ? I.emocao : ['(vazio)'])
      tally(inflexao, I.inflexao.length ? I.inflexao : ['(vazio)'])
      tally(negocio, I.lente_negocio.length ? I.lente_negocio : ['(vazio)'])
      if (!I.tema_deid) semTema++
      if (I.tema_deid && /@|https?:\/\//i.test(I.tema_deid)) { vazamentos++; }
      if (isReadIngestWorthy(I)) ingeriveis++; else descartaveis++
      console.log(`  [${marca.slice(0, 14).padEnd(14)}] setor=${(I.setor ?? '—').padEnd(14)} ${(I.tema_deid ?? '—').slice(0, 62)}`)
    }
  }

  const total = sample.length
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`amostra por marca: ${Array.from(porMarca.entries()).map(([k, v]) => `${k}=${v}`).join('  ')}`)
  console.log(`interpretacoes nulas: ${nulos}   sem tema: ${semTema}   vazamentos de identidade: ${vazamentos}`)
  console.log(`FILTRO DE INGESTAO → ingeriveis: ${ingeriveis} (${Math.round(ingeriveis / total * 100)}%)   descartados por leitura fina: ${descartaveis} (${Math.round(descartaveis / total * 100)}%)`)
  printDist('SETOR', setor, total)
  printDist('FORMATO', formato, total)
  printDist('MOMENTO (esperado: tudo nulo — derivado na agregacao)', momento, total)
  printDist('COMPORTAMENTO', comport, total)
  printDist('EMOCAO', emocao, total)
  printDist('INFLEXAO (esperado: majoritariamente vazio)', inflexao, total)
  printDist('LENTE_NEGOCIO', negocio, total)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })

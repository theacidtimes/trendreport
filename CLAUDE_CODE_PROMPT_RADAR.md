# SESSÃO 2 — MÓDULO RADAR PREDITIVO
# Cole este prompt no Claude Code dentro da pasta trends-agent já existente

---

Tenho um app Next.js 14 com App Router já funcionando em `trends-agent/`.
Preciso que você adicione um novo módulo de monitoramento preditivo chamado **Trend Radar**.

## REGRA PRINCIPAL
Não altere, não renomeie e não delete nenhum arquivo existente.
Nos arquivos `lib/types.ts` e `lib/apify.ts`, apenas adicione código novo no final.
Todo o resto são arquivos novos.

## ANTES DE CRIAR QUALQUER ARQUIVO
1. Liste todos os arquivos que vai criar ou modificar
2. Aguarde minha confirmação
3. Só então comece — um arquivo por vez

---

## VARIÁVEIS DE AMBIENTE NECESSÁRIAS
Adicione ao `.env.local.example` (sem sobrescrever o que existe):
```
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
RADAR_CRON_SECRET=string_aleatoria_segura_aqui
```

---

## ARQUITETURA DE ARQUIVOS NOVOS

```
trends-agent/
├── supabase/
│   └── migrations/
│       └── 002_radar_module.sql
├── lib/
│   └── radar/
│       ├── collectData.ts
│       ├── scoreHype.ts
│       ├── radarPrompt.ts
│       └── runRadar.ts
├── app/
│   └── api/
│       └── radar/
│           ├── run/
│           │   └── route.ts
│           └── drops/
│               └── route.ts
├── components/
│   └── radar/
│       ├── DropsPanel.tsx
│       ├── DropCard.tsx
│       └── MarcaToggle.tsx
└── .github/
    └── workflows/
        └── radar-cron.yml
```

Modificações em arquivos existentes:
- `lib/types.ts` → adicionar novos tipos no final
- `.env.local.example` → adicionar 2 novas vars no final

---

## PASSO 1 — MIGRATION SQL
Crie `supabase/migrations/002_radar_module.sql`:

```sql
-- TABELA MARCAS
create table marcas (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  yaml_conhecimento jsonb not null default '{}',
  status_varredura  boolean not null default false,
  intervalo_horas   integer not null default 6,
  ultima_varredura  timestamptz,
  created_at        timestamptz default now()
);

alter table marcas enable row level security;
create policy "auth_only" on marcas for all using (auth.role() = 'authenticated');

-- TABELA TRENDS_RADAR
create table trends_radar (
  id                          uuid primary key default gen_random_uuid(),
  marca_id                    uuid references marcas(id) on delete cascade,
  insight_titulo              text not null,
  categoria_funil             text check (categoria_funil in ('growth', 'base')),
  status_hype                 text check (status_hype in ('em_alta','subindo','estabilizando','esfriando')),
  indice_hype                 integer check (indice_hype between 0 and 100),
  descricao_fato              text,
  gancho_produto              text,
  insight_criativo_cccaramelo text,
  links_fontes                text[] default '{}',
  score_densidade             integer,
  score_transbordo            integer,
  score_velocidade            integer,
  created_at                  timestamptz default now()
);

alter table trends_radar enable row level security;
create policy "auth_only" on trends_radar for all using (auth.role() = 'authenticated');

create index trends_radar_marca_id_idx on trends_radar(marca_id);
create index trends_radar_created_at_idx on trends_radar(created_at desc);
create index trends_radar_status_hype_idx on trends_radar(status_hype);
```

---

## PASSO 2 — TIPOS NOVOS
Adicione no final de `lib/types.ts` (não altere o que já existe):

```typescript
// ─── RADAR MODULE ──────────────────────────────────────────

export interface MarcaKnowledge {
  marca: string
  produto: string
  tom: string
  perfil_comportamental: string
  universos_culturais: string[]
  o_que_evitar: string[]
  ambicao_de_marca: string
}

export interface Marca {
  id: string
  nome: string
  yaml_conhecimento: MarcaKnowledge
  status_varredura: boolean
  intervalo_horas: number
  ultima_varredura: string | null
  created_at: string
}

export interface TrendDrop {
  id: string
  marca_id: string
  insight_titulo: string
  categoria_funil: 'growth' | 'base'
  status_hype: 'em_alta' | 'subindo' | 'estabilizando' | 'esfriando'
  indice_hype: number
  descricao_fato: string
  gancho_produto: string
  insight_criativo_cccaramelo: string
  links_fontes: string[]
  score_densidade: number
  score_transbordo: number
  score_velocidade: number
  created_at: string
  marca?: Marca
}

export interface RawDataPoint {
  fonte: 'reddit' | 'news' | 'twitter'
  titulo: string
  url: string
  snippet: string
  comentarios?: number
  upvotes?: number
  coletado_em: string
}

export interface HypeScore {
  total: number
  densidade: number
  transbordo: number
  velocidade: number
  status: TrendDrop['status_hype']
}
```

---

## PASSO 3 — COLETA DE DADOS
Crie `lib/radar/collectData.ts`:

```typescript
import { RawDataPoint } from '../types'

const APIFY_TOKEN = process.env.APIFY_TOKEN!
const APIFY_BASE = 'https://api.apify.com/v2'

async function runActor(actorId: string, input: object): Promise<any[]> {
  const run = await fetch(
    `${APIFY_BASE}/acts/${actorId}/runs?token=${APIFY_TOKEN}&waitForFinish=120`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    }
  ).then(r => r.json())

  if (!run?.data?.defaultDatasetId) return []

  const items = await fetch(
    `${APIFY_BASE}/datasets/${run.data.defaultDatasetId}/items?token=${APIFY_TOKEN}&limit=30`
  ).then(r => r.json())

  return Array.isArray(items) ? items : []
}

export async function collectReddit(keywords: string[]): Promise<RawDataPoint[]> {
  const query = keywords.slice(0, 3).join(' OR ')
  const items = await runActor('trudax/reddit-scraper-lite', {
    searches: [query],
    subreddits: ['eu_nvr', 'conversas', 'InternetBrasil', 'brasil', 'desabafos'],
    maxItems: 30,
    skipComments: false,
    sort: 'hot',
    time: 'day'
  })
  return items.map(item => ({
    fonte: 'reddit' as const,
    titulo: item.title || '',
    url: item.url || '',
    snippet: item.selftext?.substring(0, 300) || item.body?.substring(0, 300) || '',
    comentarios: item.numComments || 0,
    upvotes: item.score || 0,
    coletado_em: new Date().toISOString()
  })).filter(item => item.titulo && item.url)
}

export async function collectNews(keywords: string[]): Promise<RawDataPoint[]> {
  const query = keywords.slice(0, 3).join(' ')
  const items = await runActor('johnvc/GoogleNewsAPI', {
    q: `${query} site:.com.br OR site:.uol.com.br OR site:.g1.globo.com`,
    gl: 'BR',
    hl: 'pt-BR',
    max_pages: 2
  })
  return items.map(item => ({
    fonte: 'news' as const,
    titulo: item.title || '',
    url: item.link || '',
    snippet: item.snippet || '',
    coletado_em: new Date().toISOString()
  })).filter(item => item.titulo && item.url)
}

export async function collectTwitterTrends(): Promise<RawDataPoint[]> {
  const items = await runActor('data-slayer/twitter-trends-by-location', {
    country: 'Brazil'
  })
  return items.map(item => ({
    fonte: 'twitter' as const,
    titulo: item.name || item.trend || '',
    url: `https://x.com/search?q=${encodeURIComponent(item.name || '')}`,
    snippet: `Volume: ${item.tweetVolume || 'n/d'}`,
    coletado_em: new Date().toISOString()
  })).filter(item => item.titulo)
}

export async function collectAllData(keywords: string[]): Promise<RawDataPoint[]> {
  const [reddit, news, twitter] = await Promise.allSettled([
    collectReddit(keywords),
    collectNews(keywords),
    collectTwitterTrends()
  ])
  return [
    ...(reddit.status === 'fulfilled' ? reddit.value : []),
    ...(news.status === 'fulfilled' ? news.value : []),
    ...(twitter.status === 'fulfilled' ? twitter.value : [])
  ]
}
```

---

## PASSO 4 — ALGORITMO DE SCORE
Crie `lib/radar/scoreHype.ts`:

```typescript
import { RawDataPoint, HypeScore } from '../types'

export function scoreHype(data: RawDataPoint[]): HypeScore {
  const reddit  = data.filter(d => d.fonte === 'reddit')
  const news    = data.filter(d => d.fonte === 'news')
  const twitter = data.filter(d => d.fonte === 'twitter')

  // DIMENSÃO 1 — Densidade Conversacional (40%)
  const totalComentarios = reddit.reduce((acc, d) => acc + (d.comentarios || 0), 0)
  const totalUpvotes     = reddit.reduce((acc, d) => acc + (d.upvotes || 0), 0)
  const threadsQuentes   = reddit.filter(d => (d.comentarios || 0) > 50).length
  const densidade = Math.min(100, Math.round(
    Math.min(totalComentarios / 10, 40) +
    Math.min(totalUpvotes / 100, 30) +
    (threadsQuentes * 10)
  ))

  // DIMENSÃO 2 — Transbordo de Mídia (40%)
  const fontesUnicas = new Set(
    news.map(d => { try { return new URL(d.url).hostname } catch { return d.url } })
  ).size
  const transbordo = Math.min(100, Math.round(
    Math.min(fontesUnicas * 15, 60) +
    Math.min(news.length * 5, 40)
  ))

  // DIMENSÃO 3 — Velocidade e Shares (20%)
  const velocidade = Math.min(100, Math.round(Math.min(twitter.length * 20, 100)))

  const total = Math.round((densidade * 0.40) + (transbordo * 0.40) + (velocidade * 0.20))

  const status: HypeScore['status'] =
    total >= 75 ? 'em_alta'      :
    total >= 50 ? 'subindo'      :
    total >= 30 ? 'estabilizando':
    'esfriando'

  return { total, densidade, transbordo, velocidade, status }
}
```

---

## PASSO 5 — MOTOR DE PROMPT EM 3 CAMADAS
Crie `lib/radar/radarPrompt.ts`:

```typescript
import { MarcaKnowledge, RawDataPoint } from '../types'

const CAMADA_CCCARAMELO = `
Você é o motor criativo da cccaramelo, agência de inteligência cultural brasileira.

MANIFESTO:
- Rejeite ideias óbvias. Se a primeira ideia veio fácil, descarte.
- Busque a ironia, a quebra de expectativa, a conexão ousada.
- Um insight só vale se gerar negócio. Bonito sem resultado é portfólio, não trabalho.
- Cultura não é decoração de marca. É o lugar onde a marca tem permissão de existir.
- O óbvio é o inimigo. O clichê é a morte. A surpresa é o único caminho.

Você monitora a internet em tempo real para encontrar sinais culturais que possam se
tornar oportunidades de marca antes que virem mainstream.
`.trim()

function buildCamadaInternet(data: RawDataPoint[]): string {
  const reddit  = data.filter(d => d.fonte === 'reddit').slice(0, 10)
  const news    = data.filter(d => d.fonte === 'news').slice(0, 8)
  const twitter = data.filter(d => d.fonte === 'twitter').slice(0, 5)

  return `
DADOS COLETADOS NAS ÚLTIMAS 48H:

--- REDDIT (comportamento e conversas reais) ---
${reddit.map(d => `[REDDIT] ${d.titulo} (${d.comentarios || 0} comentários, ${d.upvotes || 0} upvotes)\n${d.snippet}`).join('\n\n') || 'sem dados'}

--- GOOGLE NEWS (transbordo de mídia) ---
${news.map(d => `[NEWS] ${d.titulo}\n${d.snippet}\nFonte: ${d.url}`).join('\n\n') || 'sem dados'}

--- TWITTER TRENDS BRASIL ---
${twitter.map(d => `[TWITTER] ${d.titulo} — ${d.snippet}`).join('\n') || 'sem dados'}
`.trim()
}

function buildCamadaMarca(knowledge: MarcaKnowledge): string {
  return `
DNA DA MARCA — ${knowledge.marca.toUpperCase()}:

Produto: ${knowledge.produto}
Tom de voz: ${knowledge.tom}
Perfil comportamental: ${knowledge.perfil_comportamental}
Universos culturais: ${knowledge.universos_culturais.join(', ')}
Ambição de marca: ${knowledge.ambicao_de_marca}
O que evitar: ${knowledge.o_que_evitar.join(', ')}

Identifique apenas sinais com PERMISSÃO CULTURAL real para esta marca.
Se o sinal não tiver fit genuíno, ignore. Não force conexões.
`.trim()
}

const OUTPUT_SCHEMA = `
Responda SOMENTE com array JSON válido. Sem markdown. Sem texto fora do JSON.
Máximo 4 drops. Mínimo 1. Só drops com fit genuíno.

[
  {
    "insight_titulo": string,
    "categoria_funil": "growth" | "base",
    "descricao_fato": string,
    "gancho_produto": string,
    "insight_criativo_cccaramelo": string,
    "links_fontes": string[]
  }
]

categoria_funil:
- "growth" = atrai novo público, gera awareness
- "base" = aprofunda relacionamento com quem já conhece

gancho_produto: headline de post pronto, específico.
BOM: "Seu Wi-Fi 7 não sabe o que é lag. Seus planos de férias, também não."
RUIM: "Conectar a marca com o momento cultural"

insight_criativo_cccaramelo: ideia ousada que a cccaramelo assinaria.
links_fontes: URLs reais dos dados que embasaram o drop.
`

export function buildRadarPrompt(
  knowledge: MarcaKnowledge,
  data: RawDataPoint[]
): { system: string; user: string } {
  return {
    system: [CAMADA_CCCARAMELO, '\n\n---\n\n', buildCamadaMarca(knowledge)].join(''),
    user:   [buildCamadaInternet(data), '\n\n---\n\n', OUTPUT_SCHEMA].join('')
  }
}
```

---

## PASSO 6 — ORQUESTRADOR
Crie `lib/radar/runRadar.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { collectAllData } from './collectData'
import { scoreHype } from './scoreHype'
import { buildRadarPrompt } from './radarPrompt'
import { Marca } from '../types'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function runRadarForMarca(marca: Marca): Promise<void> {
  console.log(`[RADAR] Iniciando: ${marca.nome}`)
  const k = marca.yaml_conhecimento
  const keywords = [k.marca, k.produto, ...k.universos_culturais.slice(0, 3)]

  const rawData = await collectAllData(keywords)
  if (rawData.length < 3) {
    console.log(`[RADAR] Dados insuficientes para ${marca.nome}`)
    return
  }

  const hype = scoreHype(rawData)
  if (hype.total < 20) {
    console.log(`[RADAR] Score baixo (${hype.total}), pulando ${marca.nome}`)
    await supabase.from('marcas').update({ ultima_varredura: new Date().toISOString() }).eq('id', marca.id)
    return
  }

  const { system, user } = buildRadarPrompt(k, rawData)
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system,
    messages: [{ role: 'user', content: user }]
  })

  const raw = response.content.map(b => b.type === 'text' ? b.text : '').join('')
  let drops: any[]
  try {
    drops = JSON.parse(raw.replace(/```json|```/g, '').trim())
    if (!Array.isArray(drops)) drops = [drops]
  } catch (e) {
    console.error(`[RADAR] Erro ao parsear drops:`, e)
    return
  }

  const rows = drops.map(drop => ({
    marca_id:                    marca.id,
    insight_titulo:              drop.insight_titulo,
    categoria_funil:             drop.categoria_funil,
    status_hype:                 hype.status,
    indice_hype:                 hype.total,
    descricao_fato:              drop.descricao_fato,
    gancho_produto:              drop.gancho_produto,
    insight_criativo_cccaramelo: drop.insight_criativo_cccaramelo,
    links_fontes:                drop.links_fontes || [],
    score_densidade:             hype.densidade,
    score_transbordo:            hype.transbordo,
    score_velocidade:            hype.velocidade
  }))

  const { error } = await supabase.from('trends_radar').insert(rows)
  if (error) console.error(`[RADAR] Erro ao salvar:`, error)
  else console.log(`[RADAR] ${rows.length} drops salvos para ${marca.nome}`)

  await supabase.from('marcas').update({ ultima_varredura: new Date().toISOString() }).eq('id', marca.id)
}

export async function runAllActiveRadars(): Promise<void> {
  const { data: marcas, error } = await supabase
    .from('marcas').select('*').eq('status_varredura', true)

  if (error || !marcas?.length) {
    console.log('[RADAR] Nenhuma marca ativa')
    return
  }

  for (const marca of marcas) {
    try {
      await runRadarForMarca(marca as Marca)
      await new Promise(r => setTimeout(r, 5000))
    } catch (e) {
      console.error(`[RADAR] Erro em ${marca.nome}:`, e)
    }
  }
  console.log('[RADAR] Varredura completa')
}
```

---

## PASSO 7 — API ROUTES
Crie `app/api/radar/run/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { runAllActiveRadars } from '@/lib/radar/runRadar'

export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.RADAR_CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await runAllActiveRadars()
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
  } catch (error) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

Crie `app/api/radar/drops/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)

  let query = supabase
    .from('trends_radar')
    .select('*, marca:marcas(nome)')
    .order('created_at', { ascending: false })
    .limit(50)

  const marca_id = searchParams.get('marca_id')
  const status   = searchParams.get('status')
  const funil    = searchParams.get('funil')

  if (marca_id) query = query.eq('marca_id', marca_id)
  if (status)   query = query.eq('status_hype', status)
  if (funil)    query = query.eq('categoria_funil', funil)

  const { data, error } = await query
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ drops: data })
}
```

---

## PASSO 8 — GITHUB ACTIONS
Crie `.github/workflows/radar-cron.yml`:

```yaml
name: Trend Radar — Varredura Contínua

on:
  schedule:
    - cron: '0 */3 * * *'
  workflow_dispatch:

jobs:
  run-radar:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Trigger Radar API
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" \
            -X POST "${{ secrets.APP_URL }}/api/radar/run" \
            -H "Authorization: Bearer ${{ secrets.RADAR_CRON_SECRET }}" \
            -H "Content-Type: application/json")
          echo "Status: $response"
          if [ "$response" != "200" ]; then
            echo "Falha — status $response"
            exit 1
          fi
```

---

## PASSO 9 — COMPONENTE DROPCARD
Crie `components/radar/DropCard.tsx`:

```tsx
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
        <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, border: (s as any).border }}>
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
            <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
            <div style={{ height: 4, borderRadius: 2, background: '#1E0029', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${value}%`, background: '#660099', borderRadius: 2 }} />
            </div>
            <div style={{ fontSize: 10, color: '#9B8FAA', marginTop: 3 }}>{value}</div>
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
```

---

## PASSO 10 — COMPONENTE MARCA TOGGLE
Crie `components/radar/MarcaToggle.tsx`:

```tsx
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
```

---

## PASSO 11 — PAINEL DE DROPS
Crie `components/radar/DropsPanel.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { TrendDrop } from '@/lib/types'
import DropCard from './DropCard'

export default function DropsPanel({ marcaId }: { marcaId?: string }) {
  const [drops, setDrops] = useState<TrendDrop[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroFunil, setFiltroFunil] = useState('')

  useEffect(() => {
    const params = new URLSearchParams()
    if (marcaId)     params.set('marca_id', marcaId)
    if (filtroStatus) params.set('status', filtroStatus)
    if (filtroFunil)  params.set('funil', filtroFunil)

    fetch(`/api/radar/drops?${params}`)
      .then(r => r.json())
      .then(d => { setDrops(d.drops || []); setLoading(false) })
  }, [marcaId, filtroStatus, filtroFunil])

  const filterBtn = (label: string, value: string, current: string, setter: (v: string) => void) => (
    <button
      onClick={() => setter(current === value ? '' : value)}
      style={{
        fontSize: 11, fontWeight: 500, letterSpacing: '0.06em',
        padding: '4px 12px', borderRadius: 20, border: '0.5px solid',
        cursor: 'pointer',
        background: current === value ? '#660099' : 'transparent',
        color: current === value ? '#fff' : '#9B8FAA',
        borderColor: current === value ? '#660099' : '#1E0029'
      }}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {filterBtn('EM ALTA', 'em_alta', filtroStatus, setFiltroStatus)}
        {filterBtn('SUBINDO', 'subindo', filtroStatus, setFiltroStatus)}
        {filterBtn('ESTABILIZANDO', 'estabilizando', filtroStatus, setFiltroStatus)}
        <div style={{ width: 1, background: '#1E0029', margin: '0 4px' }} />
        {filterBtn('GROWTH', 'growth', filtroFunil, setFiltroFunil)}
        {filterBtn('BASE', 'base', filtroFunil, setFiltroFunil)}
      </div>

      {loading && <p style={{ color: '#555', fontSize: 14 }}>carregando drops...</p>}
      {!loading && drops.length === 0 && (
        <p style={{ color: '#555', fontSize: 14 }}>nenhum drop encontrado. ative uma marca e aguarde a próxima varredura.</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
        {drops.map(drop => <DropCard key={drop.id} drop={drop} />)}
      </div>
    </div>
  )
}
```

---

## PASSO 12 — CHECKLIST FINAL

Após criar todos os arquivos:

1. `npm run build` — zero erros TypeScript
2. Aplique a migration no Supabase Dashboard → SQL Editor → cole o conteúdo de `002_radar_module.sql`
3. Adicione os secrets no GitHub:
   - `APP_URL` → URL da Vercel (ex: https://trends-agent.vercel.app)
   - `RADAR_CRON_SECRET` → mesmo valor do `.env.local`
4. Teste manual: POST `/api/radar/run` com o header correto
5. Cadastre a primeira marca no Supabase com o JSON de exemplo abaixo
6. Ative o toggle e verifique se drops aparecem no painel

**JSON de exemplo para cadastrar Vivo no Supabase:**
```json
{
  "marca": "Vivo",
  "produto": "Fibra residencial e Wi-Fi 7",
  "tom": "irreverente, cultura pop brasileira, sem ser corporativo",
  "perfil_comportamental": "Adultos 25-45 anos, classes B e C, hiperconectados, assistem TV com celular na mão, participam de grupos no WhatsApp, jogam, trabalham em casa",
  "universos_culturais": [
    "@theacidtimes — estética e linguagem editorial",
    "comunidade gamer BR — Twitch, Reddit r/gamesEcultura",
    "páginas de meme — @choquei, @desimpedidos",
    "cultura de séries — TikTok review"
  ],
  "o_que_evitar": [
    "comparação direta com concorrentes",
    "tom político",
    "linguagem técnica de telecom",
    "prometer velocidade em Mbps"
  ],
  "ambicao_de_marca": "Ser a marca de conectividade que entende a cultura brasileira — não apenas o produto, mas o que o produto viabiliza: o momento, a experiência, o estar junto mesmo estando em casa"
}
```

**Inserir no Supabase:**
```sql
insert into marcas (nome, yaml_conhecimento, status_varredura, intervalo_horas)
values ('Vivo', '[cole o JSON acima]', false, 3);
```

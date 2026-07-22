# Trends Agent / Acid Fabric — Documento Técnico de Produto

> Plataforma de inteligência de tendências culturais movida a IA. Cada insight é ancorado em dado real coletado (regra anti-fabricação). Hoje opera single-tenant (cccaramelo/Caramelo); a arquitetura já está preparada para licenciamento white-label multi-tenant (Acid Fabric).

Data do documento: 2026-07-21

**Titularidade e operação:** plataforma desenvolvida e operada por **The Acid Times** (CNPJ 36.458.402/0001-81). Clientes/tenants licenciam o uso; a titularidade do software, algoritmos e interfaces permanece com a The Acid Times, inclusive quando o tenant usa identidade visual white-label. Termos e Condições de Uso em `/termos`, aceitos no primeiro login (versão e timestamp gravados no `user_metadata`; ver `lib/legal.ts` e `app/auth/actions.ts`).

---

## 1. Visão geral

O produto transforma um briefing cultural em um **relatório de tendências acionável** e mantém um **radar contínuo** que monitora o entorno cultural de cada marca. Toda análise passa por uma metodologia proprietária (MOTOR_ACID): cultura → comportamento → insight → produto.

Dois motores principais:

- **Trends Report** — geração sob demanda de um relatório editorial a partir de um briefing (YAML). Coleta multi-fonte, análise via Claude, saída em JSON renderizada como HTML e publicável por link público.
- **Trend Radar** — monitoramento contínuo por marca, em várias "lanes" de coleta, com scoring de hype e geração de drops (sinais) versionados no tempo.

Complementos: **Mapa Semântico** (grafo interativo de sinais), **modelo de créditos/cota**, e a camada **Acid Fabric** (multi-tenant white-label + Fabric Lake de inteligência cross-tenant).

---

## 2. Stack tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14.2.35 (App Router) |
| Linguagem | TypeScript 5 |
| UI | React 18, Tailwind CSS 3.4, framer-motion, lucide-react |
| Grafo/canvas | @xyflow/react (React Flow) |
| Banco de dados | Supabase PostgreSQL + pgvector |
| Auth | Supabase Auth (@supabase/ssr) |
| LLM | Anthropic Claude (SDK @anthropic-ai/sdk 0.109.1) |
| Embeddings | Voyage AI (voyage-3, 1024 dimensões) |
| Coleta de dados | Apify (actors de scraping) |
| E-mail | Resend |
| Deploy | Vercel (Next.js nativo) |
| Jobs longos | GitHub Actions (radar + geração de relatório) |

Modelos LLM em uso: `claude-sonnet-4-6` (análise principal) e `claude-haiku-4-5` (derivação de termos e interpretação de sinais). Prompt caching aplicado à camada de metodologia fixa.

---

## 3. Arquitetura

**Frontend + Backend no mesmo app Next.js (App Router):**

- Server components para SSR (`/app`).
- API routes REST em `/app/api/*` + RPCs do Supabase.
- Middleware de auth: rotas `/dashboard/*` redirecionam para `/login` se não autenticado.

**Worker assíncrono:** tarefas longas (coleta + geração) rodam via GitHub Actions (timeout ~30min), disparadas por webhook, para não estourar o limite serverless da Vercel.

**Fluxo de geração de relatório:**

1. `POST /api/generate` valida créditos/módulos e cria o report em status `pending`.
2. Haiku deriva termos de busca a partir do briefing (lanes social, adjacente e news).
3. `collectAll()` dispara os actors da Apify por lane (service-role).
4. Sonnet gera o `TrendReport` (JSON) sob a metodologia de 3 camadas.
5. Report salvo; publicável por slug público em `/r/[slug]`.

**Fluxo do radar (`lib/radar/runRadar.ts`):**

1. Planeja lanes a partir do DNA da marca.
2. Scrapes via Apify → dados brutos em `radar_raw_data` (com embedding Voyage).
3. Scoring de hype (densidade 65% / velocidade 20% / transbordo 15%).
4. Sonnet gera drops; fork opcional para o Fabric Lake (de-identificado).

---

## 4. Features

### 4.1 Trends Report
- Input via briefing YAML (cliente, produto, tom, contexto, ação desejada, memes vistos, cor da marca).
- Coleta multi-fonte (ver 4.4).
- Saída estruturada: `meta` (índice de hype 0–100, próximo gatilho, título social), `tendencias` (2–5), `oportunidades` (2–4 ações rotuladas: NEWSJACKING, HUMOR, EMOÇÃO, PRODUTO_EM_AÇÃO, TIMING, etc.), `copy` (insights feed+stories), `radar`, `insights` (6–8 cards semânticos), `glossario` (10–16 pastilhas de vocabulário).
- Renderização HTML editorial e exportação de imagem (html-to-image).
- **Link público** sem login (`/r/[slug]`).

### 4.2 Trend Radar (monitoramento contínuo)
- Multi-lane (6 default + LinkedIn opcional): Reddit cultural, Reddit marca, TikTok cultural (proxy BR), Twitter/X cultural, News BR-marca, News global-EN (sinal antecipado da imprensa internacional), LinkedIn (B2B, por marca).
- **Lane adjacente** como diferencial: busca o entorno cultural, não só menções diretas à marca.
- Curva de status: `em_alta` → `subindo` → `estabilizando` → `esfriando`.
- Cadência configurável por marca (`intervalo_horas`, default 8h; experimento a 12h para algumas marcas).
- Backfill por agenda cultural compartilhada (`pulso_cultural`: esporte, entretenimento, música, massa).

### 4.3 Mapa Semântico
- Grafo interativo (@xyflow/react) dos drops do radar.
- Clustering por distância de embedding (UPGMA), nó core + nós de tema, arestas spine (core→tema) e web (tema↔tema).

### 4.4 Fontes de coleta (Apify actors)
| Fonte | Actor | Notas |
|---|---|---|
| Reddit | trudax/reddit-scraper-lite | ordenado por relevância |
| TikTok | clockworks/tiktok-scraper | proxy BR, último mês |
| Twitter/X | apidojo/tweet-scraper | conteúdo real |
| Google News | johnvc/GoogleNewsAPI | BR + portais globais |
| Instagram | apify/instagram-scraper | lista curada de perfis |
| LinkedIn | harvestapi/linkedin-post-search | opcional por marca |

### 4.5 Modelo de créditos / cota
- 1 crédito por run (inclusive scans vazios) e por relatório; débito idempotente via `creditos_ledger`.
- Cota dimensionada pelo consumo real (~300/mês para Caramelo), não pelos 1000 seed.

### 4.6 Acid Fabric (white-label multi-tenant)
- Branding por tenant (logo, cores) via `tenants.branding`.
- Licenciamento modular: `radar`, `reports`, `dados_semanticos`.
- Planos de assinatura (mensal → anual) com auto-renovação.
- **Fabric Lake**: schema separado, RLS travado (só service_role/acid_admin), sinais de-identificados para inteligência cross-tenant (sem marca/tenant/URL/autor).

### 4.7 Administração
- **Admin** (`/dashboard/admin`): usuários, marcas (upload YAML, cadência radar), auditoria, créditos.
- **Console ACID** (`/console`): super-admin, provisionamento de tenants, saúde da plataforma, Fabric Lake.

---

## 5. Modelo de dados

Migrations versionadas (38 arquivos em `supabase/migrations/`, `0001`→`0038`).

**Tabelas núcleo:**
- `reports` — briefing (jsonb), report (jsonb TrendReport), status, marca_id, tenant_id.
- `marcas` — `yaml_conhecimento` (DNA da marca: produto, tom, universos culturais, o-que-evitar), `intervalo_horas`, `ultima_varredura`.
- `trends_radar` — drops: título, categoria de funil, status de hype, índice, gancho de produto, scores.
- `radar_runs`, `radar_raw_data` (com `embedding vector(1024)`), `radar_scrape_jobs`.

**Multi-tenancy:** `tenants`, `tenant_users`, `tenant_modulos`, `assinaturas`.

**Metering:** `creditos_ledger` (razão de créditos).

**Fabric Lake:** schema `fabric_lake` com `taxonomia`, `signal`, `fabric_trend_cells`.

**Agenda cultural:** `pulso_cultural` (calendário compartilhado).

**RPCs principais:** `is_acid_admin()`, `meu_tenant_status()`, `meus_modulos()`, `credito_resumo()`, `cobrar_radar_run()`, `provisionar_tenant()`, `atualizar_branding()`, `match_radar_signals()` (busca por similaridade vetorial), `acid_saude_tenants()`.

**Isolamento:** RLS por `tenant_id` (claim no JWT) + bypass de super-admin.

---

## 6. IA e prompts (arquitetura de 3 camadas)

1. **Camada 1 — MOTOR_ACID (travada):** metodologia, verdades humanas, contextos culturais, metáforas, regras de avaliação e anti-fabricação, schema de campos. Cacheada.
2. **Camada 2 — Perfil do tenant (customizável):** lente criativa do tenant (`perfil_criativo`), limitada, nunca sobrepõe a metodologia.
3. **Camada 3 — DNA da marca (dinâmica):** `yaml_conhecimento` como **fonte única de verdade** (radar e report bebem do mesmo dado).

Embeddings Voyage v3 alimentam: clustering do mapa, similaridade de sinais e o Fabric Lake.

---

## 7. Restrições e práticas invioláveis

1. **Anti-fabricação:** todo insight/sinal precisa mapear para dado real coletado. Sem injeção de conhecimento. Preferir menos itens a inventar conteúdo.
2. **Migrations aditivas:** nunca destrutivo; backfill antes de constraint; motores existentes (radar/report/mapa) não podem quebrar.
3. **Isolamento de tenant:** RLS + claim no JWT.
4. **Fabric Lake:** schema isolado, escrita só por service_role, defesa em profundidade.
5. **Estilo de texto:** evitar em-dash (`—`) em copy gerada (sinaliza IA).

---

## 8. Deploy e ambiente

- **Vercel** para o app Next.js; **GitHub Actions** para jobs longos.
- Variáveis: `ANTHROPIC_API_KEY`, `APIFY_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VOYAGE_API_KEY`, `RADAR_CRON_SECRET`, `RESEND_API_KEY`.
- Projeto Supabase: `quwivphvruvgbjksprks`. Tenant #1: "Caramelo" (agência, ativo).

---

## 9. Roadmap (próximas fases)

- **Fase 2** — endurecer RLS (isolamento estrito por tenant).
- **Fase 3** — metering completo (rate limit por plano: relatórios/mês, intervalo mínimo de radar).
- **Fase 4** — console + branding self-service e integração de pagamento.
- **Fase 5** — ativar o Fabric Lake (agregação cross-tenant, hoje dormente).
- **Expansões** — lane LinkedIn com termos próprios; integração plena da agenda cultural (Pulso) com pesos ajustáveis.

---

## 10. Mapa de arquivos-chave

**Lógica de negócio (`lib/`):** `generateReport.ts`, `systemPrompt.ts`, `apify.ts`, `types.ts`, `radar/runRadar.ts`, `radar/collectData.ts`, `radar/scoreHype.ts`, `radar/embeddings.ts`, `canvas/buildGraph.ts`, `fabric/fork.ts`.

**API (`app/api/`):** `generate/`, `reports/[slug]/`, `radar/run/`, `radar/drops/`, `briefing-assistant/`, `fabric/rebuild/`.

**Frontend (`app/`):** `dashboard/` (hub, `new`, `[slug]`, `radar`, `mapa/[marca]`, `admin/*`), `r/[slug]` (público), `console/` (ACID).

**Docs de planejamento:** `PLANO_ACID_FABRIC.md`, `PLANO_FASE1.md`, `README.md`, `sites.md`.

# Plano — Acid Fabric (white-label multi-tenant)

Documento de arquitetura. Decisões de desenho, ainda NÃO codadas. Aguardando go por fase.
Continuação natural do `PLANO_FASE1.md` (aquele é o composto de lanes do radar; este é a
virada de produto single-tenant para plataforma licenciada).

## Contexto e objetivo

Hoje a ferramenta é um app single-tenant construído para a agência cccaramelo. O objetivo é
virar **Acid Fabric**: um produto da ACID Tech, administrado pela ACID, e **licenciado** para
terceiros (estúdio, agência, holding, empresa). Cada licenciado tem branding próprio, perfil
criativo próprio, e monitora as marcas dos seus próprios clientes. A ACID controla chaves,
custo, créditos, planos e módulos de forma central.

O que NÃO muda: o motor de inteligência (metodologia, busca adjacente, anti-fabricação).
Isso é o produto, é da ACID, e é o que está sendo licenciado.

## Terminologia (travada)

- **tenant** = o cliente da ACID (estúdio / agência / holding / empresa). No banco: `tenant_id`.
  O "tipo" é um campo, não muda o schema. NÃO chamar de "agência" no schema (dívida técnica se
  vender pra um cliente direto) nem de "cliente" (colide com `marcas`).
- **marca** = a marca que um tenant monitora (o cliente *dele*). Continua sendo `marcas`.
  O YAML da marca é subido **pela agência/tenant**, não pela ACID.
- Hierarquia: `tenant` → tem 1 perfil criativo → monitora N `marcas`.
- Folga futura (NÃO construir agora): holding com sub-contas = `parent_tenant_id` opcional.

## Arquitetura de prompt em 3 camadas

O código atual mistura três coisas no mesmo prompt. Separá-las é o coração da virada.

### Camada 1 — Motor ACID (MACRO, fixo, NÃO customizável)
É o "drive cultural": a metodologia que É o produto. Hoje está rotulada "cccaramelo" mas o
conteúdo é IP da ACID. Onde vive:
- `CAMADA_CCCARAMELO` em `lib/radar/radarPrompt.ts` (curadoria, "rejeite o óbvio", olhar de planner).
- Framing de analista, sinais fracos vs fortes, trava anti-fabricação, regra do travessão em `lib/systemPrompt.ts`.
- A **busca adjacente / entorno** em `lib/generateReport.ts` (`DERIVE_SYSTEM`, lane `adjacent`). É o diferencial da busca.
- "Permissão cultural" em `radarPrompt.ts` (`buildCamadaMarca`).

Governança: **camada 1 é travada e propriedade da ACID.** Nenhum tenant edita. Editar isso =
diluir o produto licenciado.

### Camada 2 — Perfil criativo do tenant (por tenant, customizável mas bounded)
A *lente* que a agência traz. Vem de `tenants.perfil_criativo` (jsonb). É lente de leitura, NÃO
pode sobrescrever a metodologia nem a trava anti-fabricação da camada 1. É aqui que o tenant
injeta o ponto de vista dele, e é o que depois cruza com as marcas dele.

### Camada 3 — DNA da marca (por marca, dinâmico, FONTE ÚNICA)
Produto, tom, perfil comportamental, universos culturais, o que evitar, pilares. Vem de
`marcas.yaml_conhecimento` (jsonb). **Fonte única de verdade de marca**, usada por radar E report.

### Regra de governança (resposta curta)
O drive (camada 1) é macro e travado. Só as camadas 2 e 3 são customizáveis. O cliente
customiza o perfil dele e as marcas dele, nunca o motor.

## Fonte única de marca (report bebe do mesmo YAML do radar)

Hoje há duas fontes de "verdade de marca", que divergem:
- **Radar**: lê `marcas.yaml_conhecimento` (dinâmico, subido pela agência). Certo.
- **Report**: `reports.cliente` é texto livre + `VIVO_KNOWLEDGE` hardcoded + briefing ad-hoc. Errado.

Alvo: `marcas.yaml_conhecimento` é a fonte única. O report:
1. Passa a ter `marca_id` (FK). Report é gerado PARA uma marca do tenant.
2. Carrega o YAML dessa marca como camada 3 (DNA), igual o radar já faz.
3. O briefing do report vira só a camada **situacional** (o que aconteceu nesta edição: evento,
   contexto, tom desejado do post, memes vistos, objetivo). Não repete o DNA persistente.

Benefícios: a agência mantém o DNA num lugar só; radar e report ficam em sincronia; `cliente`
deixa de ser texto livre e vira FK real (conserta linhagem de dado pra tenancy e metering).

## Modelo de dados

### Tabelas existentes (schema atual confirmado)
- `reports` (id, slug, user_id, cliente TEXT, briefing jsonb, report jsonb, status, error_message, created_at). RLS: owner por `user_id` + `public_read using(true)`.
- `marcas` (id, nome, yaml_conhecimento jsonb, status_varredura, intervalo_horas, ultima_varredura, created_at). RLS: `auth_only`.
- `trends_radar` (marca_id FK, insight_titulo, categoria_funil, status_hype, indice_hype, descricao_fato, gancho_produto, **insight_criativo_cccaramelo** ⚠, links_fontes[], scores, created_at). RLS: `auth_only`.
- `radar_runs` (marca_id FK, sinais_captados, sinais_novos, drops_gerados, modelo, status, created_at). RLS: `auth_only`.
- `radar_raw_data` (marca_id FK, fonte, conteudo, url, metadata jsonb, embedding vector(1024), created_at) + fn `match_radar_signals`. RLS: `auth_only`.
- `report_audit` (report_id, slug, cliente, action, changed_by, changed_by_email, status_before/after, report_before/after, created_at). RLS: authenticated read.
- `app_admins` (email PK, added_by, created_at) + fn `is_app_admin()`. Seed `zampoli@cccaramelo.com`.

### Novas tabelas
- **`tenants`**: id, nome, tipo (studio|agency|holding|company), status, cnpj, endereco (jsonb), cobranca (jsonb), branding (jsonb: logo, cores, fonte), perfil_criativo (jsonb — camada 2), seats int, parent_tenant_id (nullable, futuro), created_at.
- **`tenant_users`**: tenant_id, user_id, role (admin|editor|viewer), created_at. UNIQUE(tenant_id, user_id). Enforce teto de `seats`.
- **`tenant_modulos`**: tenant_id, modulo (radar|reports|dados_semanticos), ativo bool. Módulos = "apps" do Acid Fabric (analogia Adobe).
- **`assinaturas`**: id, tenant_id, plano_tipo (mensal|trimestral|semestral|anual), data_inicio, data_fim (derivada do tipo), auto_renovacao bool, status (ativa|expirada|cancelada), created_at. Histórico de renovações.
- **`creditos_ledger`**: id, tenant_id, delta int (+recarga / -consumo), motivo (report|radar_run|recarga|ajuste), ref_id, saldo_after, created_at. Saldo = soma (ou cache em `tenants.saldo_creditos`).
- **`acid_admins`**: super-admin ACID (staff), sobre todos os tenants. Substitui/estende `app_admins`. Distinto de admin de tenant (`tenant_users.role='admin'`).

### `tenant_id` nas tabelas existentes
Adicionar `tenant_id` em: `reports`, `marcas`, `report_audit`. As tabelas de radar
(`trends_radar`, `radar_runs`, `radar_raw_data`) penduram em `marca_id`, então herdam tenant via
marca; mas denormalizar `tenant_id` nelas evita join dentro da policy de RLS (mais rápido e
direto). Decisão: denormalizar.
Adicionar `marca_id` em `reports` (ver "fonte única").

### Backfill
Criar tenant "Caramelo" (tipo=agency) e setar `tenant_id` de tudo que existe hoje pra ele.
Caramelo vira o tenant #1 e serve de simulação com dado real, não mock.

## RLS (Fase 2 — a fronteira de isolamento real)

- `tenant_id` nas custom claims do JWT (Supabase Auth suporta nativamente).
- Trocar `auth.role() = 'authenticated'` / `auth.uid() = user_id` por
  `tenant_id = (auth.jwt() ->> 'tenant_id')::uuid` nas tabelas de dado.
- Super-admin ACID: bypass via `is_acid_admin()` (mesmo padrão de `is_app_admin()`).
- `public_read` de report: manter, mas escopar a `status='published'` + acesso por slug.

## Auth

Fica no **Supabase Auth** (já em uso). NÃO adicionar Auth0/Clerk: brigaria com o modelo de RLS.
Falta o **fluxo**, não a plataforma:
1. Signup/convite (ACID ou admin do tenant convida por e-mail, dentro do teto de seats).
2. Ligar provider Google (toggle no painel Supabase + credencial Google Cloud).
3. Amarrar usuário ao `tenant_id` no convite (conecta com claims da Fase 2).

## Fabric Lake vetorial (Fase 5 — deixar o gancho, ligar depois)

Data lake cross-tenant de inteligência ACID. pgvector já está em uso (`radar_raw_data.embedding`
vector(1024), voyage-3, hnsw + `match_radar_signals`), então a infra de vetor existe por marca.
- Separação física: camada operacional (por tenant, RLS, com nomes) vs camada de inteligência
  (cross-tenant, derivada, sem identidade) em schema separado (`fabric_lake`). Nunca a mesma tabela.
- Pipeline de de-identificação: NER pra remover entidades + cuidado com singularização (não basta
  tirar o nome). Só armazenar sinal cultural/semântico + metadados neutros.
- Base contratual: direito de uso derivado no contrato de licença (Enterprise). Não ligar em silêncio.
- Três níveis de risco: RAG intra-tenant (baixo) → inteligência cross-tenant (médio, precisa
  contrato + de-id) → revender agregado (alto).
- ⚠ Validação de LGPD e linguagem contratual são externas (DPO/jurídico). O código só habilita.

## Limpezas de nome (leaks "cccaramelo" no motor)

- Renomear `CAMADA_CCCARAMELO` → algo tipo `MOTOR_ACID` e neutralizar "cccaramelo" nos prompts.
  A persona do motor no prompt é ACID/neutra, NÃO o nome do tenant.
- Coluna `trends_radar.insight_criativo_cccaramelo` tem o nome do cliente no schema. Renomear.
- Naming de UI/branding (`Logo.tsx`, `layout.tsx`, style-guide) vira dinâmico via `tenants.branding`.

## Compatibilidade (RESTRIÇÃO DURA: não quebrar o que já existe)

Requisito inegociável: os motores existentes (radar, mapa semântico, vetores, geração de
report) precisam continuar funcionando durante e depois da virada. Como isso é garantido:

1. **Só mudanças aditivas.** Colunas novas entram como nullable, faz-se o backfill Caramelo, e
   só então se aplica constraint/NOT NULL. Código existente ignora coluna nova. Nunca destrutivo.
2. **Tudo que existe hoje vira o tenant Caramelo (backfill).** Do ponto de vista do app, mesmo
   dado, mesmo comportamento, só passa a ter `tenant_id`. Zero mudança de comportamento.
3. **Motores isolados das partes arriscadas (verificado).** `lib/radar/*` não importa
   `systemPrompt`/`VIVO_KNOWLEDGE`/`generateReport`. `lib/canvas/buildGraph.ts` (mapa semântico)
   importa só `radar/embeddings` + `types`. Vetores (`radar_raw_data.embedding`,
   `match_radar_signals`, voyage) e o radar seguem intactos. WI-0 mexe SÓ no caminho do report
   (`systemPrompt.ts`, `generateReport.ts`, rota de geração).
4. **Conhecimento da Vivo MOVE, não some.** A des-Vivo-ificação migra o bloco `VIVO_KNOWLEDGE`
   hardcoded para o `yaml_conhecimento` de uma marca Vivo. O report da Vivo continua com a mesma
   qualidade (agora lendo da marca); só destrava as outras marcas. Não é deletar, é realocar.
5. **RLS é o único passo sensível, sequenciado com cuidado:** backfill → popular claim
   `tenant_id` no JWT → policy transitória (casa tenant OU é acid admin) → validar com Caramelo →
   só então apertar. Nunca virar a policy antes de claim + backfill existirem (senão query sem
   claim volta zero linha).
6. **Portão de verificação por fase.** Rodar build completo + lint (não só `tsc`, Vercel erra em
   any explícito) e smoke test funcional de: 1 run de radar, 1 geração de report, o mapa
   semântico e uma busca vetorial, ANTES de seguir pra próxima fase.

## Itens de trabalho e fases

### WI-0 — Des-Vivo-ificação + fonte única (STANDALONE, pode vir antes da tenancy)
É pré-requisito antes de vender pro 2º tenant, e é independente da migração de tenancy.
- **Mover** (não deletar) `VIVO_KNOWLEDGE` para o `yaml_conhecimento` de uma marca Vivo, e tirar
  o hardcoded de `systemPrompt.ts` / `generateReport.ts` (linha ~252). Report da Vivo mantém qualidade.
- PILARES DE PRODUTO passam a vir do YAML da marca, não hardcoded.
- `reports` ganha `marca_id`; geração carrega `marcas.yaml_conhecimento` como camada 3.
- Briefing do report vira só situacional. `cor_marca` vem da marca.

### Fase 1 — Camada de tenancy
Tabelas `tenants`, `tenant_users`; `tenant_id` em reports/marcas/report_audit (+ denormalizado no
radar); backfill Caramelo.

### Fase 2 — RLS + identidade
Claims de `tenant_id`, reescrever policies, split super-admin ACID vs admin de tenant.

### Fase 3 — Créditos / metering
`creditos_ledger`, débito nos entrypoints de custo (report + cron do radar), enforcement por plano
(nº de marcas, intervalo_horas mínimo, reports/mês).

### Fase 4 — Console master ACID + painel do cliente + branding
`tenant_modulos`, `assinaturas`, seats, roles, cadastro/cobrança. Console ACID (provisiona +
observa consumo). Painel do cliente (branding, users no teto de seats, consumo). Branding dinâmico.

### Fase 5 — Fabric Lake vetorial
Só depois de tenancy + créditos + console, e com volume de tenants. Ver seção acima.

Ordem: **WI-0 → Fase 1 + 2 (juntas, schema sem RLS é inseguro) → 3 → 4 → 5.**

## Restrições permanentes (herdadas do PLANO_FASE1)

- Usuário faz TODO git commit/push. Eu aplico migrations/SQL via Supabase MCP.
- Eu NÃO insiro credenciais. `gh` CLI não instalado local.
- Preferir arquivos novos pra features novas.
- ESTILO: evitar em-dash ("—") em texto/prosa gerada (parece IA).
- NUNCA fabricar trend/fato sem dado raspado real por trás.
- Supabase project id: `quwivphvruvgbjksprks` (TrendReport).

# trends-agent

Ferramenta interna da cccaramelo: cole um briefing em YAML, gere um relatório visual de tendências e compartilhe o link público com o cliente. Sem PDF, sem Figma, sem envio de arquivo — o cliente só abre o link.

> **Titularidade e operação:** a plataforma é desenvolvida e operada por **The Acid Times** (CNPJ 36.458.402/0001-81). Os clientes (ex. cccaramelo/Caramelo) licenciam o uso; a titularidade do software permanece com a The Acid Times. Os Termos e Condições de Uso ficam em `/termos` e são aceitos pelo usuário no primeiro login (ver `lib/legal.ts`).

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Auth email/senha + Postgres)
- Anthropic API (`@anthropic-ai/sdk`, modelo `claude-sonnet-4-6`)
- Apify (coleta de dados: Instagram, TikTok, Twitter, Google News)

## Setup local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie o arquivo de variáveis de ambiente e preencha os valores:

   ```bash
   cp .env.local.example .env.local
   ```

   - `ANTHROPIC_API_KEY` — chave da API da Anthropic.
   - `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` — em Supabase → Project Settings → API.
   - `APIFY_TOKEN` — em Apify → Settings → Integrations.

3. Crie o projeto no [Supabase](https://supabase.com) e rode a migration em `supabase/migrations/0001_create_reports.sql` (via SQL Editor do painel ou `supabase db push`).

4. Rode o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Acesse `http://localhost:3000`.

## Criando um usuário (não há cadastro público)

O login é restrito à equipe da cccaramelo. Para criar um acesso:

1. No painel do Supabase, vá em **Authentication → Users → Add user**.
2. Preencha email e senha e marque **Auto Confirm User**.
3. Compartilhe as credenciais com a pessoa da equipe — ela já pode logar em `/login`.

## Deploy (Vercel)

1. Importe o repositório no [Vercel](https://vercel.com/new).
2. Configure as mesmas variáveis de ambiente do `.env.local` em **Project Settings → Environment Variables**.
3. Deploy. O middleware protege automaticamente todas as rotas `/dashboard/*`; a rota `/r/[slug]` permanece pública.

## Fluxo de uso

1. Logue em `/login`.
2. Em `/dashboard`, clique em **NOVO REPORT +**.
3. Cole o briefing em YAML e clique em **GERAR RELATÓRIO →**.
4. O relatório é gerado (coleta via Apify + análise via Claude) e salvo no Supabase.
5. Copie o link público (`/r/[slug]`) e envie ao cliente — não é necessário login para visualizá-lo.

-- AVISOS DO SUPABASE (SEGURANÇA E PERFORMANCE)
--
-- Fecha os avisos do linter do Supabase de 18/11/2026 que dá pra resolver sem
-- mudar comportamento. Nada aqui muda quem vê o quê: as policies reescritas têm
-- exatamente a mesma regra, só avaliada de outro jeito.
--
-- 1. search_path fixo em 6 funções. Sem isso, a função resolve nome de tabela
--    pelo search_path de quem chama, e um schema criado na frente do public
--    poderia trocar a tabela que ela lê. As duas que mais importam são
--    custom_access_token_hook e jwt_tenant_id: são elas que carimbam e leem o
--    tenant do usuário no JWT. `public` fica no caminho porque as funções usam
--    tabelas e o tipo/operadores do pgvector sem prefixo de schema.

alter function public.custom_access_token_hook(jsonb)                                   set search_path = public, pg_temp;
alter function public.jwt_tenant_id()                                                   set search_path = public, pg_temp;
alter function public.match_radar_signals(uuid, vector, integer, double precision)       set search_path = public, pg_temp;
alter function public.match_radar_signals_batch(uuid, vector[], double precision)       set search_path = public, pg_temp;
alter function public.radar_client_summary(uuid, text)                                  set search_path = public, pg_temp;
alter function public.radar_daily_metrics(uuid, integer)                                set search_path = public, pg_temp;

-- 2. auth.uid() e jwt_tenant_id() dentro de (select ...). Escrito direto, o
--    Postgres recalcula a função para cada linha; dentro de um select, calcula
--    uma vez por consulta. A regra é a mesma. alter policy mantém o comando e
--    os papéis de cada policy como estão.

alter policy "owner" on public.reports
  using ((select auth.uid()) = user_id);

alter policy "collaborators insert" on public.reports
  with check ((select auth.uid()) = user_id);

alter policy "tenant_isolation" on public.tenant_users
  using (
    tenant_id = (select public.jwt_tenant_id())
    or user_id = (select auth.uid())
    or (select public.is_acid_admin())
  )
  with check (
    tenant_id = (select public.jwt_tenant_id())
    or (select public.is_acid_admin())
  );

-- 3. Índice nas duas chaves estrangeiras sem índice. Apagar um usuário ou um
--    tenant pai varria a tabela inteira para checar a referência.

create index if not exists reports_user_id_idx         on public.reports (user_id);
create index if not exists tenants_parent_tenant_id_idx on public.tenants (parent_tenant_id);

-- Fora daqui, de propósito:
--   - pgvector no schema public: mover a extensão mexe no tipo de colunas e
--     funções em uso. Risco alto para um aviso de baixo impacto.
--   - funções SECURITY DEFINER chamáveis por usuário logado: as sensíveis checam
--     is_acid_admin() ou o tenant por dentro; o acesso é intencional.
--   - proteção contra senha vazada: é um ajuste do painel (Auth), não SQL.

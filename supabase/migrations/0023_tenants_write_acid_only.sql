-- Antes: policy unica `tenant_isolation` FOR ALL usava
--   using/with_check = (id = jwt_tenant_id() OR is_acid_admin())
-- Isso deixava um usuario COMUM do tenant dar UPDATE na propria linha de
-- `tenants` via PostgREST PATCH (incluindo saldo_creditos/seats/status) ->
-- vetor de fabricacao de credito e escalacao de privilegio.
--
-- Depois: leitura continua aberta (self-read do tenant OU ACID); qualquer
-- escrita (INSERT/UPDATE/DELETE) exige is_acid_admin(). Nenhum code path
-- depende de tenant escrever a propria linha (provisionamento/edicao passam
-- pelo console ACID). Aditivo e seguro.
drop policy if exists tenant_isolation on public.tenants;

create policy tenants_select on public.tenants
  for select
  using ((id = jwt_tenant_id()) or is_acid_admin());

create policy tenants_write on public.tenants
  for all
  using (is_acid_admin())
  with check (is_acid_admin());

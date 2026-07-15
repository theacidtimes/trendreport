-- FASE 2 — RLS + identidade (versão TRANSITÓRIA).
--
-- Isolamento por tenant nas tabelas de dado + hook que injeta `tenant_id` no JWT
-- + super-admin ACID. É a fronteira de isolamento real entre tenants.
--
-- POR QUE TRANSITÓRIA: toda policy carrega o escape `jwt_tenant_id() is null`.
-- Enquanto o Custom Access Token Hook não estiver ligado no dashboard (e o
-- usuário não tiver pego um token novo via re-login), o claim `tenant_id` não
-- existe → o escape mantém o acesso como antes (nada trava). Depois de validar
-- que o claim está populado pra todo mundo, um segundo migration (aperto) remove
-- o escape e o isolamento passa a ser estrito. Sequência validada em transação
-- com ROLLBACK contra o schema real (cada tenant vê só o seu; anon só published;
-- sem claim vê tudo; acid_admin vê tudo).
--
-- Nota: writes do radar rodam via service_role (GitHub Actions), que BYPASSA RLS
-- — essas policies não afetam a coleta/geração.

-- ── super-admin ACID (staff da ACID, sobre todos os tenants) ──
create table acid_admins (
  email      text primary key,
  added_by   text,
  created_at timestamptz not null default now()
);
alter table acid_admins enable row level security;
-- Bootstrap: quem já era app_admin vira acid_admin (é a ACID operando o produto).
insert into acid_admins (email, added_by)
  select email, 'bootstrap: app_admins' from app_admins
  on conflict (email) do nothing;

create or replace function public.is_acid_admin()
  returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.acid_admins where email = (auth.jwt() ->> 'email')
  );
$$;

create policy "acid admin read" on acid_admins
  for select to authenticated using (public.is_acid_admin());

-- ── helper: tenant_id do JWT (null quando o claim ainda não existe) ──
create or replace function public.jwt_tenant_id()
  returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'tenant_id', '')::uuid;
$$;

-- ── Custom Access Token Hook: injeta tenant_id + tenant_role no JWT ──
-- Precisa ser LIGADO no dashboard (Authentication → Hooks → Customize Access
-- Token) apontando pra esta função. Sem isso, o claim não é emitido.
create or replace function public.custom_access_token_hook(event jsonb)
  returns jsonb language plpgsql stable as $$
declare
  claims      jsonb := event -> 'claims';
  v_tenant_id uuid;
  v_role      text;
begin
  select tu.tenant_id, tu.role into v_tenant_id, v_role
  from public.tenant_users tu
  where tu.user_id = (event ->> 'user_id')::uuid
  order by tu.created_at asc
  limit 1;

  if v_tenant_id is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id::text));
    claims := jsonb_set(claims, '{tenant_role}', to_jsonb(coalesce(v_role, 'editor')));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- O hook roda sob o role supabase_auth_admin; ele precisa executar a função e
-- ler tenant_users (com policy própria, sem depender de claim).
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on public.tenant_users to supabase_auth_admin;

-- ── policies por tabela ────────────────────────────────────
-- Padrão transitório: enxerga/escreve se casa o tenant do claim, OU o claim
-- ainda não existe (transição), OU é super-admin ACID.

-- tenants: cada um vê/edita o próprio; acid_admin vê todos.
drop policy "auth_only" on tenants;
create policy "tenant_isolation" on tenants for all to authenticated
  using (id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin())
  with check (id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin());

-- tenant_users: o usuário vê a própria associação / a do seu tenant.
drop policy "auth_only" on tenant_users;
create policy "tenant_isolation" on tenant_users for all to authenticated
  using (tenant_id = public.jwt_tenant_id() or user_id = auth.uid() or public.jwt_tenant_id() is null or public.is_acid_admin())
  with check (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin());
-- o hook (supabase_auth_admin) precisa ler tenant_users direto.
create policy "auth_admin_read" on tenant_users for select to supabase_auth_admin using (true);

-- marcas + tabelas de radar (denormalizadas com tenant_id).
drop policy "auth_only" on marcas;
create policy "tenant_isolation" on marcas for all to authenticated
  using (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin())
  with check (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin());

drop policy "auth_only" on trends_radar;
create policy "tenant_isolation" on trends_radar for all to authenticated
  using (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin())
  with check (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin());

drop policy "auth_only" on radar_runs;
create policy "tenant_isolation" on radar_runs for all to authenticated
  using (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin())
  with check (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin());

drop policy "auth_only" on radar_raw_data;
create policy "tenant_isolation" on radar_raw_data for all to authenticated
  using (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin())
  with check (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin());

drop policy "auth_only" on radar_scrape_jobs;
create policy "tenant_isolation" on radar_scrape_jobs for all to authenticated
  using (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin())
  with check (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin());

-- reports: leitura pública SÓ de published (mantém o "copy do link" pro cliente
-- sem conta); time logado lê os reports do seu tenant. Substitui o antigo
-- public_read=true (que expunha até rascunho por slug).
drop policy "public_read" on reports;
create policy "published_anon_read" on reports for select to anon
  using (status = 'published');
create policy "tenant_read" on reports for select to authenticated
  using (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin());

-- update/delete passam a respeitar o tenant (o antigo delete era `using true`).
drop policy "collaborators delete" on reports;
create policy "collaborators delete" on reports for delete to authenticated
  using (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin());

drop policy "collaborators curation update" on reports;
create policy "collaborators curation update" on reports for update to authenticated
  using (
    status = any (array['ready','published'])
    and (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin())
  )
  with check (
    status = any (array['ready','published'])
    and (tenant_id = public.jwt_tenant_id() or public.jwt_tenant_id() is null or public.is_acid_admin())
  );

-- Fase 4E: branding dinamico no chrome. RPC de leitura da PROPRIA marca do
-- tenant da sessao (jwt_tenant_id), numa chamada, sem expor os demais tenants
-- (um SELECT direto em tenants por um acid_admin traria TODOS). Alimenta o
-- Logo do rail/topbar no client. Fallback fica no componente (marca vazia -> ACID).
create or replace function public.meu_branding()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(branding, '{}'::jsonb)
  from tenants
  where id = public.jwt_tenant_id();
$$;

-- Mesmo gotcha do Supabase: revoga do publico/anon e re-concede so a authenticated.
revoke execute on function public.meu_branding() from public, anon;
grant  execute on function public.meu_branding() to authenticated;

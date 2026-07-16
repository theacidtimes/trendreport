-- Enforcement de MODULO. Ate aqui `tenant_modulos.ativo` (radar|reports|
-- dados_semanticos) era so registro no console: um tenant que NAO assinou um
-- modulo ainda conseguia usar a feature. Esta RPC devolve os modulos ATIVOS do
-- PROPRIO tenant da sessao numa chamada (mesmo padrao do meu_branding/
-- meu_tenant_status: resolve por jwt_tenant_id, sem trazer os demais tenants pro
-- acid_admin). Alimenta o guard das rotas de feature (radar/mapa/novo report),
-- o filtro do rail (Sidebar) e o pre-voo do /api/generate. O radar (service_role,
-- bypassa RLS) checa tenant_modulos direto no batch.
create or replace function public.meus_modulos()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(modulo), '{}')
  from tenant_modulos
  where tenant_id = public.jwt_tenant_id() and ativo = true;
$$;

-- Mesmo gotcha do Supabase: revoga do publico/anon e re-concede so a authenticated.
revoke execute on function public.meus_modulos() from public, anon;
grant  execute on function public.meus_modulos() to authenticated;

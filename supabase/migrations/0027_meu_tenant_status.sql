-- Enforcement de status do tenant. Ate aqui `status` (ativo|suspenso|cancelado)
-- era so um rotulo no console: nada barrava o uso quando um tenant era suspenso
-- ou cancelado. Esta RPC devolve o status do PROPRIO tenant da sessao numa
-- chamada (mesmo padrao do meu_branding: evita que um SELECT direto em tenants
-- por um acid_admin traga TODOS, e da uma leitura sem ambiguidade). Alimenta o
-- guard do workspace (app/dashboard/layout.tsx) e o pre-voo do /api/generate.
create or replace function public.meu_tenant_status()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select status
  from tenants
  where id = public.jwt_tenant_id();
$$;

-- Mesmo gotcha do Supabase: revoga do publico/anon e re-concede so a authenticated.
revoke execute on function public.meu_tenant_status() from public, anon;
grant  execute on function public.meu_tenant_status() to authenticated;

-- Fase 4D: self-service de marca pelo tenant (painel do cliente).
-- Como a policy tenants_write (0023) e ACID-only, o tenant NAO pode dar PATCH
-- direto na propria linha de tenants (isso fecharia a via de fabricar credito
-- via saldo_creditos/seats/status). Esta RPC ESTREITA permite ao ADMIN do
-- tenant editar SOMENTE branding/perfil_criativo do PROPRIO tenant, nunca os
-- campos sensiveis. Gate: is_acid_admin() OU admin (tenant_users.role='admin')
-- do tenant corrente (jwt_tenant_id).
create or replace function public.atualizar_branding(
  p_branding jsonb,
  p_perfil_criativo jsonb default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.jwt_tenant_id();
begin
  if v_tenant is null then
    raise exception 'Sem tenant no contexto da sessao.';
  end if;
  if not public.is_acid_admin() then
    if not exists (
      select 1 from tenant_users
      where tenant_id = v_tenant
        and user_id = auth.uid()
        and role = 'admin'
    ) then
      raise exception 'Apenas administradores do tenant podem editar a marca.';
    end if;
  end if;
  update tenants
     set branding = coalesce(p_branding, branding),
         perfil_criativo = coalesce(p_perfil_criativo, perfil_criativo)
   where id = v_tenant;
end;
$$;

-- Gotcha do Supabase: ALTER DEFAULT PRIVILEGES concede EXECUTE direto a
-- anon/authenticated em toda funcao nova. Revoga do publico/anon e re-concede
-- so a authenticated (a trava de admin do tenant e por dentro).
revoke execute on function public.atualizar_branding(jsonb, jsonb) from public, anon;
grant  execute on function public.atualizar_branding(jsonb, jsonb) to authenticated;

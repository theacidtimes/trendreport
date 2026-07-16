-- Self-service de membros pelo ADMIN DO TENANT (dentro do workspace), espelhando
-- as RPCs acid_* do console (0026) mas com uma diferença de segurança central:
-- estas NÃO recebem p_tenant. O tenant é SEMPRE resolvido de jwt_tenant_id(), e a
-- trava é `is_acid_admin() OR (é admin do próprio tenant)`. Assim um admin de
-- tenant nunca alcança outro tenant, nem por engano nem por payload forjado.
--
-- Divisão de posse: a ACID vende o TETO de seats (console), o admin do tenant
-- PREENCHE os seats até o teto (aqui). O teto em si (tenants.seats) segue
-- ACID-only pela policy tenants_write (0023) — o tenant não amplia o próprio.

-- Helper de gate: admin do tenant da sessão (ou super-admin ACID).
create or replace function public.sou_admin_do_meu_tenant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_acid_admin() or exists (
    select 1 from tenant_users
    where tenant_id = public.jwt_tenant_id()
      and user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- ─── Listar membros do PRÓPRIO tenant (com email) ─────────
create or replace function public.meus_usuarios()
returns table(user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.jwt_tenant_id();
begin
  if not public.sou_admin_do_meu_tenant() then
    raise exception 'Apenas administradores do tenant podem listar usuarios.';
  end if;
  return query
    select tu.user_id, u.email::text, tu.role, tu.created_at
    from tenant_users tu
    join auth.users u on u.id = tu.user_id
    where tu.tenant_id = v_tenant
    order by
      case tu.role when 'admin' then 0 when 'editor' then 1 else 2 end,
      u.email;
end;
$$;

-- ─── Definir papel de um membro do PRÓPRIO tenant ─────────
create or replace function public.meu_tenant_definir_papel(
  p_user uuid, p_role text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.jwt_tenant_id();
  v_era_admin boolean;
  v_seats int;
  v_usados int;
  v_admins int;
begin
  if not public.sou_admin_do_meu_tenant() then
    raise exception 'Apenas administradores do tenant podem gerenciar usuarios.';
  end if;
  if p_role not in ('admin','editor','viewer') then
    raise exception 'Papel invalido (admin|editor|viewer).';
  end if;

  select (role = 'admin') into v_era_admin
  from tenant_users where tenant_id = v_tenant and user_id = p_user;

  if not found then
    -- Novo membro: checa teto de seats (vendido pela ACID).
    select seats into v_seats from tenants where id = v_tenant;
    select count(*) into v_usados from tenant_users where tenant_id = v_tenant;
    if v_seats is not null and v_usados >= v_seats then
      raise exception 'Teto de seats atingido (% de %). Fale com a ACID para ampliar o plano.', v_usados, v_seats;
    end if;
    insert into tenant_users (tenant_id, user_id, role) values (v_tenant, p_user, p_role);
  else
    -- Rebaixando o unico admin? Bloqueia pra nao orfanar o tenant.
    if v_era_admin and p_role <> 'admin' then
      select count(*) into v_admins from tenant_users
        where tenant_id = v_tenant and role = 'admin';
      if v_admins <= 1 then
        raise exception 'Este e o unico admin do tenant. Promova outro antes de rebaixar.';
      end if;
    end if;
    update tenant_users set role = p_role
      where tenant_id = v_tenant and user_id = p_user;
  end if;
end;
$$;

-- ─── Remover membro do PRÓPRIO tenant ─────────────────────
create or replace function public.meu_tenant_remover_membro(
  p_user uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid := public.jwt_tenant_id();
  v_era_admin boolean;
  v_admins int;
begin
  if not public.sou_admin_do_meu_tenant() then
    raise exception 'Apenas administradores do tenant podem gerenciar usuarios.';
  end if;

  select (role = 'admin') into v_era_admin
  from tenant_users where tenant_id = v_tenant and user_id = p_user;
  if not found then
    return; -- ja nao e membro; no-op
  end if;

  if v_era_admin then
    select count(*) into v_admins from tenant_users
      where tenant_id = v_tenant and role = 'admin';
    if v_admins <= 1 then
      raise exception 'Este e o unico admin do tenant. Promova outro antes de remover.';
    end if;
  end if;

  delete from tenant_users where tenant_id = v_tenant and user_id = p_user;
end;
$$;

-- Mesmo gotcha do Supabase: revoga do publico/anon e re-concede so a authenticated
-- (a trava real e o sou_admin_do_meu_tenant() por dentro de cada uma).
revoke execute on function public.sou_admin_do_meu_tenant() from public, anon;
revoke execute on function public.meus_usuarios() from public, anon;
revoke execute on function public.meu_tenant_definir_papel(uuid, text) from public, anon;
revoke execute on function public.meu_tenant_remover_membro(uuid) from public, anon;
grant  execute on function public.sou_admin_do_meu_tenant() to authenticated;
grant  execute on function public.meus_usuarios() to authenticated;
grant  execute on function public.meu_tenant_definir_papel(uuid, text) to authenticated;
grant  execute on function public.meu_tenant_remover_membro(uuid) to authenticated;

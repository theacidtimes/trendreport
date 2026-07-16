-- FASE 4 (console) — Gerenciamento de usuarios/seats dos tenants pela ACID.
--
-- Um tenant recem-provisionado nasce sem nenhum usuario: o provisionar_tenant
-- so cria tenants/modulos/assinatura/saldo, nunca toca em tenant_users. Ate ter
-- um usuario com tenant_id no token (via custom_access_token_hook, que le
-- tenant_users), o tenant e inutilizavel. Estas 3 RPCs dao a ACID o controle
-- de quem pertence a cada tenant, direto do console, sem editar a tabela na mao.
--
-- Todas SECURITY DEFINER e travadas em is_acid_admin() por dentro (nao confiam
-- no RLS pra autorizar). Guardas: teto de seats no INSERT, ultimo-admin no
-- rebaixamento e na remocao (nao orfanar o tenant).

-- ─── Listar membros (com email de auth.users) ─────────────
create or replace function public.acid_tenant_usuarios(p_tenant uuid)
returns table(user_id uuid, email text, role text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_acid_admin() then
    raise exception 'Apenas o super-admin da ACID pode listar usuarios de tenants.';
  end if;
  return query
    select tu.user_id, u.email::text, tu.role, tu.created_at
    from tenant_users tu
    join auth.users u on u.id = tu.user_id
    where tu.tenant_id = p_tenant
    order by
      case tu.role when 'admin' then 0 when 'editor' then 1 else 2 end,
      u.email;
end;
$$;

-- ─── Definir papel (adiciona OU atualiza) ─────────────────
create or replace function public.acid_definir_papel(
  p_tenant uuid, p_user uuid, p_role text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existe boolean;
  v_era_admin boolean;
  v_seats int;
  v_usados int;
  v_admins int;
begin
  if not public.is_acid_admin() then
    raise exception 'Apenas o super-admin da ACID pode gerenciar usuarios.';
  end if;
  if p_role not in ('admin','editor','viewer') then
    raise exception 'Papel invalido (admin|editor|viewer).';
  end if;

  select true, (role = 'admin') into v_existe, v_era_admin
  from tenant_users where tenant_id = p_tenant and user_id = p_user;

  if not found then
    -- Novo membro: checa teto de seats.
    select seats into v_seats from tenants where id = p_tenant;
    select count(*) into v_usados from tenant_users where tenant_id = p_tenant;
    if v_seats is not null and v_usados >= v_seats then
      raise exception 'Teto de seats atingido (% de %). Amplie o plano antes de adicionar usuarios.', v_usados, v_seats;
    end if;
    insert into tenant_users (tenant_id, user_id, role) values (p_tenant, p_user, p_role);
  else
    -- Rebaixando o unico admin? Bloqueia pra nao orfanar o tenant.
    if v_era_admin and p_role <> 'admin' then
      select count(*) into v_admins from tenant_users
        where tenant_id = p_tenant and role = 'admin';
      if v_admins <= 1 then
        raise exception 'Este e o unico admin do tenant. Promova outro antes de rebaixar.';
      end if;
    end if;
    update tenant_users set role = p_role
      where tenant_id = p_tenant and user_id = p_user;
  end if;
end;
$$;

-- ─── Buscar usuario existente por email ───────────────────
-- Resolve email -> user_id contra auth.users (nao exposto pelo PostgREST). Serve
-- pro fluxo "adicionar usuario": se o email ja tem conta, anexamos ao tenant;
-- se nao, o server action cria a conta via Admin API. is_acid_admin gated.
create or replace function public.acid_buscar_usuario(p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_acid_admin() then
    raise exception 'Apenas o super-admin da ACID pode buscar usuarios.';
  end if;
  select id into v_id from auth.users where lower(email) = lower(trim(p_email));
  return v_id;
end;
$$;

-- ─── Remover membro ───────────────────────────────────────
create or replace function public.acid_remover_membro(
  p_tenant uuid, p_user uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_era_admin boolean;
  v_admins int;
begin
  if not public.is_acid_admin() then
    raise exception 'Apenas o super-admin da ACID pode gerenciar usuarios.';
  end if;

  select (role = 'admin') into v_era_admin
  from tenant_users where tenant_id = p_tenant and user_id = p_user;
  if not found then
    return; -- ja nao e membro; no-op
  end if;

  if v_era_admin then
    select count(*) into v_admins from tenant_users
      where tenant_id = p_tenant and role = 'admin';
    if v_admins <= 1 then
      raise exception 'Este e o unico admin do tenant. Promova outro antes de remover.';
    end if;
  end if;

  delete from tenant_users where tenant_id = p_tenant and user_id = p_user;
end;
$$;

-- Mesmo gotcha do Supabase: o ALTER DEFAULT PRIVILEGES concede EXECUTE direto a
-- anon/authenticated em toda funcao nova. Revoga do publico/anon e re-concede
-- so a authenticated (a trava real e o is_acid_admin() por dentro de cada uma).
revoke execute on function public.acid_tenant_usuarios(uuid) from public, anon;
revoke execute on function public.acid_definir_papel(uuid, uuid, text) from public, anon;
revoke execute on function public.acid_buscar_usuario(text) from public, anon;
revoke execute on function public.acid_remover_membro(uuid, uuid) from public, anon;
grant  execute on function public.acid_tenant_usuarios(uuid) to authenticated;
grant  execute on function public.acid_definir_papel(uuid, uuid, text) to authenticated;
grant  execute on function public.acid_buscar_usuario(text) to authenticated;
grant  execute on function public.acid_remover_membro(uuid, uuid) to authenticated;

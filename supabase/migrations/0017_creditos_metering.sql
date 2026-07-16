-- FASE 3A — Metering de créditos (observabilidade, NÃO bloqueia nada).
--
-- Duas partes:
--  (A) CORREÇÃO de tenancy: os inserts do radar não setavam `tenant_id`, então
--      linhas escritas depois do backfill da Fase 1 nasciam órfãs (tenant_id null)
--      e, sob o RLS estrito da Fase 2, ficavam invisíveis pro tenant dono. Um
--      trigger BEFORE INSERT passa a preencher `tenant_id` a partir do `marca_id`
--      (radar) ou do claim JWT (report avulso criado por usuário). Backfill dos
--      órfãos existentes junto.
--  (B) CRÉDITOS: `tenants.saldo_creditos` (cache) + `creditos_ledger` + funções
--      de lançamento/débito/recarga. 1 unidade de trabalho = 1 crédito (1 report,
--      1 varredura de radar por marca). Débito é registrado onde o trabalho de
--      fato termina, e NUNCA bloqueia (metering; a trava vem no 3B).
--
-- Escrita de crédito só via funções SECURITY DEFINER (radar/report rodam com
-- service_role; recarga é ação de super-admin ACID). Nada de writes diretos por
-- authenticated no ledger.

-- ══ PARTE A — corrigir denormalização de tenant_id ═════════════════════════
create or replace function public.set_tenant_id_default()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null then
    if new.marca_id is not null then
      select tenant_id into new.tenant_id from public.marcas where id = new.marca_id;
    end if;
    -- report avulso (sem marca) criado por um usuário logado: herda do claim.
    if new.tenant_id is null then
      new.tenant_id := public.jwt_tenant_id();
    end if;
  end if;
  return new;
end $$;

create trigger set_tenant_id before insert on trends_radar
  for each row execute function public.set_tenant_id_default();
create trigger set_tenant_id before insert on radar_runs
  for each row execute function public.set_tenant_id_default();
create trigger set_tenant_id before insert on radar_raw_data
  for each row execute function public.set_tenant_id_default();
create trigger set_tenant_id before insert on radar_scrape_jobs
  for each row execute function public.set_tenant_id_default();
create trigger set_tenant_id before insert on reports
  for each row execute function public.set_tenant_id_default();

-- backfill dos órfãos escritos entre a Fase 1 e agora (herdam o tenant da marca).
update trends_radar      t set tenant_id = m.tenant_id from marcas m where t.marca_id = m.id and t.tenant_id is null;
update radar_runs        t set tenant_id = m.tenant_id from marcas m where t.marca_id = m.id and t.tenant_id is null;
update radar_raw_data    t set tenant_id = m.tenant_id from marcas m where t.marca_id = m.id and t.tenant_id is null;
update radar_scrape_jobs t set tenant_id = m.tenant_id from marcas m where t.marca_id = m.id and t.tenant_id is null;

-- ══ PARTE B — créditos ═════════════════════════════════════════════════════
alter table tenants add column saldo_creditos integer not null default 0;

create table creditos_ledger (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  -- +recarga / -consumo. Um lançamento por evento de custo.
  delta       integer not null,
  motivo      text not null check (motivo in ('report','radar_run','recarga','ajuste')),
  -- referência ao objeto que gerou o lançamento (report.id / radar_runs.id). Null em recarga.
  ref_id      uuid,
  -- saldo do tenant DEPOIS deste lançamento (snapshot pra auditoria/extrato).
  saldo_after integer not null,
  created_at  timestamptz not null default now()
);
alter table creditos_ledger enable row level security;
create index creditos_ledger_tenant_idx on creditos_ledger(tenant_id, created_at desc);

-- tenant lê o próprio extrato; super-admin ACID lê tudo. Sem insert/update direto.
create policy "tenant_read" on creditos_ledger for select to authenticated
  using (tenant_id = public.jwt_tenant_id() or public.is_acid_admin());

-- CORE: aplica um delta, atualiza o cache de saldo e grava o extrato, atômico
-- (o UPDATE trava a linha do tenant, serializando lançamentos concorrentes).
create or replace function public.credito_lancar(p_tenant uuid, p_delta int, p_motivo text, p_ref uuid default null)
  returns integer language plpgsql security definer set search_path = public as $$
declare v_saldo integer;
begin
  update tenants set saldo_creditos = saldo_creditos + p_delta
    where id = p_tenant returning saldo_creditos into v_saldo;
  if v_saldo is null then
    raise exception 'tenant % inexistente', p_tenant;
  end if;
  insert into creditos_ledger (tenant_id, delta, motivo, ref_id, saldo_after)
    values (p_tenant, p_delta, p_motivo, p_ref, v_saldo);
  return v_saldo;
end $$;

-- DÉBITO radar: resolve o tenant pela marca, idempotente por (ref, motivo) pra
-- um mesmo run nunca ser cobrado 2x. Retorna o saldo (ou null se marca sumiu).
create or replace function public.cobrar_radar_run(p_marca uuid, p_ref uuid)
  returns integer language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from marcas where id = p_marca;
  if v_tenant is null then return null; end if;
  if p_ref is not null and exists (
    select 1 from creditos_ledger where ref_id = p_ref and motivo = 'radar_run'
  ) then
    return (select saldo_creditos from tenants where id = v_tenant);
  end if;
  return public.credito_lancar(v_tenant, -1, 'radar_run', p_ref);
end $$;

-- DÉBITO report: resolve o tenant pelo report (slug), idempotente por report.
create or replace function public.cobrar_report(p_slug text)
  returns integer language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_id uuid;
begin
  select id, tenant_id into v_id, v_tenant from reports where slug = p_slug;
  if v_tenant is null then return null; end if;
  if exists (select 1 from creditos_ledger where ref_id = v_id and motivo = 'report') then
    return (select saldo_creditos from tenants where id = v_tenant);
  end if;
  return public.credito_lancar(v_tenant, -1, 'report', v_id);
end $$;

-- RECARGA: só super-admin ACID credita volume (placeholder até o billing da Fase 4:
-- cartão self-service / débito mensal / transferência ao fechar contrato).
create or replace function public.recarga_creditos(p_tenant uuid, p_qtd int, p_motivo text default 'recarga')
  returns integer language plpgsql security definer set search_path = public as $$
begin
  if not public.is_acid_admin() then
    raise exception 'somente super-admin ACID pode recarregar creditos';
  end if;
  if p_qtd <= 0 then raise exception 'quantidade deve ser positiva'; end if;
  if p_motivo not in ('recarga','ajuste') then raise exception 'motivo invalido para recarga'; end if;
  return public.credito_lancar(p_tenant, p_qtd, p_motivo, null);
end $$;

-- Grants: writes de crédito não são acessíveis a authenticated/anon (evita que um
-- usuário fabrique saldo). service_role (radar/report) debita; recarga é chamada
-- por authenticated mas trava internamente em is_acid_admin().
revoke execute on function public.credito_lancar(uuid,int,text,uuid) from public;
revoke execute on function public.cobrar_radar_run(uuid,uuid)        from public;
revoke execute on function public.cobrar_report(text)               from public;
grant  execute on function public.cobrar_radar_run(uuid,uuid)        to service_role;
grant  execute on function public.cobrar_report(text)               to service_role;
grant  execute on function public.recarga_creditos(uuid,int,text)   to authenticated;

-- Saldo inicial do Caramelo (tenant #1). Volume PLACEHOLDER; o valor real por
-- crédito e a política de recarga entram na Fase 4 (billing).
select public.credito_lancar('61863470-3633-4de9-804e-1fb4a2ae6311', 1000, 'recarga', null);

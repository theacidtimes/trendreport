-- FASE 4A — Schema aditivo do console: módulos + assinaturas. SÓ estrutura, NÃO
-- muda comportamento de nada (radar/report/mapa seguem intactos). Duas tabelas:
--
--  (A) tenant_modulos: os "apps" do Acid Fabric que um tenant assinou (analogia
--      Adobe). radar | reports | dados_semanticos. O enforcement de módulo
--      (esconder feature não assinada) vem nas fatias de UI; aqui é só o registro.
--  (B) assinaturas: contrato vigente do tenant (plano + janela + renovação). O
--      histórico de renovações mora aqui (uma linha por ciclo). data_fim é
--      DERIVADA do plano_tipo por trigger.
--
-- RLS no mesmo padrão da tenancy: tenant lê o próprio (tenant_read), e só o
-- super-admin ACID escreve (acid_manage) — provisionamento é ação da ACID (4C).
-- service_role (jobs) bypassa RLS de qualquer forma.

-- ══ (A) tenant_modulos ═════════════════════════════════════════════════════
create table tenant_modulos (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  modulo     text not null check (modulo in ('radar','reports','dados_semanticos')),
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, modulo)
);
alter table tenant_modulos enable row level security;

create policy "tenant_read" on tenant_modulos for select to authenticated
  using (tenant_id = public.jwt_tenant_id() or public.is_acid_admin());
create policy "acid_manage" on tenant_modulos for all to authenticated
  using (public.is_acid_admin()) with check (public.is_acid_admin());

-- ══ (B) assinaturas ════════════════════════════════════════════════════════
create table assinaturas (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  plano_tipo    text not null check (plano_tipo in ('mensal','trimestral','semestral','anual')),
  data_inicio   date not null default current_date,
  -- derivada do plano_tipo pelo trigger abaixo quando não informada.
  data_fim      date not null,
  auto_renovacao boolean not null default true,
  status        text not null default 'ativa' check (status in ('ativa','expirada','cancelada')),
  created_at    timestamptz not null default now()
);
alter table assinaturas enable row level security;
create index assinaturas_tenant_idx on assinaturas(tenant_id, created_at desc);

create policy "tenant_read" on assinaturas for select to authenticated
  using (tenant_id = public.jwt_tenant_id() or public.is_acid_admin());
create policy "acid_manage" on assinaturas for all to authenticated
  using (public.is_acid_admin()) with check (public.is_acid_admin());

-- data_fim = data_inicio + janela do plano (só quando não veio explícita).
create or replace function public.set_assinatura_data_fim()
  returns trigger language plpgsql set search_path = public as $$
begin
  if new.data_fim is null then
    new.data_fim := (new.data_inicio + case new.plano_tipo
      when 'mensal'     then interval '1 month'
      when 'trimestral' then interval '3 months'
      when 'semestral'  then interval '6 months'
      when 'anual'      then interval '1 year'
    end)::date;
  end if;
  return new;
end $$;

-- BEFORE INSERT roda antes da checagem de NOT NULL, então o trigger setar
-- data_fim satisfaz a constraint. O insert do app pode mandar só o plano_tipo.
create trigger set_data_fim before insert on assinaturas
  for each row execute function public.set_assinatura_data_fim();

-- ══ SEED do Caramelo (tenant #1) ═══════════════════════════════════════════
-- Todos os módulos ligados + uma assinatura anual ativa (dado real, não mock).
insert into tenant_modulos (tenant_id, modulo, ativo) values
  ('61863470-3633-4de9-804e-1fb4a2ae6311','radar',true),
  ('61863470-3633-4de9-804e-1fb4a2ae6311','reports',true),
  ('61863470-3633-4de9-804e-1fb4a2ae6311','dados_semanticos',true);

insert into assinaturas (tenant_id, plano_tipo, data_inicio, auto_renovacao, status)
  values ('61863470-3633-4de9-804e-1fb4a2ae6311','anual',current_date,true,'ativa');

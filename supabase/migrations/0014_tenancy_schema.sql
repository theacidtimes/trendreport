-- FASE 1 — Camada de tenancy (ADITIVO, sem RLS de isolamento ainda).
-- Cria `tenants`/`tenant_users`, adiciona `tenant_id` (nullable) nas tabelas de
-- dado e faz o backfill de TUDO que existe hoje pro tenant "Caramelo" (tenant #1).
--
-- Nada muda de comportamento aqui: colunas nullable + backfill. Os motores
-- (radar, mapa semântico, report) seguem lendo por `marca_id` como antes. O
-- isolamento real — policies por `tenant_id` + claim `tenant_id` no JWT — vem na
-- Fase 2, num passo revisado à parte (RLS mal sequenciado tranca acesso).

-- ── tenants ────────────────────────────────────────────────
create table tenants (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  tipo             text not null default 'agency'
                     check (tipo in ('studio','agency','holding','company')),
  status           text not null default 'ativo'
                     check (status in ('ativo','suspenso','cancelado')),
  cnpj             text,
  endereco         jsonb not null default '{}',
  cobranca         jsonb not null default '{}',
  branding         jsonb not null default '{}',
  perfil_criativo  jsonb not null default '{}',
  seats            integer not null default 5,
  -- Folga futura: holding com sub-contas. Não usado ainda.
  parent_tenant_id uuid references tenants(id) on delete set null,
  created_at       timestamptz not null default now()
);

alter table tenants enable row level security;
create policy "auth_only" on tenants for all using (auth.role() = 'authenticated');

-- ── tenant_users ───────────────────────────────────────────
create table tenant_users (
  tenant_id  uuid not null references tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'editor'
               check (role in ('admin','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

alter table tenant_users enable row level security;
create policy "auth_only" on tenant_users for all using (auth.role() = 'authenticated');

create index tenant_users_user_id_idx on tenant_users(user_id);

-- ── tenant_id nas tabelas existentes (nullable) ────────────
alter table reports           add column tenant_id uuid references tenants(id) on delete set null;
alter table marcas            add column tenant_id uuid references tenants(id) on delete set null;
alter table report_audit      add column tenant_id uuid references tenants(id) on delete set null;
-- Denormalizado nas tabelas de radar (penduram em marca_id, mas guardar o
-- tenant_id direto evita join dentro da policy de RLS na Fase 2 — mais rápido).
alter table trends_radar      add column tenant_id uuid references tenants(id) on delete set null;
alter table radar_runs        add column tenant_id uuid references tenants(id) on delete set null;
alter table radar_raw_data    add column tenant_id uuid references tenants(id) on delete set null;
alter table radar_scrape_jobs add column tenant_id uuid references tenants(id) on delete set null;

create index reports_tenant_id_idx           on reports(tenant_id);
create index marcas_tenant_id_idx            on marcas(tenant_id);
create index report_audit_tenant_id_idx      on report_audit(tenant_id);
create index trends_radar_tenant_id_idx      on trends_radar(tenant_id);
create index radar_runs_tenant_id_idx        on radar_runs(tenant_id);
create index radar_raw_data_tenant_id_idx    on radar_raw_data(tenant_id);
create index radar_scrape_jobs_tenant_id_idx on radar_scrape_jobs(tenant_id);

-- ── backfill: tenant #1 "Caramelo" recebe tudo que existe hoje ──
do $$
declare
  caramelo_id uuid;
begin
  insert into tenants (nome, tipo, status)
  values ('Caramelo', 'agency', 'ativo')
  returning id into caramelo_id;

  update reports           set tenant_id = caramelo_id where tenant_id is null;
  update marcas            set tenant_id = caramelo_id where tenant_id is null;
  update report_audit      set tenant_id = caramelo_id where tenant_id is null;
  update trends_radar      set tenant_id = caramelo_id where tenant_id is null;
  update radar_runs        set tenant_id = caramelo_id where tenant_id is null;
  update radar_raw_data    set tenant_id = caramelo_id where tenant_id is null;
  update radar_scrape_jobs set tenant_id = caramelo_id where tenant_id is null;

  -- Todo usuário atual entra no Caramelo. Quem está em app_admins vira admin do
  -- tenant; os demais, editor. (Super-admin ACID é outra coisa, entra na Fase 2.)
  insert into tenant_users (tenant_id, user_id, role)
  select
    caramelo_id,
    u.id,
    case when a.email is not null then 'admin' else 'editor' end
  from auth.users u
  left join app_admins a on lower(a.email) = lower(u.email)
  on conflict (tenant_id, user_id) do nothing;
end $$;

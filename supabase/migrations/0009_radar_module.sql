-- TABELA MARCAS
create table marcas (
  id                uuid primary key default gen_random_uuid(),
  nome              text not null,
  yaml_conhecimento jsonb not null default '{}',
  status_varredura  boolean not null default false,
  intervalo_horas   integer not null default 6,
  ultima_varredura  timestamptz,
  created_at        timestamptz default now()
);

alter table marcas enable row level security;
create policy "auth_only" on marcas for all using (auth.role() = 'authenticated');

-- TABELA TRENDS_RADAR
create table trends_radar (
  id                          uuid primary key default gen_random_uuid(),
  marca_id                    uuid references marcas(id) on delete cascade,
  insight_titulo              text not null,
  categoria_funil             text check (categoria_funil in ('growth', 'base')),
  status_hype                 text check (status_hype in ('em_alta','subindo','estabilizando','esfriando')),
  indice_hype                 integer check (indice_hype between 0 and 100),
  descricao_fato              text,
  gancho_produto              text,
  insight_criativo_cccaramelo text,
  links_fontes                text[] default '{}',
  score_densidade             integer,
  score_transbordo            integer,
  score_velocidade            integer,
  created_at                  timestamptz default now()
);

alter table trends_radar enable row level security;
create policy "auth_only" on trends_radar for all using (auth.role() = 'authenticated');

create index trends_radar_marca_id_idx on trends_radar(marca_id);
create index trends_radar_created_at_idx on trends_radar(created_at desc);
create index trends_radar_status_hype_idx on trends_radar(status_hype);

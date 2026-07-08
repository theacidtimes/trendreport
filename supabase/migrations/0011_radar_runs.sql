-- REGISTRO DE RUNS DO AGENTE (volume/uso — sem custo, sem tokens, sem horas)
create table radar_runs (
  id              uuid primary key default gen_random_uuid(),
  marca_id        uuid not null references marcas(id) on delete cascade,
  sinais_captados integer not null default 0,   -- total coletado no run
  sinais_novos    integer not null default 0,   -- após dedup vs. histórico
  drops_gerados   integer not null default 0,
  modelo          text,
  status          text,   -- ok | sem_dados | score_baixo | sem_novidade | erro
  created_at      timestamptz default now()
);

alter table radar_runs enable row level security;
create policy "auth_only" on radar_runs for all using (auth.role() = 'authenticated');

create index radar_runs_marca_id_idx on radar_runs(marca_id);
create index radar_runs_created_at_idx on radar_runs(created_at desc);

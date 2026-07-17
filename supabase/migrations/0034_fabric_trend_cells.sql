-- ═══════════════════════════════════════════════════════════════════════════
-- FABRIC LAKE (Fase 5, Fatia 4) — trend_cell: o agregado VENDAVEL
--
-- signal e o substrato (1 linha = 1 leitura des-identificada). trend_cell e a
-- CAMADA DE VALOR: serie temporal por setor × dimensao × termo, com contagem,
-- momento DERIVADO (aqui, nao por sinal), confidence e K-ANONIMATO (celulas com
-- menos de K sinais nao existem — nada rastreavel ao individuo).
--
-- Marginal por dimensao (nao combinacao): "na semana W, setor games, quantos
-- sinais carregaram comportamento=ritual". Shape limpo, k-anon-friendly, e o
-- que um data lake / enterprise compra. Co-ocorrencia fica pra depois.
--
-- Continua em fabric_lake (nao exposto). Escrita/leitura so via RPC em public.
-- ═══════════════════════════════════════════════════════════════════════════

create table fabric_lake.trend_cell (
  id             uuid primary key default gen_random_uuid(),
  bucket         text not null,          -- 'semana' | 'mes'
  periodo_inicio date not null,          -- inicio do bucket (date_trunc)
  setor          text not null,
  dimensao       text not null,          -- comportamento|emocao|inflexao|lente_negocio
  termo          text not null,
  n_sinais       int  not null,
  n_plataformas  int  not null,
  n_engaj_alto   int  not null default 0,
  momento_derivado text,                 -- emergente|crescimento|pico|declinio|residual
  confidence     numeric(4,3),           -- 0..1 (rascunho v1)
  atualizado_em  timestamptz not null default now(),
  unique (bucket, periodo_inicio, setor, dimensao, termo)
);

create index trend_cell_lookup_idx
  on fabric_lake.trend_cell(bucket, setor, dimensao, periodo_inicio desc);

alter table fabric_lake.trend_cell enable row level security;
create policy "acid admin le trend_cell" on fabric_lake.trend_cell
  for select to authenticated using (public.is_acid_admin());
revoke all on all tables in schema fabric_lake from anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- REBUILD — reagrega signal → trend_cell pra um bucket. Idempotente (apaga e
-- reinsere o range). Aplica K-ANONIMATO no `having` (celula < K nao nasce).
-- p_k default 5 (RASCUNHO — o K seguro pra vender ainda e decisao aberta).
-- Deriva momento comparando cada celula com o periodo anterior (espirito do
-- momentum.ts, mas agregado). service_role OU super-admin ACID.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.fabric_rebuild_trend_cells(
  p_bucket text default 'semana',
  p_desde  date default null,
  p_k      int  default 5
)
returns int
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_trunc text;
  v_total int;
begin
  if auth.role() <> 'service_role' and not public.is_acid_admin() then
    raise exception 'nao autorizado';
  end if;
  if p_bucket not in ('semana','mes') then raise exception 'bucket invalido: %', p_bucket; end if;
  v_trunc := case p_bucket when 'semana' then 'week' else 'month' end;

  delete from fabric_lake.trend_cell
   where bucket = p_bucket
     and (p_desde is null or periodo_inicio >= p_desde);

  insert into fabric_lake.trend_cell (
    bucket, periodo_inicio, setor, dimensao, termo,
    n_sinais, n_plataformas, n_engaj_alto, confidence
  )
  select
    p_bucket,
    date_trunc(v_trunc, coalesce(s.occurred_at, s.ingested_at))::date,
    coalesce(s.setor, 'desconhecido'),
    d.dimensao,
    t.termo,
    count(*),
    count(distinct s.plataforma),
    count(*) filter (where s.engajamento_faixa = 'alto'),
    -- confidence rascunho: satura com volume e premia diversidade de plataforma
    round(least(1.0,
      (count(*)::numeric / (count(*) + 5))
      * (0.6 + 0.4 * least(count(distinct s.plataforma), 3) / 3.0)
    ), 3)
  from fabric_lake.signal s
  cross join lateral (values
    ('comportamento', s.comportamento),
    ('emocao',        s.emocao),
    ('inflexao',      s.inflexao),
    ('lente_negocio', s.lente_negocio)
  ) as d(dimensao, arr)
  cross join lateral unnest(d.arr) as t(termo)
  where (p_desde is null or coalesce(s.occurred_at, s.ingested_at) >= p_desde)
  group by 1,2,3,4,5
  having count(*) >= p_k;

  -- momento derivado: compara com o periodo anterior da mesma (setor,dim,termo)
  with ordered as (
    select id, n_sinais,
      lag(n_sinais) over (
        partition by setor, dimensao, termo order by periodo_inicio
      ) as prev_n
    from fabric_lake.trend_cell
    where bucket = p_bucket
  )
  update fabric_lake.trend_cell tc set momento_derivado = case
    when o.prev_n is null              then 'emergente'
    when o.n_sinais >= o.prev_n * 1.2  then 'crescimento'
    when o.n_sinais <= o.prev_n * 0.5  then 'residual'
    when o.n_sinais <  o.prev_n * 0.8  then 'declinio'
    else 'pico'
  end
  from ordered o
  where tc.id = o.id;

  select count(*) into v_total from fabric_lake.trend_cell where bucket = p_bucket;
  return v_total;
end;
$$;

revoke execute on function public.fabric_rebuild_trend_cells(text, date, int) from public, anon;
grant  execute on function public.fabric_rebuild_trend_cells(text, date, int) to authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- LEITURA das celulas (console ACID / entrega ao comprador). Ja k-anonimizado
-- na origem (rebuild). service_role OU super-admin ACID.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.fabric_trend_cells(
  p_bucket   text default 'semana',
  p_setor    text default null,
  p_dimensao text default null,
  p_desde    date default null
)
returns table (
  bucket           text,
  periodo_inicio   date,
  setor            text,
  dimensao         text,
  termo            text,
  n_sinais         int,
  n_plataformas    int,
  n_engaj_alto     int,
  momento_derivado text,
  confidence       numeric
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.is_acid_admin() then
    raise exception 'nao autorizado';
  end if;
  return query
    select tc.bucket, tc.periodo_inicio, tc.setor, tc.dimensao, tc.termo,
           tc.n_sinais, tc.n_plataformas, tc.n_engaj_alto,
           tc.momento_derivado, tc.confidence
    from fabric_lake.trend_cell tc
    where tc.bucket = p_bucket
      and (p_setor    is null or tc.setor = p_setor)
      and (p_dimensao is null or tc.dimensao = p_dimensao)
      and (p_desde    is null or tc.periodo_inicio >= p_desde)
    order by tc.periodo_inicio desc, tc.n_sinais desc;
end;
$$;

revoke execute on function public.fabric_trend_cells(text, text, text, date) from public, anon;
grant  execute on function public.fabric_trend_cells(text, text, text, date) to authenticated;

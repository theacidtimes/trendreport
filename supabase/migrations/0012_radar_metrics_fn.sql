-- MÉTRICAS DE VOLUME POR CLIENTE (sem custo/token — só quantidade e uso)

-- Resumo consolidado de um cliente (7d / 30d / total + pico, última run, modelos)
create or replace function radar_client_summary(p_marca_id uuid, p_nome text)
returns json
language sql
stable
as $$
  select json_build_object(
    'captados_total', (select count(*) from radar_raw_data where marca_id = p_marca_id),
    'captados_30d',   (select count(*) from radar_raw_data where marca_id = p_marca_id and created_at >= now() - interval '30 days'),
    'captados_7d',    (select count(*) from radar_raw_data where marca_id = p_marca_id and created_at >= now() - interval '7 days'),
    'drops_total',    (select count(*) from trends_radar where marca_id = p_marca_id),
    'drops_30d',      (select count(*) from trends_radar where marca_id = p_marca_id and created_at >= now() - interval '30 days'),
    'drops_7d',       (select count(*) from trends_radar where marca_id = p_marca_id and created_at >= now() - interval '7 days'),
    'runs_total',     (select count(*) from radar_runs where marca_id = p_marca_id),
    'runs_30d',       (select count(*) from radar_runs where marca_id = p_marca_id and created_at >= now() - interval '30 days'),
    'runs_7d',        (select count(*) from radar_runs where marca_id = p_marca_id and created_at >= now() - interval '7 days'),
    'reports_total',  (select count(*) from reports where lower(trim(cliente)) = lower(trim(p_nome))),
    'reports_30d',    (select count(*) from reports where lower(trim(cliente)) = lower(trim(p_nome)) and created_at >= now() - interval '30 days'),
    'reports_7d',     (select count(*) from reports where lower(trim(cliente)) = lower(trim(p_nome)) and created_at >= now() - interval '7 days'),
    'pico_captados',  (select coalesce(max(sinais_captados), 0) from radar_runs where marca_id = p_marca_id),
    'ultima_run',     (select max(created_at) from radar_runs where marca_id = p_marca_id),
    'modelos',        (select coalesce(json_agg(distinct modelo) filter (where modelo is not null), '[]'::json) from radar_runs where marca_id = p_marca_id)
  );
$$;

-- Série temporal diária (para os gráficos): captados, drops e runs por dia
create or replace function radar_daily_metrics(p_marca_id uuid, p_days int default 30)
returns table (dia date, captados bigint, drops bigint, runs bigint)
language sql
stable
as $$
  with dias as (
    select generate_series(current_date - (p_days - 1), current_date, interval '1 day')::date as dia
  )
  select
    d.dia,
    (select count(*) from radar_raw_data r where r.marca_id = p_marca_id and r.created_at::date = d.dia) as captados,
    (select count(*) from trends_radar t where t.marca_id = p_marca_id and t.created_at::date = d.dia) as drops,
    (select count(*) from radar_runs ru where ru.marca_id = p_marca_id and ru.created_at::date = d.dia) as runs
  from dias d
  order by d.dia;
$$;

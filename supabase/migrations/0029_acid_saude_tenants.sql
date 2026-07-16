-- Saúde cross-tenant pro console da ACID. Uma única RPC agrega, por tenant, o
-- estado comercial (status, créditos, assinatura vigente) E os sinais operacionais
-- (atividade de radar: última run, runs/drops dos últimos 7 dias, marcas ativas).
-- Fica numa chamada só (sem N+1) — o console lê e deriva os alertas em TS.
--
-- Gate: is_acid_admin() por dentro (SECURITY DEFINER bypassa RLS, então SEM o gate
-- qualquer authenticated veria todos os tenants). radar_runs/trends_radar já têm
-- tenant_id (trigger set_tenant_id da 3A), então não precisa joinar por marca.

create or replace function public.acid_saude_tenants()
returns table(
  tenant_id uuid,
  nome text,
  tipo text,
  status text,
  saldo_creditos int,
  seats int,
  usuarios int,
  marcas_total int,
  marcas_ativas int,
  ultima_run timestamptz,
  runs_7d int,
  drops_7d int,
  assinatura_status text,
  assinatura_fim date,
  assinatura_plano text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_acid_admin() then
    raise exception 'Apenas a ACID pode ver a saude dos tenants.';
  end if;
  return query
    select
      t.id,
      t.nome,
      t.tipo,
      t.status,
      t.saldo_creditos,
      t.seats,
      (select count(*) from tenant_users tu where tu.tenant_id = t.id)::int,
      (select count(*) from marcas m where m.tenant_id = t.id)::int,
      (select count(*) from marcas m
         where m.tenant_id = t.id and m.status_varredura)::int,
      (select max(r.created_at) from radar_runs r where r.tenant_id = t.id),
      (select count(*) from radar_runs r
         where r.tenant_id = t.id
           and r.created_at >= now() - interval '7 days')::int,
      (select coalesce(sum(r.drops_gerados), 0) from radar_runs r
         where r.tenant_id = t.id
           and r.created_at >= now() - interval '7 days')::int,
      a.status,
      a.data_fim,
      a.plano_tipo
    from tenants t
    left join lateral (
      select a2.status, a2.data_fim, a2.plano_tipo
      from assinaturas a2
      where a2.tenant_id = t.id
      order by a2.created_at desc
      limit 1
    ) a on true
    order by t.created_at asc;
end;
$$;

-- Mesmo gotcha do Supabase (ALTER DEFAULT PRIVILEGES concede EXECUTE direto): revoga
-- do público/anon e re-concede só a authenticated (a trava real é is_acid_admin()).
revoke execute on function public.acid_saude_tenants() from public, anon;
grant  execute on function public.acid_saude_tenants() to authenticated;

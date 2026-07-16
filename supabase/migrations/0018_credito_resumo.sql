-- FASE 3A — resumo de créditos pro ticker fixo (leitura leve, qualquer usuário
-- do tenant vê o próprio consumo). Uma chamada só devolve saldo (cache) + total
-- creditado + total consumido, tudo resolvido por jwt_tenant_id() — então até
-- um super-admin ACID vê os números do SEU tenant no ticker (não vaza de outros).
--
-- SECURITY DEFINER só pra manter a função barata e previsível (a policy de SELECT
-- do ledger já permitiria a leitura do próprio tenant de qualquer forma).
create or replace function public.credito_resumo()
  returns table(saldo integer, creditado bigint, consumido bigint)
  language sql security definer set search_path = public stable as $$
  select
    coalesce((select saldo_creditos from tenants where id = public.jwt_tenant_id()), 0)::integer,
    coalesce((select sum(delta) from creditos_ledger
              where tenant_id = public.jwt_tenant_id() and delta > 0), 0)::bigint,
    coalesce((select -sum(delta) from creditos_ledger
              where tenant_id = public.jwt_tenant_id() and delta < 0), 0)::bigint;
$$;

revoke execute on function public.credito_resumo() from public;
grant  execute on function public.credito_resumo() to authenticated;

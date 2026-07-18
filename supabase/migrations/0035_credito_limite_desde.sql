-- FASE 3B — quando começou o "no limite" atual. O ticker de canto já avisa em tempo
-- real; o banner sticky só deve escalonar depois que o tenant ficou parado no limite
-- por um tempo (24h no cliente). Pra esse relógio ser do TENANT (não do navegador),
-- derivamos o início da sequência atual de saldo esgotado a partir do creditos_ledger.
--
-- Lógica: olha o último lançamento. Se ele deixou saldo_after > 0, o tenant NÃO está
-- no limite agora — devolve null (sem escalonar). Se saldo_after <= 0, acha o início
-- da sequência: o menor created_at dos lançamentos com saldo_after <= 0 que vêm depois
-- do último lançamento que deixou saldo positivo (ou desde o começo, se nunca houve um).
--
-- SECURITY DEFINER e resolvido por jwt_tenant_id() — mesmo padrão do credito_resumo:
-- cada usuário (inclusive super-admin ACID) enxerga só o relógio do próprio tenant.
create or replace function public.credito_limite_desde()
  returns timestamptz
  language sql security definer set search_path = public stable as $$
  with ultimo as (
    select saldo_after, created_at
    from creditos_ledger
    where tenant_id = public.jwt_tenant_id()
    order by created_at desc, id desc
    limit 1
  ),
  corte as (
    -- created_at do último lançamento que deixou saldo positivo (null se nunca houve)
    select max(created_at) as ts
    from creditos_ledger
    where tenant_id = public.jwt_tenant_id() and saldo_after > 0
  )
  select case
    when not exists (select 1 from ultimo) then null
    when (select saldo_after from ultimo) > 0 then null
    else (
      select min(created_at)
      from creditos_ledger
      where tenant_id = public.jwt_tenant_id()
        and saldo_after <= 0
        and created_at > coalesce((select ts from corte), '-infinity'::timestamptz)
    )
  end;
$$;

revoke execute on function public.credito_limite_desde() from public;
grant  execute on function public.credito_limite_desde() to authenticated;

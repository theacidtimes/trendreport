-- FASE 4C — Provisionamento atômico de tenant pela ACID.
--
-- Criar um tenant toca 3 tabelas (tenants + tenant_modulos + assinaturas) e,
-- opcionalmente, credita saldo inicial (creditos_ledger). Fazer isso em inserts
-- soltos no client deixaria o tenant nascer pela metade se um passo falhasse.
-- Esta função faz tudo numa transação única (é uma função => atômica) e trava
-- em is_acid_admin() por dentro — provisionar é ação exclusiva da ACID.
--
-- SECURITY DEFINER: roda como owner pra poder inserir mesmo com o RLS estrito;
-- a trava real é o is_acid_admin() no topo (não confia no RLS pra autorizar).
create or replace function public.provisionar_tenant(
  p_nome     text,
  p_tipo     text,
  p_seats    int,
  p_plano    text,
  p_modulos  text[],
  p_cnpj     text default null,
  p_creditos int  default 0
) returns uuid
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  v_id uuid;
  v_modulo text;
  v_creditos int := greatest(coalesce(p_creditos, 0), 0);
begin
  if not public.is_acid_admin() then
    raise exception 'Apenas o super-admin da ACID pode provisionar tenants.';
  end if;

  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'Nome do tenant e obrigatorio.';
  end if;

  -- tenant (as constraints de tipo/status/seats já validam os valores)
  insert into tenants (nome, tipo, seats, cnpj, saldo_creditos)
  values (btrim(p_nome), p_tipo, greatest(coalesce(p_seats, 1), 1),
          nullif(btrim(coalesce(p_cnpj, '')), ''), v_creditos)
  returning id into v_id;

  -- módulos assinados (dedup; a check constraint valida cada nome)
  foreach v_modulo in array coalesce(p_modulos, array[]::text[]) loop
    insert into tenant_modulos (tenant_id, modulo, ativo)
    values (v_id, v_modulo, true)
    on conflict (tenant_id, modulo) do update set ativo = true;
  end loop;

  -- assinatura inicial (data_fim deriva do plano pelo trigger set_data_fim)
  insert into assinaturas (tenant_id, plano_tipo)
  values (v_id, p_plano);

  -- crédito inicial opcional: registra o lançamento no extrato (saldo já setado
  -- no insert do tenant acima, então saldo_after = v_creditos).
  if v_creditos > 0 then
    insert into creditos_ledger (tenant_id, delta, motivo, saldo_after)
    values (v_id, v_creditos, 'recarga', v_creditos);
  end if;

  return v_id;
end $$;

-- Lockdown (lição das 0020/0021): o ALTER DEFAULT PRIVILEGES do Supabase concede
-- EXECUTE DIRETO a anon E via PUBLIC em toda função nova. `revoke from public`
-- sozinho NÃO tira o grant direto a anon — tem que revogar dos DOIS. Só
-- authenticated fica (a função trava em is_acid_admin por dentro).
revoke execute on function public.provisionar_tenant(text,text,int,text,text[],text,int) from public, anon;
grant  execute on function public.provisionar_tenant(text,text,int,text,text[],text,int) to authenticated;

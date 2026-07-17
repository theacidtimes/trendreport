-- ═══════════════════════════════════════════════════════════════════════════
-- FABRIC LAKE (Fase 5, Fatia 2) — porta de entrada da lake via `public`
--
-- fabric_lake NAO e exposto no PostgREST, entao supabase-js (REST) nao alcanca
-- as tabelas nem com service_role — de proposito. A unica superficie da lake sao
-- estas RPCs em `public` (schema exposto), SECURITY DEFINER, cada uma com gate
-- explicito. Mantem o duplo cinto: schema trancado + funcao gated.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- LEITURA do vocabulario controlado. Sem p_versao, devolve a versao vigente
-- (a maior). Uso: worker (interpretacao) e console ACID futuro. Gate: apenas
-- service_role OU super-admin ACID — a taxonomia e IP, nao vaza pro tenant.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.fabric_taxonomia(p_versao int default null)
returns table (
  versao    int,
  dimensao  text,
  termo     text,
  rotulo    text,
  descricao text
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_ver int;
begin
  if auth.role() <> 'service_role' and not public.is_acid_admin() then
    raise exception 'nao autorizado';
  end if;

  v_ver := coalesce(
    p_versao,
    (select max(t.versao) from fabric_lake.taxonomia t)
  );

  return query
    select t.versao, t.dimensao, t.termo, t.rotulo, t.descricao
    from fabric_lake.taxonomia t
    where t.versao = v_ver and t.ativo = true;
end;
$$;

revoke execute on function public.fabric_taxonomia(int) from public, anon;
grant  execute on function public.fabric_taxonomia(int) to authenticated;
-- service_role executa por padrao; authenticated passa so se is_acid_admin (gate interno).

-- ───────────────────────────────────────────────────────────────────────────
-- ESCRITA de um sinal des-identificado no substrato. So worker (service_role).
-- p_row = jsonb com os campos escalares/array; p_embedding = literal pgvector
-- (o JSON.stringify de um array de floats ja e "[...]", formato do pgvector).
-- Retorna o id do sinal inserido.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.fabric_ingest_signal(
  p_row       jsonb,
  p_embedding text default null
)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'nao autorizado';
  end if;

  insert into fabric_lake.signal (
    occurred_at, setor, plataforma, formato, regiao, idioma, momento,
    comportamento, emocao, inflexao, lente_negocio,
    tema_deid, engajamento_faixa, embedding, taxonomia_versao, modelo_versao
  ) values (
    nullif(p_row->>'occurred_at','')::timestamptz,
    nullif(p_row->>'setor',''),
    nullif(p_row->>'plataforma',''),
    nullif(p_row->>'formato',''),
    nullif(p_row->>'regiao',''),
    nullif(p_row->>'idioma',''),
    nullif(p_row->>'momento',''),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_row->'comportamento') x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_row->'emocao') x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_row->'inflexao') x), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(p_row->'lente_negocio') x), '{}'),
    nullif(p_row->>'tema_deid',''),
    nullif(p_row->>'engajamento_faixa',''),
    nullif(p_embedding,'')::vector(1024),
    (p_row->>'taxonomia_versao')::int,
    nullif(p_row->>'modelo_versao','')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.fabric_ingest_signal(jsonb, text) from public, anon, authenticated;
grant  execute on function public.fabric_ingest_signal(jsonb, text) to service_role;

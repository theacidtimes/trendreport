-- BUSCA VETORIAL POR MARCA: iterative scan no HNSW
--
-- O HNSW devolve os ef_search (40) vizinhos mais próximos do banco INTEIRO e só
-- depois aplica o `where marca_id = ...`. Com a Vivo tendo ~80% das linhas, a
-- busca de uma marca menor recebia 40 candidatos quase todos da Vivo e sobrava
-- pouco ou nada. Medido em 30 queries (25/09/2026), RPC × busca exata:
--   Conta Simples  retrieve 1.0 × 6.2 | momentum 2.6 × 7.4 | top-1 0.12 × 0.61
--   VOLL           retrieve 1.9 × 6.4 | momentum 5.7 × 8.3 | top-1 0.23 × 0.65
-- Efeitos: memória histórica quase vazia no prompt, momentum lendo tema velho
-- como "emergente" e dedup vs. histórico deixando passar sinal repetido.
--
-- pgvector 0.8 resolve com iterative scan: o índice continua buscando até
-- preencher o LIMIT depois do filtro. strict_order mantém a ordenação exata por
-- distância. Com o ajuste, as mesmas 30 queries batem com a busca exata.
--
-- O Supabase não deixa fixar o parâmetro com `alter function ... set` (permission
-- denied), então as funções viram plpgsql e ligam via set_config local à
-- transação. Assinatura e resultado são os mesmos.
--
-- Custo: cada query fica mais cara (≈50ms numa marca pequena, ≈260ms numa marca
-- sem sinais, porque o scan varre o índice inteiro). Por isso o memory.ts chama
-- o batch em lotes de 15. Se o banco crescer muito, o passo seguinte é
-- particionar radar_raw_data por marca_id (um HNSW por marca).

create or replace function match_radar_signals(
  p_marca_id      uuid,
  p_query         vector(1024),
  p_match_count   int   default 8,
  p_min_similarity float default 0.0
)
returns table (
  id         uuid,
  fonte      text,
  conteudo   text,
  url        text,
  metadata   jsonb,
  created_at timestamptz,
  similarity float
)
language plpgsql
stable
as $$
begin
  perform set_config('hnsw.iterative_scan', 'strict_order', true);
  return query
  select
    r.id,
    r.fonte,
    r.conteudo,
    r.url,
    r.metadata,
    r.created_at,
    1 - (r.embedding <=> p_query) as similarity
  from radar_raw_data r
  where r.marca_id = p_marca_id
    and r.embedding is not null
    and 1 - (r.embedding <=> p_query) >= p_min_similarity
  order by r.embedding <=> p_query
  limit p_match_count;
end;
$$;

create or replace function match_radar_signals_batch(
  p_marca_id       uuid,
  p_queries        vector(1024)[],
  p_min_similarity float default 0.92
)
returns table (
  query_idx       int,
  has_match       boolean,
  best_similarity float
)
language plpgsql
stable
as $$
begin
  perform set_config('hnsw.iterative_scan', 'strict_order', true);
  return query
  select
    q.idx::int,
    coalesce(m.similarity >= p_min_similarity, false),
    m.similarity
  from unnest(p_queries) with ordinality as q(vec, idx)
  left join lateral (
    select 1 - (r.embedding <=> q.vec) as similarity
    from radar_raw_data r
    where r.marca_id = p_marca_id
      and r.embedding is not null
    order by r.embedding <=> q.vec
    limit 1
  ) m on true;
end;
$$;

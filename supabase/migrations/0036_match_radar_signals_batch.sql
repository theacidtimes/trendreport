-- DEDUP EM LOTE (redução de round-trips)
--
-- O dedup do cérebro (lib/radar/memory.ts) hoje chama match_radar_signals uma vez
-- POR sinal, em série: N sinais = N idas ao PostgREST. Esta função faz o mesmo
-- trabalho em UMA chamada, recebendo todos os vetores de query de uma vez.
--
-- CRÍTICO: preserva o padrão ANN por query (order by <=> ... limit 1) via LATERAL,
-- pra continuar usando o índice HNSW igual à função original — uma versão ingênua
-- com `exists (... >= limiar)` faria scan e ficaria mais lenta. O resultado é o
-- mesmo do laço atual (top-1 por cosseno, checado contra o limiar), só que em lote.
--
-- ADITIVA: não altera match_radar_signals nem nenhuma tabela. Nada chama esta
-- função até o memory.ts ser religado explicitamente, então subir isto é inerte.
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
language sql
stable
as $$
  select
    q.idx::int                                          as query_idx,
    coalesce(m.similarity >= p_min_similarity, false)   as has_match,
    m.similarity                                        as best_similarity
  from unnest(p_queries) with ordinality as q(vec, idx)
  left join lateral (
    select 1 - (r.embedding <=> q.vec) as similarity
    from radar_raw_data r
    where r.marca_id = p_marca_id
      and r.embedding is not null
    order by r.embedding <=> q.vec
    limit 1
  ) m on true;
$$;

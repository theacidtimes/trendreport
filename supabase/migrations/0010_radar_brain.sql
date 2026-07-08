-- CÉREBRO VETORIAL POR CLIENTE
create extension if not exists vector;

-- DADOS BRUTOS EMBEDDADOS (memória cumulativa do agente por marca)
create table radar_raw_data (
  id          uuid primary key default gen_random_uuid(),
  marca_id    uuid not null references marcas(id) on delete cascade,
  fonte       text not null,           -- reddit | news | twitter
  conteudo    text not null,           -- sinal bruto (titulo + snippet)
  url         text,
  metadata    jsonb default '{}',      -- comentarios, upvotes, coletado_em, etc.
  embedding   vector(1024),            -- voyage-3
  created_at  timestamptz default now()
);

alter table radar_raw_data enable row level security;
create policy "auth_only" on radar_raw_data for all using (auth.role() = 'authenticated');

create index radar_raw_data_marca_id_idx on radar_raw_data(marca_id);
create index radar_raw_data_created_at_idx on radar_raw_data(created_at desc);
create index radar_raw_data_embedding_idx on radar_raw_data
  using hnsw (embedding vector_cosine_ops);

-- BUSCA POR SIMILARIDADE (memória histórica relevante de uma marca)
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
language sql
stable
as $$
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
$$;

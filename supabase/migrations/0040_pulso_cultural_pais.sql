-- ═══════════════════════════════════════════════════════════════════════════
-- PULSO CULTURAL — coluna `pais`
--
-- ATENÇÃO: esta migration JA FOI APLICADA em producao (20260803002307) via MCP,
-- sem que o arquivo local fosse escrito junto. Este arquivo existe para fechar o
-- drift: quem reconstruir o banco a partir de supabase/migrations precisa da
-- coluna, senao `selectAgenda` quebra. Tudo idempotente — reaplicar e no-op.
-- ═══════════════════════════════════════════════════════════════════════════

-- País do calendário a que a linha pertence. NULL = universal (vale em qualquer
-- calendário); ISO-2 = só entra para marcas daquele país.
--
-- Todas as 25 linhas existentes recebem 'BR' — inclusive as que PARECEM universais.
-- "Black Friday" tem os termos "promocao black friday" e "desconto"; "Comportamento
-- nas redes" tem "viralizou" e "todo mundo falando". O tema é global, a raspagem é
-- em português: uma marca australiana assinando essa linha raspa conversa brasileira
-- e recebe um briefing convincente sobre um público que não é o dela.
--
-- Por isso NULL fica reservado para linha que seja de fato agnóstica (termos em
-- língua neutra ou multi-idioma). Hoje não existe nenhuma. Preferimos agenda VAZIA
-- e visível a agenda cheia e errada.
alter table pulso_cultural add column if not exists pais text;

update pulso_cultural set pais = 'BR' where pais is null;

comment on column pulso_cultural.pais is
  'ISO-2 do calendário desta linha. NULL = universal (termos agnósticos de país). Filtrado em selectAgenda contra yaml_conhecimento.pais da marca (default BR).';

-- A agenda é lida a cada tick por marca, filtrando dominio + pais. Índice parcial
-- porque linha inativa nunca é selecionada.
create index if not exists pulso_cultural_dominio_pais_idx
  on pulso_cultural (dominio, pais) where ativo;

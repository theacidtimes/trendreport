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
-- Só troca a config das funções; assinatura e resultado são os mesmos.
--
-- Custo: cada query fica mais cara (≈50ms numa marca pequena, ≈260ms numa marca
-- sem sinais, porque o scan varre o índice inteiro). Por isso o memory.ts chama
-- o batch em lotes de 15. Se o banco crescer muito, o passo seguinte é
-- particionar radar_raw_data por marca_id (um HNSW por marca).

alter function match_radar_signals(uuid, vector, int, float)
  set hnsw.iterative_scan = 'strict_order';

alter function match_radar_signals_batch(uuid, vector[], float)
  set hnsw.iterative_scan = 'strict_order';

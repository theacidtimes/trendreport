-- Agenda `acao` do Brasil.
--
-- O domínio `acao` (esportes de ação e superação) nasceu na 0046 só com linhas
-- de MX, AR, CO e CL, porque até ali só o G-Shock LATAM o assinava. Em 05/10/2026
-- entrou o G-Shock BR (submarca separada da Casio Vintage, territórios diferentes),
-- e sem estas linhas o planner não teria nenhuma lane cultural de `acao` para ele:
-- a varredura sairia só com evergreen + termos da marca, sem dar erro nenhum.
--
-- Mesmas quatro âncoras do LATAM, com os termos como se fala aqui. Corrida e
-- skate com peso alto porque são onde estão os embaixadores do deck da marca
-- (Giovanni Vianna no skate, comunidade Strava na corrida).

insert into pulso_cultural (dominio, titulo, termos, peso, origem, pais) values
  ('acao','Skate',                   array['skate','street league','pista de skate'],             3, 'ancora','BR'),
  ('acao','Correr na cidade',        array['corrida de rua','treino de 10k','desafio no strava'],  2, 'ancora','BR'),
  ('acao','Luta e treino',           array['mma','luta ufc','treino de boxe'],                     2, 'ancora','BR'),
  ('acao','Ar livre',                array['trilha','acampamento','trekking'],                     1, 'ancora','BR');

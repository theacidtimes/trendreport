-- ═══════════════════════════════════════════════════════════════════════════
-- PULSO CULTURAL — calendario datado H2 2026 + inicio 2027 (agenda global)
--
-- Complementa o seed v1 da 0037, que era demonstrativo e deixava um buraco
-- jul→nov sem ancora datada. Datas CONFIRMADAS (pesquisa de calendarios de
-- marketing BR + agendas fixas de esporte/musica/tech), com janela = periodo
-- em que o assunto ferve (comeca antes do evento, fecha logo depois).
--
-- Todas GLOBAIS (tenant_id null): servem qualquer marca que assine o dominio.
-- O angulo de marca (telecom etc.) mora no filtro de DNA no radarPrompt, nao
-- na ancora — por isso os termos sao neutros/comportamentais, nao de produto.
--
-- Additive-only: so inserts. Nao toca planner/scoring/vetores nem marcas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ESPORTE — GP de Sao Paulo (Interlagos, corrida 08/nov). Momento de segunda tela.
insert into public.pulso_cultural (dominio, titulo, termos, janela_inicio, janela_fim, peso, origem) values
  ('esporte','GP de Sao Paulo F1', array['gp sao paulo','interlagos','formula 1 brasil'], '2026-10-30','2026-11-08', 3, 'ancora');

-- MUSICA — Rock in Rio 2026 (4-13/set). Cobertura ao vivo + festival.
insert into public.pulso_cultural (dominio, titulo, termos, janela_inicio, janela_fim, peso, origem) values
  ('musica','Rock in Rio', array['rock in rio','line up rock in rio','cidade do rock'], '2026-08-25','2026-09-14', 3, 'ancora');

-- MASSA — datas de varejo/comportamento com pico de conexao (gifting, familia, gaming infantil).
insert into public.pulso_cultural (dominio, titulo, termos, janela_inicio, janela_fim, peso, origem) values
  ('massa','Dia dos Pais',     array['dia dos pais','presente dia dos pais','o que dar de presente'], '2026-07-27','2026-08-09', 2, 'ancora'),
  ('massa','Dia das Criancas', array['dia das criancas','presente de crianca','brinquedo do momento'], '2026-10-01','2026-10-12', 3, 'ancora');

-- ECONOMIA — Dia do Cliente (15/set): pico de oferta/fidelidade/retencao.
insert into public.pulso_cultural (dominio, titulo, termos, janela_inicio, janela_fim, peso, origem) values
  ('economia','Dia do Cliente', array['dia do cliente','oferta dia do cliente','melhor plano'], '2026-09-08','2026-09-16', 2, 'ancora');

-- TECH — Dia da Internet Segura (10/fev/2027). Golpe, seguranca, conexao.
insert into public.pulso_cultural (dominio, titulo, termos, janela_inicio, janela_fim, peso, origem) values
  ('tech','Dia da Internet Segura', array['internet segura','golpe online','seguranca digital'], '2027-02-03','2027-02-11', 2, 'ancora');

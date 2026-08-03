-- ═══════════════════════════════════════════════════════════════════════════
-- PULSO CULTURAL — seis dominios novos, derivados da carteira real
--
-- O acervo tinha 6 dominios (massa, entretenimento, esporte, musica, tech,
-- economia) escolhidos por intuicao. A carteira de clientes pede outros seis, e
-- nenhum deles existia: uma produtora de sementes, um hospital, uma seguradora
-- vendida por corretor e uma marca de granola nao tinham NADA para assinar.
--
-- Estas linhas vieram de pesquisa das marcas (site, imprensa, redes), nao de
-- achismo — mas sao EXEMPLOS: a curadoria fina acontece na tela
-- (/dashboard/admin/agenda), que e justamente onde isto deixa de ser tarefa de
-- engenharia.
--
-- Regras que valem aqui como valiam na 0038:
--  - GLOBAIS (tenant_id null): servem qualquer marca que assine o dominio. O
--    angulo de marca mora no filtro de DNA no radarPrompt, nao na ancora — por
--    isso os termos sao comportamentais, nao de produto.
--  - termos = frase de conversa, minuscula, SEM acento (e assim que a lane de
--    busca casa; ver 0037/0038).
--  - `pais` = 'BR' explicito. Os termos sao em portugues; linha em portugues
--    NAO e universal.
--  - Additive-only: so inserts. Nao toca planner/scoring/vetores nem marcas.
--
-- Datada vs perene: perene (janela null) e SENSOR, sempre ligado. Datada so
-- entra na janela e tem prioridade sobre perene quando vigente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── AGRO ──────────────────────────────────────────────────────────────────
-- Publico e produtor rural e agronomo; a conversa e tecnica e sazonal. O ano
-- inteiro do agro e um calendario, entao aqui a datada pesa mais que o normal.
-- Vazio sanitario e a janela legal sem soja viva no campo (MAPA/Famato, ~15/06
-- a 15/09 em MT) — esta VIGENTE hoje, e a primeira datada ativa fora de `massa`.
insert into public.pulso_cultural (dominio, titulo, termos, janela_inicio, janela_fim, peso, origem, pais) values
  ('agro','Vazio sanitario da soja', array['vazio sanitario','pode plantar ja','multa do vazio'],       '2026-06-15','2026-09-15', 2, 'ancora','BR'),
  ('agro','Plantio da safra',        array['plantio da soja','janela de plantio','chuva pra plantar'],  '2026-09-16','2026-11-15', 3, 'ancora','BR'),
  -- Show Rural Coopavel: a edicao 2026 foi 09-13/02 e ja passou. A janela abaixo
  -- e a edicao 2027 SUPOSTA pela cadencia (sempre inicio de fevereiro) — data
  -- NAO confirmada. Peso 1 de proposito: se estiver errada, custa pouco.
  ('agro','Show Rural Coopavel',     array['show rural','feira do agro','lancamento no estande'],       '2027-02-01','2027-02-14', 1, 'ancora','BR');

insert into public.pulso_cultural (dominio, titulo, termos, peso, origem, pais) values
  ('agro','Preco da saca',    array['preco da saca','dolar hoje','custo do insumo'],          3, 'ancora','BR'),
  ('agro','Praga na lavoura', array['ferrugem asiatica','lagarta na soja','perdi a lavoura'], 2, 'ancora','BR');

-- ─── CLIMA ─────────────────────────────────────────────────────────────────
-- Pedido explicito do brief de Bradesco Seguros: "eventos co-relatos a
-- contratacao de seguros — ex: chuvas fortes no periodo contam". Evento
-- climatico e gancho de corretor SEM falar de seguro. Serve tambem ao agro.
-- Os termos evitam o tom alarmista que o DNA da marca proibe: sao a fala de
-- quem esta passando pelo evento, nao a manchete sobre a tragedia.
insert into public.pulso_cultural (dominio, titulo, termos, peso, origem, pais) values
  ('clima','Temporal que alagou',  array['alagou tudo','carro na enchente','sem luz desde ontem'],       3, 'ancora','BR'),
  ('clima','Seca e calor extremo', array['calor insuportavel','sem chuva ha semanas','nivel do reservatorio'], 2, 'ancora','BR');

insert into public.pulso_cultural (dominio, titulo, termos, janela_inicio, janela_fim, peso, origem, pais) values
  ('clima','Friagem no Sul', array['geada na lavoura','frio recorde','perdeu a plantacao'], '2026-06-01','2026-08-31', 2, 'ancora','BR');

-- ─── SAUDE ─────────────────────────────────────────────────────────────────
-- Fica no nivel de SAUDE de proposito. `oncologia` teria exatamente um
-- assinante — isso e config de marca fantasiada de agenda, e o dominio e a
-- unidade de compartilhamento. O vocabulario de paciente (quimio, remissao,
-- peruca oncologica) e alto valor e baixo volume: mora em `termos_culturais`,
-- no DNA da marca, nao aqui.
insert into public.pulso_cultural (dominio, titulo, termos, peso, origem, pais) values
  ('saude','Exame que a gente adia', array['fazer check up','resultado do exame','medo de medico'], 3, 'ancora','BR'),
  ('saude','Fila e plano negado',    array['demora do sus','plano negou','consulta particular'],    2, 'ancora','BR');

insert into public.pulso_cultural (dominio, titulo, termos, janela_inicio, janela_fim, peso, origem, pais) values
  ('saude','Setembro Amarelo', array['setembro amarelo','pedir ajuda','saude mental'],    '2026-09-01','2026-09-30', 2, 'ancora','BR'),
  ('saude','Outubro Rosa',     array['outubro rosa','fiz a mamografia','autoexame'],      '2026-10-01','2026-10-31', 3, 'ancora','BR');

-- ─── GAMES ─────────────────────────────────────────────────────────────────
-- Separado de `entretenimento` porque a conversa de game e de comunidade e tem
-- vocabulario proprio (patch, reembolso, injogavel) que nao aparece em cinema
-- ou streaming.
insert into public.pulso_cultural (dominio, titulo, termos, peso, origem, pais) values
  ('games','Vale a pena comprar', array['vale a pena comprar','esperar cair de preco','ja ta jogando'],   3, 'ancora','BR'),
  ('games','Lancamento quebrado', array['injogavel','patch de correcao','pedindo reembolso'],             2, 'ancora','BR'),
  ('games','Adaptacao pra tela',  array['serie do jogo','respeitou o original','erraram o personagem'],   2, 'ancora','BR');

-- Gamescom: fim de agosto todo ano. Data de 2026 NAO confirmada — janela larga
-- de proposito para nao errar por um dia.
insert into public.pulso_cultural (dominio, titulo, termos, janela_inicio, janela_fim, peso, origem, pais) values
  ('games','Gamescom', array['gamescom','trailer novo','data de lancamento'], '2026-08-22','2026-08-31', 2, 'ancora','BR');

-- ─── TRABALHO ──────────────────────────────────────────────────────────────
-- Tudo perene: a conversa sobre trabalho nao tem calendario, tem ciclo. Estas
-- tres linhas sao SENSOR forte e gancho de publicacao delicado — ver a nota
-- sobre escutar-vs-publicar no fim do arquivo.
insert into public.pulso_cultural (dominio, titulo, termos, peso, origem, pais) values
  ('trabalho','Volta ao presencial',   array['voltar pro escritorio','home office acabou','quatro dias por semana'], 3, 'ancora','BR'),
  ('trabalho','Esgotado no trabalho',  array['pedi demissao','nao aguento mais','saude mental no trabalho'],         3, 'ancora','BR'),
  ('trabalho','Beneficio que importa', array['vale academia','beneficio de verdade','a empresa paga'],               2, 'ancora','BR');

-- ─── ALIMENTACAO ───────────────────────────────────────────────────────────
-- Termos em PORTUGUES, e este e o ganho pratico da correcao de pais da
-- Australia Vibes (ex-Hart's Natural): marca brasileira, publico brasileiro.
-- "Projeto verao" e datada de hemisferio SUL — dez a fev.
insert into public.pulso_cultural (dominio, titulo, termos, peso, origem, pais) values
  ('alimentacao','Meta de proteina',  array['cafe da manha proteico','bateu a meta de proteina','quanto de proteina'], 3, 'ancora','BR'),
  ('alimentacao','Li o rotulo',       array['ultraprocessado rotulo','li o rotulo','ingrediente estranho'],            3, 'ancora','BR'),
  ('alimentacao','Low carb funciona', array['low carb funciona','granola caseira','sem acucar de verdade'],            2, 'ancora','BR');

insert into public.pulso_cultural (dominio, titulo, termos, janela_inicio, janela_fim, peso, origem, pais) values
  ('alimentacao','Projeto verao', array['projeto verao','voltar pra rotina','comecar segunda'], '2026-12-26','2027-02-15', 2, 'ancora','BR');

-- ═══════════════════════════════════════════════════════════════════════════
-- ABERTO, de proposito nao resolvido aqui: a agenda nao distingue ESCUTAR de
-- PUBLICAR. Toda linha vigente vira insumo de pauta. "Esgotado no trabalho" e
-- sensor otimo para o Wellhub e gancho de post pessimo; o mesmo vale para
-- diagnostico de famoso no dominio `saude`. Se a distincao virar necessaria, o
-- lugar dela e uma coluna aqui (`uso`: sensor | pauta | ambos) — nao um dominio
-- separado, que fragmentaria o compartilhamento.
-- ═══════════════════════════════════════════════════════════════════════════

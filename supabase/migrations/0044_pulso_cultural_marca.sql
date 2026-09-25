-- ═══════════════════════════════════════════════════════════════════════════
-- PULSO CULTURAL — linha PROPRIA de marca (`marca_id`) + calendario do
-- Planejamento Corretor 2026 (Bradesco Seguros)
--
-- Cada cliente tem data e pulso que so ele vive: Dia do Corretor para a
-- Bradesco, lancamento de produto da Vivo, data da Conta Simples. O acervo tinha
-- so dois escopos, e nenhum servia:
--  - global (tenant_id null): vale para toda marca que assina o dominio;
--  - tenant (tenant_id): o tenant e a AGENCIA. As 6 marcas da Caramelo (Copag,
--    Casio, Bradesco, Conta Simples, VOLL, Vivo) moram no MESMO tenant — linha
--    "so da Bradesco" por tenant_id cairia na agenda da Vivo.
--
-- `marca_id` e o terceiro escopo. Regras (lib/radar/planner.ts selectAgenda):
--  - linha propria entra na agenda DAQUELA marca sem depender de assinatura de
--    dominio: o calendario do proprio cliente e relevante por definicao, e
--    amarrar a assinatura faria a data sumir quando a re-derivacao trocasse os
--    dominios, sem erro nenhum;
--  - nunca entra em outra marca;
--  - pais e janela continuam valendo; no empate de peso ganha da de dominio;
--  - NAO conta no vocabulario de dominios (agendaDominios.ts) — senao o dominio
--    em que ela foi arquivada viraria opcao na derivacao de todas as marcas.
-- tenant_id da linha propria = tenant da marca (salvarLinha herda), pra RLS.
--
-- A regra de ONDE cada coisa mora, pra nao virar dois jeitos de dizer o mesmo:
--  - agenda global ........ tema/data que serve a varias marcas
--  - agenda propria ....... DATA ou pulso de um cliente so (esta coluna)
--  - termos_culturais ..... tema perene da marca (vai no DNA, nao aqui)
--
-- Fonte das linhas: deck "Planejamento_Corretor_2026_15_09" (Com Voce
-- Corretor+), slides 7, 18, 35 e 36. Fica DE FORA: Exposeg, Enconseg,
-- Consegnne, Sincor, MDRT — trade, conversa na imprensa do setor, nao no trio
-- reddit/tiktok/twitter.
--
-- termos = frase de conversa, minuscula, SEM acento, ate 3. pais = 'BR'.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.pulso_cultural
  add column if not exists marca_id uuid references public.marcas(id) on delete cascade;

comment on column public.pulso_cultural.marca_id is
  'Linha PROPRIA de uma marca: entra so na agenda dela, sem depender de dominios_culturais. null = linha de dominio (global ou do tenant). Nao usar tenant_id pra isso: o tenant e a agencia.';

create index if not exists pulso_cultural_marca_idx
  on public.pulso_cultural (marca_id) where marca_id is not null;

-- ─── GLOBAIS ───────────────────────────────────────────────────────────────
-- "Envelhecer bem" e o fio mais forte do deck (Circuito da Longevidade em 6
-- cidades + Forum da Longevidade em 17/11) e nao existia no acervo. NAO e o
-- "Cuidar dos pais" (0041): aquele e o filho olhando pros pais; este e a pessoa
-- olhando pro proprio futuro — corrida depois dos 50, dinheiro pra aposentar.
-- Serve a saude, previdencia, esporte, alimentacao.
insert into public.pulso_cultural (dominio, titulo, termos, peso, origem, pais) values
  ('saude','Envelhecer bem', array['envelhecer bem','longevidade','qualidade de vida depois dos 50'], 2, 'ancora','BR');

-- Dia Mundial da Saude (07/04): calendario do cliente, mas data universal.
insert into public.pulso_cultural (dominio, titulo, termos, janela_inicio, janela_fim, peso, origem, pais) values
  ('saude','Dia Mundial da Saude', array['dia mundial da saude','cuidar da saude','fazer check up'], '2027-04-01','2027-04-10', 2, 'ancora','BR');

-- ─── PROPRIAS da Bradesco Seguros ──────────────────────────────────────────
-- So DATADAS. Tema perene da marca (carro eletrico, previdencia, o corretor
-- que posta) vai em yaml_conhecimento.termos_culturais.
--  - Dia do Corretor (12/10) — Campanha Mes do Corretor, plano com TV/PR.
--  - Dia do Seguro (14/05) + Quinzena do Seguro (4 a 18/05): uma janela so.
-- `dominio` aqui e so rotulo na tela (a linha propria nao depende dele).
-- Insert via SELECT em marcas: sem a marca (branch, reset local) vira no-op.
insert into public.pulso_cultural (marca_id, tenant_id, dominio, titulo, termos, janela_inicio, janela_fim, peso, origem, pais)
select m.id, m.tenant_id, v.dominio, v.titulo, v.termos, v.ini::date, v.fim::date, v.peso, 'ancora', 'BR'
from public.marcas m
cross join (values
  ('trabalho','Dia do Corretor', array['dia do corretor','corretor de seguros','profissao corretor'], '2026-10-05', '2026-10-16', 3),
  ('economia','Dia do Seguro',   array['dia do seguro','vale a pena ter seguro','fazer um seguro'],   '2027-05-04', '2027-05-18', 2)
) as v(dominio, titulo, termos, ini, fim, peso)
where m.id = 'b637369a-e702-4172-9648-c69570940589';

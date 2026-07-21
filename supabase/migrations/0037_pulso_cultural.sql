-- ═══════════════════════════════════════════════════════════════════════════
-- PULSO CULTURAL (Fase 6, Fatia 1) — agenda cultural compartilhada do radar
--
-- Camada BRAND-AGNOSTICA: o que o pais esta olhando numa janela movel. Computada
-- uma vez por ciclo e reusada por todas as marcas que ASSINAM o dominio (via
-- marcas.yaml_conhecimento.dominios_culturais). Substitui o teto de 3 termos
-- culturais estaticos por clusters focados, selecionados por dominio + janela.
--
-- tenant_id NULL = agenda global curada pela ACID (vale pra todos). tenant_id
-- preenchido = agenda propria de um tenant. Ancoras datadas (Oscar em marco,
-- junino em junho) usam janela; perenes (Brasileirao) deixam janela NULL.
--
-- Additive-only: nao toca radar/scoring/vetores. O planner (lib/radar/planner.ts)
-- le esta tabela; marca sem dominios_culturais cai no comportamento atual.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.pulso_cultural (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.tenants(id) on delete cascade,  -- null = global ACID
  dominio       text not null,          -- esporte|entretenimento|musica|massa|tech|economia
  titulo        text not null,          -- legivel ("Final do Brasileirao", "Oscar")
  termos        text[] not null,        -- busca focada, ate 3 termos por cluster
  janela_inicio date,                   -- null = perene (vale o ano todo)
  janela_fim    date,                   -- null = perene
  peso          int  not null default 1,     -- ordena selecao quando ha mais que o CAP
  ativo         boolean not null default true,
  origem        text not null default 'ancora',  -- ancora | emergente
  created_at    timestamptz not null default now()
);

-- Selecao do planner: dominio + vigencia da janela. ativo no filtro pra nao varrer index morto.
create index pulso_cultural_dominio_idx on public.pulso_cultural(dominio) where ativo;
create index pulso_cultural_janela_idx  on public.pulso_cultural(janela_inicio, janela_fim);
create index pulso_cultural_tenant_idx  on public.pulso_cultural(tenant_id);

-- ───────────────────────────────────────────────────────────────────────────
-- RLS — segue o padrao tenant_isolation (0015). Diferenca: rows GLOBAIS
-- (tenant_id null) sao legiveis por QUALQUER tenant (agenda compartilhada).
-- Escrita: ACID gere o global; tenant so gere as proprias rows (o with check
-- barra tenant nao-acid de gravar tenant_id null, pois null != jwt_tenant_id()).
-- service_role (worker) bypassa RLS — seeds e leitura do radar passam direto.
-- ───────────────────────────────────────────────────────────────────────────
alter table public.pulso_cultural enable row level security;

create policy "pulso read" on public.pulso_cultural
  for select to authenticated
  using (
    tenant_id is null
    or tenant_id = public.jwt_tenant_id()
    or public.jwt_tenant_id() is null
    or public.is_acid_admin()
  );

create policy "pulso write" on public.pulso_cultural
  for all to authenticated
  using (tenant_id = public.jwt_tenant_id() or public.is_acid_admin())
  with check (tenant_id = public.jwt_tenant_id() or public.is_acid_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED — agenda global v1 (tenant_id null). Perenes com janela NULL; datadas
-- com janela pra demonstrar a sazonalidade (fora da janela nao disparam). Termos
-- sao chaves de busca BR focadas (<=3), o que o scraper consome em cada cluster.
-- ═══════════════════════════════════════════════════════════════════════════

-- ESPORTE
insert into public.pulso_cultural (dominio, titulo, termos, peso) values
  ('esporte','Brasileirao',        array['brasileirao','jogo do meu time','tabela brasileirao'], 3),
  ('esporte','Formula 1',          array['formula 1','gp de','corrida f1'], 2),
  ('esporte','Futebol na TV',      array['assistir jogo','onde passa o jogo','jogo ao vivo'], 2);

-- ENTRETENIMENTO
insert into public.pulso_cultural (dominio, titulo, termos, peso) values
  ('entretenimento','Lancamentos de streaming', array['estreia netflix','serie nova','lancamento streaming'], 3),
  ('entretenimento','Final de novela',          array['final de novela','ultimo capitulo novela','novela das nove'], 2),
  ('entretenimento','Estreias de cinema',       array['estreia cinema','filme novo','bilheteria'], 1);

-- MUSICA
insert into public.pulso_cultural (dominio, titulo, termos, peso) values
  ('musica','Shows e turnes',    array['show no brasil','turne','ingresso show'], 2),
  ('musica','Festivais',         array['festival de musica','line up festival','rock in rio'], 2),
  ('musica','Lancamentos musicais', array['album novo','lancamento musica','clipe novo'], 1);

-- MASSA (comportamento e cultura de internet, sempre vivo)
insert into public.pulso_cultural (dominio, titulo, termos, peso) values
  ('massa','Comportamento nas redes', array['viralizou','trend do tiktok','todo mundo falando'], 3),
  ('massa','Meme do momento',         array['meme','isso ta em todo lugar','virou meme'], 2);

-- TECH
insert into public.pulso_cultural (dominio, titulo, termos, peso) values
  ('tech','IA no dia a dia',    array['inteligencia artificial','chatgpt','usei ia pra'], 2),
  ('tech','Lancamento de gadget', array['lancamento celular','review gadget','vale a pena comprar'], 1);

-- ECONOMIA
insert into public.pulso_cultural (dominio, titulo, termos, peso) values
  ('economia','Bolso do brasileiro', array['preco subiu','ta caro','economia do dia a dia'], 2);

-- DATADAS (janela sazonal — nao disparam fora do periodo). Exemplos p/ 2026.
insert into public.pulso_cultural (dominio, titulo, termos, janela_inicio, janela_fim, peso) values
  ('massa','Volta as aulas',   array['volta as aulas','material escolar','primeiro dia de aula'], '2026-01-15','2026-02-15', 2),
  ('massa','Festas Juninas',   array['festa junina','arraia','quadrilha'],                        '2026-06-01','2026-06-30', 2),
  ('entretenimento','Oscar',   array['oscar','premiacao oscar','melhor filme'],                   '2027-02-20','2027-03-15', 2),
  ('massa','Black Friday',     array['black friday','promocao black friday','desconto'],          '2026-11-15','2026-11-30', 3),
  ('massa','Natal e Reveillon',array['natal','ceia de natal','reveillon'],                        '2026-12-10','2027-01-02', 3);

-- ═══════════════════════════════════════════════════════════════════════════
-- FABRIC LAKE (Fase 5, Fatia 1) — substrato de percepcao cross-tenant da ACID
--
-- Camada de inteligencia AGREGADA e DES-IDENTIFICADA. Nao guarda marca, tenant,
-- url, autor nem texto bruto: guarda a LEITURA (tags do vocabulario controlado)
-- + o vetor + metadado neutro. E o insumo que a ACID cruza/vende sem expor o
-- briefing de ninguem — o que foi raspado nem da marca e, e de terceiros.
--
-- DORMENTE nesta fatia: nada escreve aqui ainda (o fork em processMemory vem na
-- Fatia 3, atras de env flag desligada). Additive-only, nao toca no radar atual.
--
-- Schema proprio `fabric_lake`: NAO exposto no PostgREST (so `public` e exposto),
-- defesa em profundidade alem da RLS. anon/authenticated nem tem USAGE no schema.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists vector;

create schema if not exists fabric_lake;

-- Trancar o schema: so o dono/service_role transita. Sem USAGE pra anon/auth,
-- entao mesmo que o PostgREST fosse reconfigurado, nao ha porta de entrada.
revoke all on schema fabric_lake from public;
revoke usage on schema fabric_lake from anon, authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- TAXONOMIA — o vocabulario controlado como DADO versionado (IP/lente da ACID).
-- Editavel sem DDL: novas versoes, novos termos, ativar/desativar. Nao e enum
-- hardcoded de proposito — a "lente" evolui e cada signal aponta pra versao que
-- o interpretou (signal.taxonomia_versao), preservando comparabilidade no tempo.
-- ───────────────────────────────────────────────────────────────────────────
create table fabric_lake.taxonomia (
  id         uuid primary key default gen_random_uuid(),
  versao     int  not null,
  dimensao   text not null,   -- setor|plataforma|formato|regiao|idioma|momento|
                              -- comportamento|emocao|inflexao|lente_negocio
  termo      text not null,   -- slug controlado (o valor que vai no signal)
  rotulo     text not null,   -- rotulo legivel
  descricao  text,            -- guia de anotacao (o que qualifica pra essa tag)
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (versao, dimensao, termo)
);

create index taxonomia_versao_dim_idx on fabric_lake.taxonomia(versao, dimensao);

-- ───────────────────────────────────────────────────────────────────────────
-- SIGNAL — o substrato. Uma leitura des-identificada por sinal cultural.
-- DELIBERADAMENTE SEM: marca_id, tenant_id, url, autor, texto bruto.
-- tema_deid = tema em linguagem neutra (sem nome de marca/produto/pessoa).
-- engajamento_faixa = bucket (ex. baixo/medio/alto), nunca numero cru rastreavel.
-- ───────────────────────────────────────────────────────────────────────────
create table fabric_lake.signal (
  id               uuid primary key default gen_random_uuid(),

  -- tempo
  occurred_at      timestamptz,              -- quando o sinal aconteceu (post)
  ingested_at      timestamptz not null default now(),

  -- dimensoes estruturais (termos da taxonomia vigente)
  setor            text,
  plataforma       text,
  formato          text,
  regiao           text,
  idioma           text,
  momento          text,

  -- dimensoes semanticas (multi-valor: um sinal carrega varias leituras)
  comportamento    text[] not null default '{}',
  emocao           text[] not null default '{}',
  inflexao         text[] not null default '{}',
  lente_negocio    text[] not null default '{}',

  -- payload neutro
  tema_deid        text,                     -- tema des-identificado
  engajamento_faixa text,                    -- bucket, nunca numero cru
  embedding        vector(1024),             -- voyage-3, ja pago no run do cliente

  -- proveniencia da leitura (comparabilidade no tempo)
  taxonomia_versao int,
  modelo_versao    text
);

create index signal_occurred_at_idx on fabric_lake.signal(occurred_at desc);
create index signal_setor_idx       on fabric_lake.signal(setor);
create index signal_ingested_at_idx on fabric_lake.signal(ingested_at desc);
create index signal_embedding_idx   on fabric_lake.signal
  using hnsw (embedding vector_cosine_ops);

-- ───────────────────────────────────────────────────────────────────────────
-- RLS — trancado. service_role bypassa (writes do worker). Leitura so pra
-- super-admin ACID (console futuro). anon/authenticated: negados por ausencia
-- de policy E por ausencia de USAGE no schema (duplo cinto).
-- ───────────────────────────────────────────────────────────────────────────
alter table fabric_lake.taxonomia enable row level security;
alter table fabric_lake.signal    enable row level security;

create policy "acid admin le taxonomia" on fabric_lake.taxonomia
  for select to authenticated using (public.is_acid_admin());

create policy "acid admin le signal" on fabric_lake.signal
  for select to authenticated using (public.is_acid_admin());

-- Sem grants pra anon/authenticated nas tabelas (o USAGE ausente ja barra;
-- explicito por seguranca caso o gotcha de ALTER DEFAULT PRIVILEGES aja).
revoke all on all tables in schema fabric_lake from anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEED — taxonomia v1 (RASCUNHO editavel). Estruturais + 4 rodas semanticas.
-- ═══════════════════════════════════════════════════════════════════════════

-- setor (~15, mapeaveis a GICS/IAB no futuro)
insert into fabric_lake.taxonomia (versao, dimensao, termo, rotulo) values
  (1,'setor','tecnologia','Tecnologia'),
  (1,'setor','financas','Financas'),
  (1,'setor','saude_bem_estar','Saude e bem-estar'),
  (1,'setor','beleza','Beleza e cosmeticos'),
  (1,'setor','moda','Moda e vestuario'),
  (1,'setor','alimentos_bebidas','Alimentos e bebidas'),
  (1,'setor','varejo','Varejo e e-commerce'),
  (1,'setor','automotivo','Automotivo e mobilidade'),
  (1,'setor','viagem','Viagem e turismo'),
  (1,'setor','entretenimento','Entretenimento e midia'),
  (1,'setor','games','Games'),
  (1,'setor','educacao','Educacao'),
  (1,'setor','esportes','Esportes'),
  (1,'setor','casa_decoracao','Casa e decoracao'),
  (1,'setor','pets','Pets');

-- plataforma
insert into fabric_lake.taxonomia (versao, dimensao, termo, rotulo) values
  (1,'plataforma','reddit','Reddit'),
  (1,'plataforma','news','Noticias'),
  (1,'plataforma','twitter','X / Twitter'),
  (1,'plataforma','instagram','Instagram'),
  (1,'plataforma','tiktok','TikTok'),
  (1,'plataforma','youtube','YouTube'),
  (1,'plataforma','linkedin','LinkedIn');

-- formato
insert into fabric_lake.taxonomia (versao, dimensao, termo, rotulo) values
  (1,'formato','post','Post'),
  (1,'formato','comentario','Comentario'),
  (1,'formato','video','Video'),
  (1,'formato','artigo','Artigo'),
  (1,'formato','thread','Thread'),
  (1,'formato','review','Review');

-- regiao
insert into fabric_lake.taxonomia (versao, dimensao, termo, rotulo) values
  (1,'regiao','br','Brasil'),
  (1,'regiao','latam','America Latina'),
  (1,'regiao','us','Estados Unidos'),
  (1,'regiao','eu','Europa'),
  (1,'regiao','global','Global');

-- idioma
insert into fabric_lake.taxonomia (versao, dimensao, termo, rotulo) values
  (1,'idioma','pt','Portugues'),
  (1,'idioma','en','Ingles'),
  (1,'idioma','es','Espanhol');

-- momento (estagio do ciclo do sinal — rascunho)
insert into fabric_lake.taxonomia (versao, dimensao, termo, rotulo) values
  (1,'momento','emergente','Emergente'),
  (1,'momento','crescimento','Em crescimento'),
  (1,'momento','pico','Pico'),
  (1,'momento','declinio','Em declinio'),
  (1,'momento','residual','Residual');

-- comportamento (o que a pessoa esta FAZENDO com o tema)
insert into fabric_lake.taxonomia (versao, dimensao, termo, rotulo, descricao) values
  (1,'comportamento','adocao','Adocao','Adotando/incorporando o tema no cotidiano'),
  (1,'comportamento','rejeicao','Rejeicao','Rejeitando ativamente'),
  (1,'comportamento','ritual','Ritual','Repeticao com significado, virou habito/ritual'),
  (1,'comportamento','gambiarra','Gambiarra','Uso improvisado/desviado do previsto'),
  (1,'comportamento','sinalizacao_status','Sinalizacao de status','Usando pra sinalizar pertencimento/status'),
  (1,'comportamento','advocacia','Advocacia','Defendendo/recomendando publicamente'),
  (1,'comportamento','boicote','Boicote','Mobilizando contra'),
  (1,'comportamento','experimentacao','Experimentacao','Testando, ainda sem convicao'),
  (1,'comportamento','abandono','Abandono','Largando algo que fazia'),
  (1,'comportamento','migracao','Migracao','Trocando por alternativa'),
  (1,'comportamento','apropriacao_remix','Apropriacao/remix','Ressignificando e recombinando');

-- emocao (o TOM afetivo dominante)
insert into fabric_lake.taxonomia (versao, dimensao, termo, rotulo) values
  (1,'emocao','frustracao','Frustracao'),
  (1,'emocao','desejo','Desejo'),
  (1,'emocao','orgulho','Orgulho'),
  (1,'emocao','ansiedade','Ansiedade'),
  (1,'emocao','humor_ironia','Humor/ironia'),
  (1,'emocao','indignacao','Indignacao'),
  (1,'emocao','nostalgia','Nostalgia'),
  (1,'emocao','esperanca','Esperanca'),
  (1,'emocao','tedio','Tedio'),
  (1,'emocao','pertencimento','Pertencimento'),
  (1,'emocao','vergonha','Vergonha');

-- inflexao (a MUDANCA cultural que o sinal denuncia)
insert into fabric_lake.taxonomia (versao, dimensao, termo, rotulo, descricao) values
  (1,'inflexao','norma_se_formando','Norma se formando','Um novo padrao comeca a virar regra'),
  (1,'inflexao','norma_quebrando','Norma quebrando','Um padrao antes dado como certo se desfaz'),
  (1,'inflexao','contradicao_emergindo','Contradicao emergindo','Discurso e pratica divergindo'),
  (1,'inflexao','backlash','Backlash','Reacao contraria a algo que subiu'),
  (1,'inflexao','nicho_virando_massa','Nicho virando massa','Sai da bolha pro mainstream'),
  (1,'inflexao','fragmentacao','Fragmentacao','Um consenso se parte em subgrupos'),
  (1,'inflexao','ressignificacao','Ressignificacao','O sentido de algo muda'),
  (1,'inflexao','saturacao','Saturacao','Cansaco/excesso de algo antes desejado');

-- lente_negocio (a TRADUCAO pra oportunidade)
insert into fabric_lake.taxonomia (versao, dimensao, termo, rotulo, descricao) values
  (1,'lente_negocio','demanda_latente','Demanda latente','Querer nao atendido pelo mercado'),
  (1,'lente_negocio','dor_nao_atendida','Dor nao atendida','Problema recorrente sem solucao boa'),
  (1,'lente_negocio','novo_ritual_consumo','Novo ritual de consumo','Forma emergente de consumir'),
  (1,'lente_negocio','mudanca_de_linguagem','Mudanca de linguagem','Vocabulario/codigo mudando'),
  (1,'lente_negocio','objecao','Objecao','Barreira que trava adocao'),
  (1,'lente_negocio','categoria_em_disputa','Categoria em disputa','Territorio sem lider claro');

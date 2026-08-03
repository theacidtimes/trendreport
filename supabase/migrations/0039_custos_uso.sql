-- CUSTO REAL (US$) POR TENANT.
--
-- Por que uma tabela nova em vez de reaproveitar o creditos_ledger: são duas
-- perguntas diferentes e elas DIVERGEM.
--   creditos_ledger -> "quantas unidades de trabalho o tenant consumiu?"
--                      1 varredura = 1 crédito, 1 report = 1 crédito. Contagem.
--   custos_uso      -> "quantos dólares essa unidade custou no cartão da ACID?"
-- Uma varredura dispara ~11 runs na Apify; outra marca, com agenda cultural
-- cheia, dispara 15. As duas debitam 1 crédito e custam valores diferentes.
-- Com o cartão corporativo da ACID pagando o plano inteiro, essa diferença
-- deixou de ser detalhe contábil: é margem por cliente.
--
-- Granularidade: 1 linha por evento de custo do fornecedor (1 run da Apify,
-- 1 chamada ao Anthropic), não por varredura. Assim dá pra abrir o custo por
-- fonte (reddit vs. tiktok) e descobrir onde o dinheiro vaza.

create table custos_uso (
  id          uuid primary key default gen_random_uuid(),
  -- NULL = custo real que existe na fatura mas ainda não sabemos de quem é
  -- (ver nota sobre reports abaixo). Deixar nulo é proposital: preferimos uma
  -- linha honesta "não atribuído" a somar no tenant errado ou sumir com o
  -- dinheiro. O total sempre reconcilia com a fatura da Apify.
  tenant_id   uuid references tenants(id) on delete set null,
  marca_id    uuid references marcas(id) on delete set null,
  origem      text not null check (origem in ('radar','report','desconhecido')),
  provedor    text not null check (provedor in ('apify','anthropic')),
  -- fonte do scrape ('reddit','tiktok'...) quando apify; modelo quando anthropic.
  detalhe     text,
  -- Chave natural do evento no fornecedor: o run id da Apify, ou
  -- 'radar_run:<uuid>' pra chamada de LLM. É o que garante idempotência.
  ref         text not null,
  custo_usd   numeric(12,6) not null default 0,
  tokens_in   integer,
  tokens_out  integer,
  -- QUANDO o custo aconteceu no fornecedor (startedAt do run), separado de
  -- created_at (quando nós registramos). O backfill importa histórico: sem essa
  -- separação, todo o passado apareceria como gasto de hoje.
  ocorrido_em timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  -- IDEMPOTÊNCIA DURA. O poll do radar reprocessa job e o backfill roda de novo
  -- sobre a mesma janela; sem isto, custo dobrava a cada re-execução. Com isto,
  -- gravação vira upsert com ignoreDuplicates e re-rodar é seguro por
  -- construção — não por disciplina de quem chama.
  unique (provedor, ref)
);

create index custos_uso_tenant_idx on custos_uso(tenant_id, ocorrido_em desc);
create index custos_uso_marca_idx  on custos_uso(marca_id, ocorrido_em desc);

alter table custos_uso enable row level security;

-- Tenant lê o próprio custo; ACID lê tudo. Sem insert/update por authenticated:
-- quem escreve é o radar/backfill via service_role (bypassa RLS).
create policy "tenant_read" on custos_uso for select to authenticated
  using (tenant_id = public.jwt_tenant_id() or public.is_acid_admin());

-- ══ CONSOLE ACID: custo por tenant ═════════════════════════════════════════
-- Uma linha por tenant + UMA LINHA EXTRA com tenant_id null ("não atribuído"),
-- pra soma da tela bater com a fatura da Apify em vez de bater só com a parte
-- que a gente consegue explicar.
--
-- custo_por_credito é o número que interessa pra precificar: quanto custou, de
-- verdade, cada crédito que aquele tenant queimou no período.
create or replace function public.acid_custos_tenants(p_dias int default 30)
returns table(
  tenant_id        uuid,
  nome             text,
  custo_apify      numeric,
  custo_anthropic  numeric,
  custo_total      numeric,
  varreduras       int,
  reports          int,
  creditos_gastos  int,
  custo_por_credito numeric,
  saldo_creditos   int
)
language plpgsql stable security definer set search_path = public as $$
declare v_desde timestamptz := now() - make_interval(days => greatest(p_dias, 1));
begin
  if not public.is_acid_admin() then
    raise exception 'Apenas a ACID pode ver custos por tenant.';
  end if;
  return query
  with custo as (
    select c.tenant_id as tid,
           coalesce(sum(c.custo_usd) filter (where c.provedor = 'apify'), 0)     as apify,
           coalesce(sum(c.custo_usd) filter (where c.provedor = 'anthropic'), 0) as anthropic,
           coalesce(sum(c.custo_usd), 0)                                         as total
      from custos_uso c
     where c.ocorrido_em >= v_desde
     group by c.tenant_id
  ),
  consumo as (
    select l.tenant_id as tid,
           count(*) filter (where l.motivo = 'radar_run')::int as varreduras,
           count(*) filter (where l.motivo = 'report')::int    as reports,
           -- SÓ trabalho executado. 'ajuste' é lançamento contábil (a ACID
           -- rebaixou um saldo placeholder, por exemplo) e 'recarga' é entrada:
           -- nenhum dos dois consumiu fornecedor. Somá-los inflava o
           -- denominador e fazia o custo por crédito despencar — na primeira
           -- leitura real deu US$0,06 quando o número verdadeiro é ~US$0,70.
           coalesce(-sum(l.delta) filter (
             where l.delta < 0 and l.motivo in ('radar_run','report')
           ), 0)::int as creditos
      from creditos_ledger l
     where l.created_at >= v_desde
     group by l.tenant_id
  )
  select
    t.id,
    t.nome,
    round(coalesce(cu.apify, 0), 4),
    round(coalesce(cu.anthropic, 0), 4),
    round(coalesce(cu.total, 0), 4),
    coalesce(co.varreduras, 0),
    coalesce(co.reports, 0),
    coalesce(co.creditos, 0),
    -- Sem crédito gasto no período não existe "custo por crédito" — null é a
    -- resposta honesta, não zero (zero sugeriria que saiu de graça).
    case when coalesce(co.creditos, 0) > 0
         then round(coalesce(cu.total, 0) / co.creditos, 4) end,
    t.saldo_creditos
  from tenants t
  left join custo   cu on cu.tid = t.id
  left join consumo co on co.tid = t.id
  union all
  -- Bucket do que a fatura tem e a gente ainda não sabe atribuir.
  select
    null::uuid, 'NAO ATRIBUIDO'::text,
    round(coalesce(cu.apify, 0), 4),
    round(coalesce(cu.anthropic, 0), 4),
    round(coalesce(cu.total, 0), 4),
    0, 0, 0, null::numeric, 0
  from custo cu where cu.tid is null;
end $$;

-- ══ CONSOLE ACID: onde o dinheiro vaza ═════════════════════════════════════
-- Custo por (tenant, marca, fonte). É o que responde "o Reddit do radar da Vivo
-- come metade da conta" sem precisar exportar planilha.
create or replace function public.acid_custos_detalhe(p_dias int default 30)
returns table(
  tenant_nome text,
  marca_nome  text,
  origem      text,
  provedor    text,
  detalhe     text,
  eventos     int,
  custo_usd   numeric
)
language plpgsql stable security definer set search_path = public as $$
declare v_desde timestamptz := now() - make_interval(days => greatest(p_dias, 1));
begin
  if not public.is_acid_admin() then
    raise exception 'Apenas a ACID pode ver custos por tenant.';
  end if;
  return query
    select
      coalesce(t.nome, 'NAO ATRIBUIDO'),
      coalesce(m.nome, '—'),
      c.origem, c.provedor, coalesce(c.detalhe, '—'),
      count(*)::int,
      round(sum(c.custo_usd), 4)
    from custos_uso c
    left join tenants t on t.id = c.tenant_id
    left join marcas  m on m.id = c.marca_id
    where c.ocorrido_em >= v_desde
    group by 1, 2, c.origem, c.provedor, 5
    order by 7 desc;
end $$;

-- ══ TENANT: consumo próprio ════════════════════════════════════════════════
-- DECISÃO COMERCIAL DELIBERADA: o tenant NÃO vê US$. Ele vê volume real
-- (varreduras, reports, sinais) e créditos. Expor o custo de fornecedor da ACID
-- pro cliente é entregar a margem de bandeja. Se um dia a venda for
-- "repasse de custo + fee", basta somar custo_usd aqui.
create or replace function public.meus_custos(p_dias int default 30)
returns table(
  varreduras     int,
  reports        int,
  creditos_gastos int,
  sinais_captados int,
  drops_gerados  int,
  saldo_creditos int
)
language plpgsql stable security definer set search_path = public as $$
declare v_tenant uuid := public.jwt_tenant_id();
        v_desde timestamptz := now() - make_interval(days => greatest(p_dias, 1));
begin
  if v_tenant is null then
    raise exception 'sem tenant no contexto';
  end if;
  return query
    select
      (select count(*) filter (where l.motivo = 'radar_run')
         from creditos_ledger l
        where l.tenant_id = v_tenant and l.created_at >= v_desde)::int,
      (select count(*) filter (where l.motivo = 'report')
         from creditos_ledger l
        where l.tenant_id = v_tenant and l.created_at >= v_desde)::int,
      -- Mesma regra do console: só conta o que virou trabalho, não recarga nem
      -- ajuste contábil.
      (select coalesce(-sum(l.delta) filter (
                where l.delta < 0 and l.motivo in ('radar_run','report')), 0)
         from creditos_ledger l
        where l.tenant_id = v_tenant and l.created_at >= v_desde)::int,
      (select coalesce(sum(r.sinais_captados), 0)
         from radar_runs r
        where r.tenant_id = v_tenant and r.created_at >= v_desde)::int,
      (select coalesce(sum(r.drops_gerados), 0)
         from radar_runs r
        where r.tenant_id = v_tenant and r.created_at >= v_desde)::int,
      (select t.saldo_creditos from tenants t where t.id = v_tenant)::int;
end $$;

revoke execute on function public.acid_custos_tenants(int) from public, anon;
revoke execute on function public.acid_custos_detalhe(int) from public, anon;
revoke execute on function public.meus_custos(int)         from public, anon;
grant  execute on function public.acid_custos_tenants(int) to authenticated;
grant  execute on function public.acid_custos_detalhe(int) to authenticated;
grant  execute on function public.meus_custos(int)         to authenticated;

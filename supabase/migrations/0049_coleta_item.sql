-- ACERVO DA COLETA DO REPORT
--
-- Até aqui o report jogava fora quase tudo o que raspava: a coleta inteira
-- (centenas de posts e notícias) passava pelo trimForModel, o modelo usava uns
-- 15 itens e só o JSON final ia para reports.report. Quando a gerente queria
-- outro post num card, não havia de onde escolher, e o caminho era duplicar o
-- report e colar link e imagem na mão.
--
-- Esta tabela guarda cada item coletado (já depois do filtro de brand safety),
-- ligado à marca. É a fonte do botão "Trocar pela coleta" no editor.
--
-- Escrita só pelo worker de geração (service_role). Leitura por quem é do
-- tenant, como o resto.

create table public.coleta_item (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid references public.tenants(id) on delete cascade,
  -- null = report avulso (sem marca); aí o acervo do report é só o dele.
  marca_id      uuid references public.marcas(id) on delete cascade,
  -- Report que coletou por último este item. O acervo sobrevive ao report.
  report_id     uuid references public.reports(id) on delete set null,

  plataforma    text not null
                check (plataforma in ('instagram','tiktok','twitter','news','reddit')),
  url           text not null,
  autor         text,
  texto         text,
  imagem_url    text,
  -- true quando a imagem está no nosso storage (ou vem de fonte que não
  -- expira). Imagem de Instagram/TikTok fora disso morre em horas ou dias.
  imagem_estavel boolean not null default false,
  -- Palavrão no texto de origem (mesma regra de lib/brandSafety.ts).
  linguagem_explicita text,

  metricas      jsonb not null default '{}',
  -- Número único pra ordenar "mais engajados" entre redes diferentes.
  engajamento   bigint not null default 0,
  publicado_em  timestamptz,
  coletado_em   timestamptz not null default now(),

  -- O mesmo post coletado de novo atualiza a linha em vez de duplicar.
  constraint coleta_item_unico unique nulls not distinct (tenant_id, marca_id, url)
);

create index coleta_item_marca_idx  on public.coleta_item (marca_id, coletado_em desc);
create index coleta_item_report_idx on public.coleta_item (report_id);
create index coleta_item_tenant_idx on public.coleta_item (tenant_id, coletado_em desc);

-- tenant_id herdado da marca quando o worker não mandar (mesmo trigger das
-- outras tabelas, ver 0017).
create trigger set_tenant_id before insert on public.coleta_item
  for each row execute function public.set_tenant_id_default();

alter table public.coleta_item enable row level security;

create policy "tenant_read" on public.coleta_item
  for select to authenticated
  using (tenant_id = public.jwt_tenant_id() or public.is_acid_admin());

-- Sem policy de escrita: só service_role (worker) grava.
revoke insert, update, delete on public.coleta_item from anon, authenticated;

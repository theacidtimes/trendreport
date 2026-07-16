-- FASE 2 (aperto) — remove o escape transitório `jwt_tenant_id() is null`.
--
-- O 0015 deixou toda policy com o escape `or public.jwt_tenant_id() is null`,
-- que mantinha o acesso aberto enquanto o Custom Access Token Hook não estava
-- ligado (sem claim = vê tudo). O hook já está ATIVO e validado: rodando a função
-- pra cada usuário real o claim `tenant_id` sai populado (Caramelo), e um token
-- com claim de outro tenant já enxerga zero. Logo o escape virou peso morto —
-- este migration o remove e o isolamento passa a ser ESTRITO.
--
-- ATENÇÃO OPERACIONAL: qualquer sessão com token EMITIDO ANTES do hook (sem claim)
-- passa a enxergar zero após este aperto, até renovar o token (logout/login ou o
-- refresh automático de ~1h do Supabase, que re-roda o hook). Aplicado com a base
-- ciente de que só há usuários internos do tenant Caramelo, todos já re-logados.
--
-- Só mexe na EXPRESSÃO das policies (ALTER POLICY). Nada de tabela/função muda.
-- Writes do radar seguem via service_role (bypassa RLS) — não afetados.

-- ── tenants ────────────────────────────────────────────────
alter policy "tenant_isolation" on tenants
  using (id = public.jwt_tenant_id() or public.is_acid_admin())
  with check (id = public.jwt_tenant_id() or public.is_acid_admin());

-- ── tenant_users (mantém o self-read: user vê a própria associação) ──
alter policy "tenant_isolation" on tenant_users
  using (tenant_id = public.jwt_tenant_id() or user_id = auth.uid() or public.is_acid_admin())
  with check (tenant_id = public.jwt_tenant_id() or public.is_acid_admin());

-- ── marcas + tabelas de radar (denormalizadas com tenant_id) ──
alter policy "tenant_isolation" on marcas
  using (tenant_id = public.jwt_tenant_id() or public.is_acid_admin())
  with check (tenant_id = public.jwt_tenant_id() or public.is_acid_admin());

alter policy "tenant_isolation" on trends_radar
  using (tenant_id = public.jwt_tenant_id() or public.is_acid_admin())
  with check (tenant_id = public.jwt_tenant_id() or public.is_acid_admin());

alter policy "tenant_isolation" on radar_runs
  using (tenant_id = public.jwt_tenant_id() or public.is_acid_admin())
  with check (tenant_id = public.jwt_tenant_id() or public.is_acid_admin());

alter policy "tenant_isolation" on radar_raw_data
  using (tenant_id = public.jwt_tenant_id() or public.is_acid_admin())
  with check (tenant_id = public.jwt_tenant_id() or public.is_acid_admin());

alter policy "tenant_isolation" on radar_scrape_jobs
  using (tenant_id = public.jwt_tenant_id() or public.is_acid_admin())
  with check (tenant_id = public.jwt_tenant_id() or public.is_acid_admin());

-- ── reports (published_anon_read e owner/insert ficam intactos) ──
alter policy "tenant_read" on reports
  using (tenant_id = public.jwt_tenant_id() or public.is_acid_admin());

alter policy "collaborators delete" on reports
  using (tenant_id = public.jwt_tenant_id() or public.is_acid_admin());

alter policy "collaborators curation update" on reports
  using (
    status = any (array['ready','published'])
    and (tenant_id = public.jwt_tenant_id() or public.is_acid_admin())
  )
  with check (
    status = any (array['ready','published'])
    and (tenant_id = public.jwt_tenant_id() or public.is_acid_admin())
  );

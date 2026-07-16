-- Fase 4E (fatia 3: branding no report PUBLICO). O artefato em /r/[slug] e visto
-- por ANON (sem sessao) -> nao ha jwt_tenant_id, entao meu_branding() nao serve.
-- Esta RPC resolve slug -> branding do tenant dono do report, SO para reports
-- 'published'. E deliberadamente anon-callable (o report ja e publico); o retorno
-- e apenas cosmetico (display_name/logo_url/cores) e ja apareceria naquele report
-- de qualquer forma. Nenhum outro dado de tenant vaza: so responde para um slug
-- que JA e um report publicado.
create or replace function public.branding_do_report(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(t.branding, '{}'::jsonb)
  from reports r
  join tenants t on t.id = r.tenant_id
  where r.slug = p_slug and r.status = 'published'
  limit 1;
$$;

-- Gotcha do Supabase (ALTER DEFAULT PRIVILEGES concede a anon+authenticated).
-- Aqui, ao contrario das demais, ANON PRECISA executar (report publico). Tiramos
-- o grant amplo a public e concedemos explicitamente a anon + authenticated.
revoke execute on function public.branding_do_report(text) from public;
grant  execute on function public.branding_do_report(text) to anon, authenticated;

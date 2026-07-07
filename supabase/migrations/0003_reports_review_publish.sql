-- Camada de curadoria humana: relatórios gerados pela IA nascem em 'ready'
-- (aguardando revisão) e só ficam públicos após o analista homologar,
-- passando para 'published'. O link público /r/[slug] passa a exigir
-- 'published'.

alter table reports drop constraint if exists reports_status_check;

alter table reports
  add constraint reports_status_check
  check (status in ('pending', 'ready', 'published', 'error'));

-- Relatórios já existentes tinham link público ativo com status 'ready';
-- promovê-los a 'published' preserva esses links.
update reports set status = 'published' where status = 'ready';

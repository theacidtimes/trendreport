-- Ferramenta de curadoria compartilhada: qualquer analista logado do time
-- pode revisar/homologar qualquer report, não só quem o gerou. Restringe a
-- transição aos estados de curadoria ('ready'/'published') pra ninguém mexer,
-- por esta rota, em linhas ainda 'pending'/'error' escritas pelo pipeline.
create policy "collaborators curation update"
  on public.reports for update to authenticated
  using (status in ('ready', 'published'))
  with check (status in ('ready', 'published'));

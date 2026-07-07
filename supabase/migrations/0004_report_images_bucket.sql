-- Bucket público pra imagens que o analista sobe manualmente na curadoria,
-- substituindo imagens de rede que expiraram (fbcdn/tiktok cdn assinam URLs
-- que morrem em horas). Leitura pública (o report vira link público); escrita
-- só pra usuários autenticados (os analistas logados no painel).
insert into storage.buckets (id, name, public)
values ('report-images', 'report-images', true)
on conflict (id) do nothing;

create policy "report-images public read"
  on storage.objects for select
  using (bucket_id = 'report-images');

create policy "report-images authenticated insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'report-images');

create policy "report-images authenticated update"
  on storage.objects for update to authenticated
  using (bucket_id = 'report-images')
  with check (bucket_id = 'report-images');

create policy "report-images authenticated delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'report-images');

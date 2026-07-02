create table reports (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null default substr(md5(random()::text), 1, 8),
  user_id    uuid references auth.users(id) on delete cascade,
  cliente    text not null,
  briefing   jsonb,
  report     jsonb not null,
  created_at timestamptz default now()
);

alter table reports enable row level security;

-- dono vê e edita os próprios
create policy "owner" on reports
  for all using (auth.uid() = user_id);

-- qualquer um lê por slug (link público)
create policy "public_read" on reports
  for select using (true);

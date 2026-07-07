-- Lista de admins gerenciável em runtime (sem migration por troca). Quem estiver
-- aqui enxerga a trilha de auditoria e pode adicionar/remover outros admins.
create table public.app_admins (
  email      text primary key,
  added_by   text,
  created_at timestamptz not null default now()
);

-- Admin semente (o dono do app).
insert into public.app_admins (email, added_by)
values ('zampoli@cccaramelo.com', 'seed')
on conflict (email) do nothing;

-- SECURITY DEFINER pra checar admin sem cair em recursão de RLS: a policy de
-- app_admins usa esta função, que por sua vez lê app_admins ignorando RLS.
create or replace function public.is_app_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins
    where email = (auth.jwt() ->> 'email')
  );
$$;

revoke execute on function public.is_app_admin() from public, anon;
grant execute on function public.is_app_admin() to authenticated;

alter table public.app_admins enable row level security;

-- Só admins leem a lista e só admins gerenciam (incluir/remover/editar) admins.
create policy "app_admins admin read"
  on public.app_admins for select to authenticated
  using (public.is_app_admin());

create policy "app_admins admin insert"
  on public.app_admins for insert to authenticated
  with check (public.is_app_admin());

create policy "app_admins admin delete"
  on public.app_admins for delete to authenticated
  using (public.is_app_admin());

-- Auditoria agora é legível por qualquer admin da tabela (não mais e-mail fixo).
drop policy if exists "audit admin read" on public.report_audit;

create policy "audit admin read"
  on public.report_audit for select to authenticated
  using (public.is_app_admin());

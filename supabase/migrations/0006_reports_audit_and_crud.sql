-- Curadoria colaborativa: qualquer analista logado pode incluir/excluir reports
-- (o UPDATE de curadoria já veio em 0005, restrito a 'ready'/'published' pra não
-- pisar em linhas 'pending'/'error' escritas pelo pipeline). Aqui liberamos
-- INSERT e DELETE ao time e, o mais importante, criamos uma trilha de auditoria
-- que registra QUEM mexeu e guarda o estado ANTERIOR do report como backup.

-- INSERT: o criador precisa ser o próprio usuário logado (mantém user_id honesto
-- pra auditoria e pro dashboard "Total de reports").
create policy "collaborators insert"
  on public.reports for insert to authenticated
  with check (auth.uid() = user_id);

-- DELETE: qualquer analista logado pode excluir (ferramenta compartilhada).
create policy "collaborators delete"
  on public.reports for delete to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Trilha de auditoria + backup do estado anterior de cada report.
create table public.report_audit (
  id            bigint generated always as identity primary key,
  report_id     uuid,
  slug          text,
  cliente       text,
  action        text not null,          -- INSERT | UPDATE | DELETE
  changed_by    uuid,                    -- auth.uid() de quem fez a alteração
  changed_by_email text,                 -- e-mail extraído do JWT
  status_before text,
  status_after  text,
  report_before jsonb,                   -- backup: estado do report ANTES
  report_after  jsonb,                   -- estado do report DEPOIS
  created_at    timestamptz not null default now()
);

create index report_audit_report_id_idx on public.report_audit (report_id);
create index report_audit_created_at_idx on public.report_audit (created_at desc);

-- SECURITY DEFINER: roda com privilégios do dono (postgres), então grava na
-- tabela de auditoria mesmo com RLS ativo, sem precisar de policy de INSERT.
-- auth.uid()/auth.jwt() continuam lendo o JWT da requisição do usuário.
create or replace function public.log_report_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.report_audit (
    report_id, slug, cliente, action,
    changed_by, changed_by_email,
    status_before, status_after,
    report_before, report_after
  )
  values (
    coalesce(new.id, old.id),
    coalesce(new.slug, old.slug),
    coalesce(new.cliente, old.cliente),
    tg_op,
    auth.uid(),
    nullif(auth.jwt() ->> 'email', ''),
    old.status,
    new.status,
    old.report,
    new.report
  );
  return coalesce(new, old);
end;
$$;

create trigger report_audit_trigger
  after insert or update or delete on public.reports
  for each row execute function public.log_report_change();

-- Trigger não precisa que o chamador tenha EXECUTE; revogamos pra a função não
-- ficar exposta como RPC pública (/rest/v1/rpc/log_report_change).
revoke execute on function public.log_report_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS da auditoria: leitura só pra usuários logados; nenhuma policy de escrita
-- (só o trigger SECURITY DEFINER grava). Auditoria é imutável pela aplicação.
alter table public.report_audit enable row level security;

create policy "audit authenticated read"
  on public.report_audit for select to authenticated
  using (true);

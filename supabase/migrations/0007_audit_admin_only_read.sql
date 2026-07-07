-- A trilha de auditoria passa a ser legível apenas pelo admin master
-- (zampoli@cccaramelo.com). Os demais analistas continuam podendo criar/editar/
-- excluir reports, mas não enxergam o log completo de alterações.
drop policy if exists "audit authenticated read" on public.report_audit;

create policy "audit admin read"
  on public.report_audit for select to authenticated
  using ((auth.jwt() ->> 'email') = 'zampoli@cccaramelo.com');

-- HOTFIX de segurança — o lockdown de créditos do 0017 ficou incompleto.
--
-- No Supabase, `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON
-- FUNCTIONS TO anon, authenticated, service_role` concede EXECUTE em TODA função
-- nova DIRETAMENTE a esses papéis. Logo o `revoke execute ... from public` do
-- 0017 removeu só o grant de PUBLIC, mas os grants diretos a anon/authenticated
-- continuaram. Efeito: as funções que MUTAM crédito ficaram chamáveis por
-- qualquer cliente via /rest/v1/rpc — dava pra fabricar saldo (credito_lancar) ou
-- queimar crédito de um tenant (cobrar_*). Detectado pelo advisor de segurança
-- após a 4A. Aqui revogamos EXPLICITAMENTE dos papéis expostos.
--
-- Quem PODE o quê depois disto:
--  credito_lancar  → ninguém direto (cobrar_*/recarga o chamam como owner, SECURITY DEFINER).
--  cobrar_*        → só service_role (jobs de radar/report). Nunca o usuário.
--  recarga_creditos→ authenticated (trava em is_acid_admin por dentro); anon não.
--  credito_resumo  → authenticated (ticker/checagem de saldo); anon não precisa.

revoke execute on function public.credito_lancar(uuid,int,text,uuid) from anon, authenticated;
revoke execute on function public.cobrar_radar_run(uuid,uuid)        from anon, authenticated;
revoke execute on function public.cobrar_report(text)               from anon, authenticated;
revoke execute on function public.recarga_creditos(uuid,int,text)   from anon;
revoke execute on function public.credito_resumo()                  from anon;

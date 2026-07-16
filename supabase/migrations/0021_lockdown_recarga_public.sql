-- Complemento do 0020: recarga_creditos AINDA era chamável por anon depois do
-- 0020. Motivo: o grant dela não era direto a anon (que o 0020 revogou), era via
-- PUBLIC — o proacl trazia '=X/postgres' (grantee vazio = PUBLIC). anon herda de
-- PUBLIC, então revoke de anon foi no-op. Aqui revogamos de PUBLIC.
--
-- O grant DIRETO a authenticated permanece intacto (authenticated=X no proacl):
-- a função continua chamável pelo app, mas trava em is_acid_admin() por dentro,
-- então só o super-admin ACID de fato recarrega. anon fica sem nenhum caminho.

revoke execute on function public.recarga_creditos(uuid,int,text) from public;

import type { SupabaseClient } from "@supabase/supabase-js";

// Admin status vem da tabela public.app_admins (gerenciável em runtime), não
// mais de um e-mail fixo. A RLS já restringe os dados; esta checagem é pra UX
// (mostrar/ocultar a aba de auditoria e proteger a rota).
export async function checkIsAdmin(
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase.rpc("is_app_admin");
  return data === true;
}

// Super-admin da ACID (tabela public.acid_admins, por e-mail). Distinto do
// app_admin do tenant: só o ACID pode recarregar créditos de um tenant.
export async function checkIsAcidAdmin(
  supabase: SupabaseClient
): Promise<boolean> {
  const { data } = await supabase.rpc("is_acid_admin");
  return data === true;
}

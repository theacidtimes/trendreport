import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModuloNome } from "@/lib/types";

// Rotulos dos modulos ("apps" do Acid Fabric) pra UI de bloqueio/nav.
export const MODULO_LABEL: Record<ModuloNome, string> = {
  radar: "Trend Radar",
  reports: "Reports",
  dados_semanticos: "Mapa semântico",
};

// Checagem server-side de MODULO ativo do tenant da sessao (via rpc meus_modulos,
// que resolve por jwt_tenant_id). FAIL-OPEN no erro da RPC: se a chamada falhar
// (blip de rede, etc.) NAO bloqueia a feature — enforcement so acontece quando
// temos a lista de fato e o modulo nao esta nela. Assim um problema transitorio
// nunca tranca o produto de um tenant que assinou.
export async function moduloAtivo(
  supabase: SupabaseClient,
  modulo: ModuloNome
): Promise<boolean> {
  const { data, error } = await supabase.rpc("meus_modulos");
  if (error || !Array.isArray(data)) return true;
  return (data as string[]).includes(modulo);
}

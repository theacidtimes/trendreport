import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import TenantBloqueado from "@/components/TenantBloqueado";
import AvisosBanner from "@/components/AvisosBanner";

// Guard TRANSPARENTE do workspace inteiro. Cada pagina do /dashboard ja renderiza
// sua propria Sidebar/chrome, entao este layout NAO desenha nada: so autentica e
// aplica o enforcement de status do tenant, devolvendo os children intactos.
// (O middleware ja redireciona quem nao esta logado; aqui reforcamos e cobrimos
// o caso novo: tenant suspenso/cancelado nao entra no produto.)
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Status do proprio tenant (RPC resolve por jwt_tenant_id, sem ambiguidade).
  // Null (usuario sem tenant) NAO bloqueia: cai no workspace vazio, como hoje.
  // So barra estados explicitamente inativos.
  const { data: status } = await supabase.rpc("meu_tenant_status");
  if (status === "suspenso" || status === "cancelado") {
    return <TenantBloqueado status={status} email={user.email} />;
  }

  return (
    <>
      <AvisosBanner />
      {children}
    </>
  );
}

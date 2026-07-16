import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsAdmin } from "@/lib/admin";
import { moduloAtivo } from "@/lib/modulos";
import Sidebar from "@/components/Sidebar";
import ModuloBloqueado from "@/components/ModuloBloqueado";

export default async function MapaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Enforcement de modulo: o mapa semantico e o app "dados_semanticos". Tenant
  // que nao assinou ve a tela de bloqueio no lugar do mapa (fail-open no erro).
  if (!(await moduloAtivo(supabase, "dados_semanticos"))) {
    return <ModuloBloqueado modulo="dados_semanticos" />;
  }

  const isAdmin = await checkIsAdmin(supabase);

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg">
      <Sidebar userEmail={user?.email} isAdmin={isAdmin} />
      <main className="h-full md:pl-20">{children}</main>
    </div>
  );
}

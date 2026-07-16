import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { moduloAtivo } from "@/lib/modulos";
import ModuloBloqueado from "@/components/ModuloBloqueado";

// Guard TRANSPARENTE da criacao de report (a page /dashboard/new e client e monta
// sua propria Sidebar). Enforça o modulo "reports": tenant sem o modulo nao cria
// report novo (o /api/generate tambem barra no pre-voo). A LISTA de reports
// (/dashboard) segue acessivel como home segura — so a geracao e gated.
export default async function NewReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await moduloAtivo(supabase, "reports"))) {
    return <ModuloBloqueado modulo="reports" />;
  }

  return <>{children}</>;
}

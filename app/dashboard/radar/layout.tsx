import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { moduloAtivo } from "@/lib/modulos";
import ModuloBloqueado from "@/components/ModuloBloqueado";

// Guard TRANSPARENTE do Radar (mesmo padrao do dashboard/layout): nao desenha
// chrome (a page ja monta sua Sidebar), so autentica e enforça o modulo "radar".
// Tenant sem o modulo ve a tela de bloqueio; com o modulo, os children intactos.
export default async function RadarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await moduloAtivo(supabase, "radar"))) {
    return <ModuloBloqueado modulo="radar" />;
  }

  return <>{children}</>;
}

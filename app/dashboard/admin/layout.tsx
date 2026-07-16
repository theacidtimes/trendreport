import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsAdmin } from "@/lib/admin";
import Sidebar from "@/components/Sidebar";
import AdminTabs from "./AdminTabs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Gate ampliado (aditivo): alem do app_admin GLOBAL (legado ACID), agora entra
  // tambem o admin do PROPRIO tenant, que precisa do /dashboard/admin pra gerir
  // seus membros (aba "Usuários"). A aba "Auditoria" e as visoes app_admin-only
  // continuam travadas por dentro de cada pagina via checkIsAdmin.
  const [isAppAdmin, { data: isTenantAdmin }] = await Promise.all([
    checkIsAdmin(supabase),
    supabase.rpc("sou_admin_do_meu_tenant"),
  ]);
  if (!isAppAdmin && !isTenantAdmin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user.email} isAdmin />
      <main className="md:pl-20 print:pl-0">
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-8">
          <AdminTabs isAppAdmin={isAppAdmin} />
          {children}
        </div>
      </main>
    </div>
  );
}

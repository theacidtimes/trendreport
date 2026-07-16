import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsAcidAdmin } from "@/lib/admin";
import ConsoleDock from "@/components/console/ConsoleDock";

// Ambiente da ACID: cross-tenant, observa/provisiona TODOS os tenants. Gated por
// is_acid_admin() (super-admin da ACID) — distinto do app_admin de um tenant.
// is_acid_admin bypassa o RLS de tudo, então as queries aqui enxergam todos os
// tenants sem tocar nas policies. Navegação em Dock flutuante (não rail).
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await checkIsAcidAdmin(supabase))) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-bg">
      <main className="max-w-6xl mx-auto px-6 py-10 md:py-14 pb-28">
        {children}
      </main>
      <ConsoleDock userEmail={user.email} />
    </div>
  );
}

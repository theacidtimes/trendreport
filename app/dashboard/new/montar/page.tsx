import { createClient } from "@/lib/supabase/server";
import { checkIsAdmin } from "@/lib/admin";
import Sidebar from "@/components/Sidebar";
import MontarReport from "./MontarReport";

// O layout de /dashboard/new já exige login e o módulo "reports".
export default async function MontarPage(props: {
  searchParams: Promise<{ marca?: string }>;
}) {
  const { marca } = await props.searchParams;
  const supabase = await createClient();
  const [
    {
      data: { user },
    },
    isAdmin,
    { data: marcas },
  ] = await Promise.all([
    supabase.auth.getUser(),
    checkIsAdmin(supabase),
    supabase.from("marcas").select("id, nome").order("nome", { ascending: true }),
  ]);

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user?.email} isAdmin={isAdmin} />
      <main className="md:pl-20">
        <MontarReport marcas={marcas ?? []} marcaInicial={marca} />
      </main>
    </div>
  );
}

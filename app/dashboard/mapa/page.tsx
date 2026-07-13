import { redirect } from "next/navigation";
import { Waypoints } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { checkIsAdmin } from "@/lib/admin";
import Sidebar from "@/components/Sidebar";

export default async function MapaPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("marcas")
    .select("id")
    .order("nome", { ascending: true })
    .limit(1);

  const first = data?.[0];
  if (first) redirect(`/dashboard/mapa/${first.id}`);

  const isAdmin = await checkIsAdmin(supabase);

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user?.email} isAdmin={isAdmin} />
      <main className="md:pl-20">
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-14 flex flex-col items-center justify-center text-center gap-3 min-h-[60vh]">
          <Waypoints className="w-8 h-8 text-muted-2" strokeWidth={1.5} />
          <h1 className="font-serif text-white font-medium text-2xl">
            Mapa semântico
          </h1>
          <p className="text-muted text-sm max-w-md leading-relaxed">
            Nenhuma marca cadastrada ainda. Crie uma marca no Radar para montar
            seu núcleo mental de drops e correlações.
          </p>
        </div>
      </main>
    </div>
  );
}

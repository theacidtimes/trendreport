import { redirect } from "next/navigation";
import { Waypoints } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function MapaPage() {
  const supabase = createClient();

  const { data } = await supabase
    .from("marcas")
    .select("id")
    .order("nome", { ascending: true })
    .limit(1);

  const first = data?.[0];
  if (first) redirect(`/dashboard/mapa/${first.id}`);

  return (
    <div className="h-full grid place-items-center text-center px-6">
      <div className="flex flex-col items-center gap-3 max-w-md">
        <Waypoints className="w-8 h-8 text-muted-2" strokeWidth={1.5} />
        <h1 className="font-serif text-white font-medium text-2xl">
          Mapa semântico
        </h1>
        <p className="text-muted text-sm leading-relaxed">
          Nenhuma marca cadastrada ainda. Crie uma marca no Radar para montar
          seu núcleo mental de drops e correlações.
        </p>
      </div>
    </div>
  );
}

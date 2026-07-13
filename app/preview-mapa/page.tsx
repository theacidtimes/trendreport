import { createClient } from "@supabase/supabase-js";
import { buildCanvasGraph } from "@/lib/canvas/buildGraph";
import CanvasClient from "@/components/canvas/CanvasClient";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function PreviewMapa() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: marcasData } = await supabase
    .from("marcas")
    .select("id, nome")
    .order("nome", { ascending: true });
  const marcas = (marcasData ?? []) as { id: string; nome: string }[];
  const alvo =
    marcas.find((m) => /conta simples/i.test(m.nome)) ?? marcas[0];
  const graph = await buildCanvasGraph(supabase, alvo.id);
  if (!graph) return <div className="p-10 text-white">sem grafo</div>;

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg">
      <Sidebar userEmail="preview@x.com" isAdmin />
      <main className="h-full md:pl-20">
        <CanvasClient graph={graph} marcas={marcas} />
      </main>
    </div>
  );
}

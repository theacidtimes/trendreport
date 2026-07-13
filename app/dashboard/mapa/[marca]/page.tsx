import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsAdmin } from "@/lib/admin";
import { buildCanvasGraph } from "@/lib/canvas/buildGraph";
import CanvasClient from "@/components/canvas/CanvasClient";
import Sidebar from "@/components/Sidebar";

export default async function MapaCanvasPage({
  params,
}: {
  params: { marca: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isAdmin = await checkIsAdmin(supabase);

  const [{ data: marcasData }, graph] = await Promise.all([
    supabase.from("marcas").select("id, nome").order("nome", { ascending: true }),
    buildCanvasGraph(supabase, params.marca),
  ]);

  if (!graph) notFound();

  const marcas = (marcasData ?? []) as { id: string; nome: string }[];

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg">
      <Sidebar userEmail={user?.email} isAdmin={isAdmin} />
      <main className="h-full md:pl-20">
        <CanvasClient graph={graph} marcas={marcas} />
      </main>
    </div>
  );
}

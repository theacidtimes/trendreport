import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildCanvasGraph } from "@/lib/canvas/buildGraph";
import CanvasClient from "@/components/canvas/CanvasClient";

export default async function MapaCanvasPage({
  params,
}: {
  params: { marca: string };
}) {
  const supabase = createClient();

  const [{ data: marcasData }, graph] = await Promise.all([
    supabase.from("marcas").select("id, nome").order("nome", { ascending: true }),
    buildCanvasGraph(supabase, params.marca),
  ]);

  if (!graph) notFound();

  const marcas = (marcasData ?? []) as { id: string; nome: string }[];

  return <CanvasClient graph={graph} marcas={marcas} />;
}

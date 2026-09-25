import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildCanvasGraph } from "@/lib/canvas/buildGraph";
import CanvasClient from "@/components/canvas/CanvasClient";

// ?janela=14|30|90|tudo — padrão 30 dias: o mapa é sobre o que está vivo.
function parseJanela(v: string | string[] | undefined): number | null {
  if (v === "tudo") return null;
  const n = Number(v);
  return [14, 30, 90].includes(n) ? n : 30;
}

export default async function MapaCanvasPage({
  params,
  searchParams,
}: {
  params: { marca: string };
  searchParams: { janela?: string | string[] };
}) {
  const supabase = createClient();

  const [{ data: marcasData }, graph] = await Promise.all([
    supabase.from("marcas").select("id, nome").order("nome", { ascending: true }),
    buildCanvasGraph(supabase, params.marca, parseJanela(searchParams.janela)),
  ]);

  if (!graph) notFound();

  const marcas = (marcasData ?? []) as { id: string; nome: string }[];

  return <CanvasClient graph={graph} marcas={marcas} />;
}

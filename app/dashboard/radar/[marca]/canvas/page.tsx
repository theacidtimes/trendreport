import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildCanvasGraph } from "@/lib/canvas/buildGraph";
import CanvasClient from "@/components/canvas/CanvasClient";

export default async function CanvasPage({
  params,
}: {
  params: { marca: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const graph = await buildCanvasGraph(supabase, params.marca);
  if (!graph) notFound();

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg">
      <CanvasClient graph={graph} />
    </div>
  );
}

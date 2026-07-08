import { redirect } from "next/navigation";
import { Radar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import { checkIsAdmin } from "@/lib/admin";
import DropsPanel from "@/components/radar/DropsPanel";
import MarcasManager from "./MarcasManager";
import type { Marca } from "@/lib/types";

export default async function RadarPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const isAdmin = await checkIsAdmin(supabase);

  const { data } = await supabase
    .from("marcas")
    .select("*")
    .order("created_at", { ascending: false });

  const marcas = (data ?? []) as Marca[];

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user?.email} isAdmin={isAdmin} />

      <main className="md:pl-64">
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-8">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-lime text-xs uppercase tracking-[0.14em] font-medium">
              <Radar className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
              Monitoramento preditivo
            </span>
            <h1 className="font-sans text-white font-bold text-3xl tracking-[-0.01em]">
              Trend Radar
            </h1>
            <p className="text-muted text-sm">
              Sinais culturais coletados em tempo real e transformados em drops
              de oportunidade por marca. Ative uma marca para iniciar a
              varredura contínua.
            </p>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-muted text-xs uppercase tracking-[0.14em] font-medium">
              Marcas monitoradas
            </h2>
            <MarcasManager marcas={marcas} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-muted text-xs uppercase tracking-[0.14em] font-medium">
              Drops recentes
            </h2>
            <DropsPanel marcas={marcas} />
          </section>
        </div>
      </main>
    </div>
  );
}

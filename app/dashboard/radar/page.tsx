import { redirect } from "next/navigation";
import Link from "next/link";
import { Radar, Waypoints, ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import { checkIsAdmin } from "@/lib/admin";
import DropsPanel from "@/components/radar/DropsPanel";
import RadarStatus from "@/components/radar/RadarStatus";
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

      <main className="md:pl-20">
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-2 kicker text-muted-2">
              <Radar className="w-3.5 h-3.5 text-lime shrink-0" strokeWidth={2.5} />
              Monitoramento preditivo
            </span>
            <h1 className="font-serif text-white font-medium text-3xl md:text-4xl leading-tight">
              Trend Radar
            </h1>
            <p className="text-muted text-sm max-w-2xl leading-relaxed">
              Sinais culturais coletados em tempo real e transformados em drops
              de oportunidade por marca. Ative uma marca para iniciar a
              varredura contínua.
            </p>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="kicker text-muted-2">Status da captura</h2>
            <RadarStatus marcas={marcas} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="kicker text-muted-2">Drops recentes</h2>
            <DropsPanel marcas={marcas} />
          </section>

          {marcas.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="flex items-center gap-2 kicker text-muted-2">
                  <Waypoints className="w-3.5 h-3.5 text-lime shrink-0" strokeWidth={2.5} />
                  Mapa mental
                </h2>
                <p className="text-muted text-sm max-w-2xl leading-relaxed">
                  Um canvas por marca conectando drops, temas e correlações
                  semânticas num núcleo navegável.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {marcas.map((m) => (
                  <Link
                    key={m.id}
                    href={`/dashboard/radar/${m.id}/canvas`}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface/60 px-4 py-3.5 hover:border-white/20 hover:bg-surface transition-colors"
                  >
                    <span className="font-serif text-white text-base leading-tight">
                      {m.nome}
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-muted-2 group-hover:text-lime transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

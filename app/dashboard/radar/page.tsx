import Link from "next/link";
import { redirect } from "next/navigation";
import { Radar } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import { checkIsAdmin } from "@/lib/admin";
import DropsPanel from "@/components/radar/DropsPanel";
import RadarStatus from "@/components/radar/RadarStatus";
import type { Marca } from "@/lib/types";
import { REGIOES, parseRegiao, regiaoDe, type Regiao } from "@/lib/mercados";

export default async function RadarPage({
  searchParams,
}: {
  searchParams: { regiao?: string | string[] };
}) {
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

  const todas = (data ?? []) as Marca[];

  // Filtro BR / LATAM pela região do país da marca. Só aparece quando existe
  // marca nas duas regiões — com tudo no BR seria um botão que não filtra nada.
  const regiao = parseRegiao(searchParams.regiao);
  const regioesPresentes = new Set(todas.map((m) => regiaoDe(m.yaml_conhecimento?.pais)));
  const mostrarFiltro = regioesPresentes.size > 1;
  const marcas = regiao
    ? todas.filter((m) => regiaoDe(m.yaml_conhecimento?.pais) === regiao)
    : todas;

  const chip = (label: string, valor: Regiao | null) => {
    const on = regiao === valor;
    return (
      <Link
        key={label}
        href={valor ? `/dashboard/radar?regiao=${valor.toLowerCase()}` : "/dashboard/radar"}
        aria-current={on ? "page" : undefined}
        className={`rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wider transition-colors ${
          on
            ? "bg-white text-black border-white"
            : "text-muted border-border hover:text-white hover:border-white/40"
        }`}
      >
        {label}
      </Link>
    );
  };

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

          {mostrarFiltro && (
            <nav aria-label="Região" className="flex items-center gap-2">
              {chip("TODAS", null)}
              {REGIOES.map((r) => chip(r, r))}
            </nav>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="kicker text-muted-2">Status da captura</h2>
            <RadarStatus marcas={marcas} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="kicker text-muted-2">Drops recentes</h2>
            {/* key reseta o filtro de marca interno ao trocar de região. */}
            <DropsPanel
              key={regiao ?? "todas"}
              marcas={marcas}
              escopo={regiao ? marcas.map((m) => m.id) : undefined}
            />
          </section>
        </div>
      </main>
    </div>
  );
}

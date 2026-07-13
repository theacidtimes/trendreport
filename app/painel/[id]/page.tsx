import { notFound } from "next/navigation";
import { Radar } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import PublicDropsPanel from "@/components/radar/PublicDropsPanel";
import type { Marca, TrendDrop } from "@/lib/types";

// Página pública (fora do matcher do middleware, que só guarda /dashboard): o time de
// planejamento abre pelo link sem login. O uuid da marca no path é o token de acesso —
// mesmo modelo de "link com slug" dos reports. Lê via service role no servidor, escopado
// à marca do link, e nunca expõe o DNA (só nome/produto) nem drops de outros clientes.
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serviceDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function PainelPublico({
  params,
}: {
  params: { id: string };
}) {
  if (!UUID_RE.test(params.id)) notFound();

  const supabase = serviceDb();

  const { data: marcaData } = await supabase
    .from("marcas")
    .select("id, nome, yaml_conhecimento")
    .eq("id", params.id)
    .maybeSingle();

  if (!marcaData) notFound();
  const marca = marcaData as Marca;

  const { data: dropsData } = await supabase
    .from("trends_radar")
    .select("*")
    .eq("marca_id", params.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const drops = (dropsData ?? []) as TrendDrop[];

  // Panorama por status/funil pra orientar quem abre o link antes de rolar.
  const resumo = {
    em_alta: drops.filter((d) => d.status_hype === "em_alta").length,
    subindo: drops.filter((d) => d.status_hype === "subindo").length,
    estabilizando: drops.filter((d) => d.status_hype === "estabilizando").length,
    growth: drops.filter((d) => d.categoria_funil === "growth").length,
    base: drops.filter((d) => d.categoria_funil === "base").length,
  };

  const atualizado = drops[0]?.created_at
    ? new Date(drops[0].created_at).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-6xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-8">
        <header className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-lime text-xs uppercase tracking-[0.14em] font-medium">
            <Radar className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
            Trend Radar
          </span>
          <h1 className="font-serif text-white font-medium text-4xl leading-tight">
            {marca.nome}
          </h1>
          <p className="text-muted text-sm">
            {marca.yaml_conhecimento?.produto || "Sinais culturais organizados em drops de oportunidade."}
          </p>
          <p className="text-muted/70 text-xs mt-1 tabular-nums">
            {drops.length} drop{drops.length === 1 ? "" : "s"}
            {atualizado ? ` · atualizado em ${atualizado}` : ""}
          </p>

          {drops.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mt-3">
              {resumo.em_alta > 0 && (
                <span className="text-[11px] font-semibold rounded-full bg-lime text-black px-2.5 py-1 tabular-nums">
                  {resumo.em_alta} em alta
                </span>
              )}
              {resumo.subindo > 0 && (
                <span className="text-[11px] font-semibold rounded-full bg-purple text-white px-2.5 py-1 tabular-nums">
                  {resumo.subindo} subindo
                </span>
              )}
              {resumo.estabilizando > 0 && (
                <span className="text-[11px] font-medium rounded-full border border-border text-muted px-2.5 py-1 tabular-nums">
                  {resumo.estabilizando} estabilizando
                </span>
              )}
              {(resumo.growth > 0 || resumo.base > 0) && (
                <span className="w-px h-4 bg-border mx-1" />
              )}
              {resumo.growth > 0 && (
                <span className="text-[11px] font-medium text-muted tabular-nums">
                  ↗ {resumo.growth} growth
                </span>
              )}
              {resumo.base > 0 && (
                <span className="text-[11px] font-medium text-muted tabular-nums">
                  → {resumo.base} base
                </span>
              )}
            </div>
          )}
        </header>

        {drops.length === 0 ? (
          <div className="rounded-3xl bg-surface border border-border p-10 text-center text-muted text-sm">
            Nenhum drop gerado ainda para esta marca.
          </div>
        ) : (
          <PublicDropsPanel drops={drops} />
        )}
      </div>
    </div>
  );
}

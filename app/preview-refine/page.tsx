"use client";

import DropCard from "@/components/radar/DropCard";
import Sidebar from "@/components/Sidebar";
import type { TrendDrop } from "@/lib/types";

const drop = {
  id: "1",
  marca_id: "m1",
  insight_titulo: "Calor extremo vira gatilho de conexão em casa",
  categoria_funil: "growth",
  status_hype: "em_alta",
  indice_hype: 87,
  descricao_fato:
    "Onda de calor recorde no Sudeste dispara buscas por conforto térmico e streaming em casa, com pico de menções no fim de semana.",
  gancho_produto:
    "Posicionar Fibra + Wi-Fi 7 como o refúgio climatizado e conectado do brasileiro.",
  links_fontes: ["https://example.com/a", "https://example.com/b"],
  score_densidade: 72,
  score_transbordo: 54,
  score_velocidade: 91,
  created_at: new Date().toISOString(),
  marca: { nome: "Vivo" } as TrendDrop["marca"],
} as TrendDrop;

export default function PreviewRefine() {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail="analista@caramelo.com" isAdmin />
      <main className="md:pl-20">
        <div className="max-w-5xl mx-auto px-10 py-14 flex flex-col gap-10">
          <div className="flex flex-col gap-2">
            <span className="kicker text-muted-2">Harmonia tipográfica</span>
            <h1 className="font-serif text-white font-medium text-4xl leading-tight">
              Números grandes agora em serifada
            </h1>
            <div className="flex items-end gap-8">
              <span className="font-serif font-medium tabular-nums text-transparent bg-clip-text text-[9rem] leading-none"
                style={{ backgroundImage: "linear-gradient(160deg, #a063e8 0%, #4a2e63 60%, #181818 100%)" }}>
                24
              </span>
              <span className="font-serif text-white font-medium text-4xl tabular-nums leading-none">
                1.284
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button className="bg-lime text-black font-semibold text-[15px] tracking-[-0.01em] h-14 rounded-full px-8 shadow-lime">
              Gerar relatório
            </button>
            <button className="border border-border text-white font-medium text-sm rounded-full px-5 h-12">
              Salvar rascunho
            </button>
          </div>

          <div className="max-w-md">
            <DropCard drop={drop} />
          </div>
        </div>
      </main>
    </div>
  );
}

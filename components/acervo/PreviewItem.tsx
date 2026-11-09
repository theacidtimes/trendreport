"use client";

import { useEffect, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import { CapaItem, NOME_REDE, quando, resumoMetricas } from "./AcervoBusca";
import type { ColetaItem } from "@/lib/types";

// O item do acervo inteiro: capa grande, texto completo, métricas e link pro
// original, com setas pra passar pelos itens da busca sem fechar.
export default function PreviewItem({
  item,
  lista,
  onTrocar,
  onFechar,
  acoes,
}: {
  item: ColetaItem;
  lista: ColetaItem[];
  onTrocar: (item: ColetaItem) => void;
  onFechar: () => void;
  acoes?: (item: ColetaItem) => ReactNode;
}) {
  const pos = lista.findIndex((i) => i.origem === item.origem && i.id === item.id);
  const anterior = pos > 0 ? lista[pos - 1] : null;
  const proximo = pos >= 0 && pos < lista.length - 1 ? lista[pos + 1] : null;

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
      if (e.key === "ArrowLeft" && anterior) onTrocar(anterior);
      if (e.key === "ArrowRight" && proximo) onTrocar(proximo);
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [anterior, proximo, onFechar, onTrocar]);

  const metricas = resumoMetricas(item);
  // Sem imagem, a capa seria o mesmo texto do corpo: mostra só o corpo, grande.
  const temImagem = !!item.imagem_url;
  const seta =
    "w-8 h-8 rounded-full border border-border text-white flex items-center justify-center hover:border-lime/60 disabled:opacity-30";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Item do acervo"
    >
      <div
        className={`relative bg-bg border border-border rounded-2xl w-full max-h-[90vh] overflow-hidden grid ${
          temImagem ? "max-w-4xl md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "max-w-2xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {temImagem && (
          <div className="relative bg-black min-h-[280px] md:min-h-[520px]">
            <CapaItem item={item} grande />
          </div>
        )}

        <div className="flex flex-col gap-4 p-5 md:p-6 min-h-0 overflow-y-auto max-h-[90vh]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-lime text-[11px] uppercase tracking-[0.12em] font-semibold">
                {NOME_REDE[item.plataforma]}
                {item.origem === "radar" ? " · radar" : ""}
              </span>
              <span className="text-white text-sm font-medium truncate">{item.autor ?? "Autor não informado"}</span>
              <span className="text-muted text-xs">{quando(item)}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => anterior && onTrocar(anterior)} disabled={!anterior} aria-label="Anterior" className={seta}>
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
              </button>
              <button onClick={() => proximo && onTrocar(proximo)} disabled={!proximo} aria-label="Próximo" className={seta}>
                <ChevronRight className="w-4 h-4" strokeWidth={2} />
              </button>
              <button onClick={onFechar} aria-label="Fechar" className="text-muted hover:text-white p-1 ml-1">
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
          </div>

          {metricas && (
            <span className="text-white text-sm font-medium bg-surface border border-border rounded-lg px-3 py-2 w-fit">
              {metricas}
            </span>
          )}

          <p
            className={`text-white/90 whitespace-pre-line m-0 ${
              temImagem ? "text-[15px] leading-relaxed" : "font-serif text-xl leading-snug"
            }`}
          >
            {item.texto || "(sem texto)"}
          </p>

          {item.linguagem_explicita && (
            <span className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2">
              Linguagem explícita no post: “{item.linguagem_explicita}”
            </span>
          )}

          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-white w-fit"
          >
            <ExternalLink className="w-4 h-4" strokeWidth={2} />
            Abrir o original
          </a>

          {acoes && <div className="flex flex-wrap gap-2 pt-2 mt-auto border-t border-border">{acoes(item)}</div>}
        </div>
      </div>
    </div>
  );
}

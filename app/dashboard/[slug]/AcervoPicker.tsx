"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import AcervoBusca from "@/components/acervo/AcervoBusca";
import type { ColetaItem } from "@/lib/types";

// Painel lateral do "Trocar pela coleta": lista o acervo da marca (o que os
// reports e o radar coletaram) e devolve o item escolhido pro editor, que troca
// imagem, link, autor e rede do card de uma vez.

export default function AcervoPicker({
  slug,
  titulo,
  onEscolher,
  onFechar,
}: {
  slug: string;
  // Card que está sendo trocado, só pra orientar quem escolhe.
  titulo: string;
  onEscolher: (item: ColetaItem) => void;
  onFechar: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Acervo da coleta">
      <button aria-label="Fechar acervo" onClick={onFechar} className="absolute inset-0 bg-black/60" />

      <div className="relative w-full max-w-md h-full bg-bg border-l border-border flex flex-col px-5 pt-5">
        <div className="flex items-start justify-between gap-3 pb-4">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-white font-medium text-base">Trocar pela coleta</span>
            <span className="text-muted text-xs truncate">Card: {titulo || "sem título"}</span>
          </div>
          <button onClick={onFechar} aria-label="Fechar" className="text-muted hover:text-white p-1">
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <AcervoBusca escopo={{ slug }} onEscolher={onEscolher} />
        </div>
      </div>
    </div>
  );
}

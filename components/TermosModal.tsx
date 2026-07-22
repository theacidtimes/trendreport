"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { OPERADORA, TERMOS_VERSAO } from "@/lib/legal";
import TermosContent from "./TermosContent";

// T&C em modal: abre por cima da tela atual (backdrop escurece o fundo, sem
// tirar o usuário do contexto de login/ativação). Fecha por backdrop, botão ou
// Esc. Trava o scroll do body enquanto aberto. Renderiza via portal no body pra
// não herdar estilos do container (ex. text-center do rodapé) nem ficar preso
// em stacking context de ancestral.
export default function TermosModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Termos e Condições de Uso"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/70 backdrop-blur-sm text-left"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[640px] max-h-[86vh] flex flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-card"
      >
        <header className="flex items-start justify-between gap-4 px-6 md:px-8 pt-7 pb-5 border-b border-border shrink-0">
          <div>
            <h1 className="font-serif text-[22px] leading-[1.1] tracking-[-0.02em] text-white">
              Termos e Condições de Uso
            </h1>
            <p className="text-muted-2 text-[12px] mt-2 leading-relaxed">
              Versão {TERMOS_VERSAO}. Operado por {OPERADORA.nome}, CNPJ{" "}
              {OPERADORA.cnpj}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 grid place-items-center w-9 h-9 rounded-lg text-muted hover:text-white hover:bg-surface-2 transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
        </header>

        <div className="overflow-y-auto px-6 md:px-8 py-6">
          <TermosContent dense />
          <p className="text-muted-2 text-[12px] leading-relaxed mt-8 border-t border-border pt-5">
            Ao ativar sua conta ou realizar o primeiro login, você declara ter
            lido e aceitado estes Termos e Condições de Uso.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

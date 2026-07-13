"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import BriefingForm from "@/components/BriefingForm";
import AnimatedPlusBadge from "@/components/AnimatedPlusBadge";

export default function NewReportDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Enquanto o briefing está sendo enviado não deixamos fechar — evita
  // abortar uma geração já disparada por um ESC/clique fora acidental.
  const close = useCallback(() => {
    if (loading) return;
    setOpen(false);
  }, [loading]);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);

    // Trava o scroll do fundo enquanto o modal está aberto.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group sm:col-span-2 rounded-3xl bg-gradient-to-br from-surface-2 via-surface to-black border border-border p-6 md:p-7 flex items-center justify-between gap-4 text-left transition-colors duration-300 ease-spring hover:border-purple/40 shadow-card"
      >
        <div className="flex flex-col gap-1.5">
          <span className="kicker text-purple/60">Novo report</span>
          <h1 className="font-serif text-purple font-medium text-2xl md:text-3xl leading-tight">
            O que está bombando agora?
          </h1>
        </div>
        <AnimatedPlusBadge />
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 sm:p-6 md:p-10"
          onClick={close}
        >
          <div
            className="relative w-full max-w-2xl my-auto rounded-3xl bg-bg border border-border p-6 md:p-8 flex flex-col gap-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="kicker text-muted-2">Novo report</span>
                <h2 className="font-serif text-white font-medium text-2xl md:text-3xl leading-tight">
                  Monte o briefing.
                </h2>
                <p className="text-muted text-[15px] max-w-md leading-relaxed">
                  Preencha os campos abaixo. A gente cuida do resto pra IA entender a marca,
                  a campanha e o contexto que você quer explorar.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={loading}
                aria-label="Fechar"
                className="shrink-0 w-10 h-10 rounded-full border border-border text-muted hover:text-white hover:border-white/20 transition-colors flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            <BriefingForm onLoadingChange={setLoading} />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

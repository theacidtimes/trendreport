"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { marcarTourVisto, tourVisto } from "@/lib/tours";
import { TOURS, type PassoTour, type TourId } from "./roteiros";

// TOUR DE NOVIDADES
//
// Escurece a tela, recorta o elemento de verdade (marcado com data-tour="…") e
// mostra um balão dizendo o que ele faz. Passo sem alvo vira um cartão no
// centro (boas-vindas). Passo cujo alvo não está na tela é pulado — o tour
// nunca aponta pro vazio.
//
// Aparece uma vez por pessoa (lib/tours.ts). `?tour=<id>` na URL força de novo.

type Rect = { top: number; left: number; width: number; height: number };

const MARGEM = 8;
const LARGURA_BALAO = 320;

function acharAlvo(alvo?: string): HTMLElement | null {
  if (!alvo) return null;
  const el = document.querySelector<HTMLElement>(`[data-tour="${alvo}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}

export default function Tour({
  id,
  atraso = 700,
}: {
  id: TourId;
  // Espera a página assentar (animações de entrada) antes de começar.
  atraso?: number;
}) {
  const [ativo, setAtivo] = useState(false);
  // Passos que existem na tela, resolvidos quando o tour começa.
  const [roteiro, setRoteiro] = useState<PassoTour[]>([]);
  const [indice, setIndice] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [janela, setJanela] = useState({ w: 0, h: 0 });

  const passos = TOURS[id];

  useEffect(() => {
    let cancelado = false;
    const forcar = new URLSearchParams(window.location.search).get("tour") === id;
    const t = setTimeout(async () => {
      if (!forcar && (await tourVisto(id))) return;
      if (cancelado) return;
      const visiveis = passos.filter((p) => !p.alvo || acharAlvo(p.alvo));
      // Só boas-vindas sem nada pra apontar não vale o tour.
      if (!visiveis.some((p) => p.alvo) && passos.some((p) => p.alvo)) return;
      setRoteiro(visiveis);
      setIndice(0);
      setAtivo(true);
    }, atraso);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [id, passos, atraso]);

  const passo = ativo ? roteiro[indice] : undefined;

  const medir = useCallback(() => {
    setJanela({ w: window.innerWidth, h: window.innerHeight });
    const el = acharAlvo(passo?.alvo);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [passo?.alvo]);

  // Rola até o alvo e acompanha scroll/resize enquanto o passo está aberto.
  useLayoutEffect(() => {
    if (!passo) return;
    acharAlvo(passo.alvo)?.scrollIntoView({ block: "center", behavior: "smooth" });
    medir();
    let raf = 0;
    const agendar = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(medir);
    };
    // O scroll suave leva alguns quadros: mede de novo quando assenta.
    const assentar = setTimeout(medir, 450);
    window.addEventListener("resize", agendar);
    window.addEventListener("scroll", agendar, true);
    return () => {
      clearTimeout(assentar);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", agendar);
      window.removeEventListener("scroll", agendar, true);
    };
  }, [passo, medir]);

  const fechar = useCallback(() => {
    setAtivo(false);
    void marcarTourVisto(id);
  }, [id]);

  useEffect(() => {
    if (!ativo) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
      if (e.key === "ArrowRight") setIndice((i) => Math.min(i + 1, roteiro.length - 1));
      if (e.key === "ArrowLeft") setIndice((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ativo, fechar, roteiro.length]);

  if (!passo) return null;

  const ultimo = indice === roteiro.length - 1;
  const comAlvo = !!(passo.alvo && rect);

  // Balão abaixo do alvo quando cabe; senão acima. Preso dentro da janela.
  let balao: React.CSSProperties;
  const larg = Math.min(LARGURA_BALAO, janela.w - 32);
  if (comAlvo && rect && rect.height > janela.h * 0.6) {
    // Alvo maior que a tela (painel inteiro): balão fixo embaixo, centralizado.
    balao = { bottom: 24, left: "50%", width: larg, transform: "translateX(-50%)" };
  } else if (comAlvo && rect) {
    const espacoAbaixo = janela.h - (rect.top + rect.height);
    const abaixo = espacoAbaixo > 220 || espacoAbaixo > rect.top;
    const left = Math.min(Math.max(rect.left + rect.width / 2 - larg / 2, 16), janela.w - larg - 16);
    balao = abaixo
      ? { top: rect.top + rect.height + MARGEM + 12, left, width: larg }
      : { bottom: janela.h - rect.top + MARGEM + 12, left, width: larg };
  } else {
    balao = { top: "50%", left: "50%", width: larg, transform: "translate(-50%, -50%)" };
  }

  return createPortal(
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label={passo.titulo}>
      {/* Fundo escuro com o recorte do alvo. Bloqueia cliques na página. */}
      {comAlvo && rect ? (
        <>
          <div className="absolute inset-0" />
          <div
            className="absolute rounded-2xl pointer-events-none transition-all duration-300 ease-out"
            style={{
              top: rect.top - MARGEM,
              left: rect.left - MARGEM,
              width: rect.width + MARGEM * 2,
              height: rect.height + MARGEM * 2,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
            }}
          />
          <div
            className="absolute rounded-2xl pointer-events-none border-2 border-lime animate-pulse"
            style={{
              top: rect.top - MARGEM,
              left: rect.left - MARGEM,
              width: rect.width + MARGEM * 2,
              height: rect.height + MARGEM * 2,
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.72)" }} />
      )}

      {/* Posição no wrapper e animação no filho: o keyframe de entrada mexe em
          transform e apagaria o translate que centraliza o balão. */}
      <div className="absolute" style={balao}>
      <div
        key={indice}
        className="bg-bg border border-border rounded-2xl p-5 flex flex-col gap-3 shadow-card animate-fade-up"
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-lime text-[11px] uppercase tracking-[0.14em] font-medium">
            {roteiro.length > 1 ? `Novidade ${indice + 1} de ${roteiro.length}` : "Novidade"}
          </span>
          <button onClick={fechar} aria-label="Fechar tour" className="text-muted hover:text-white -mt-1 -mr-1 p-1">
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>
        <span className="font-serif text-white text-xl leading-tight">{passo.titulo}</span>
        <p className="text-muted text-sm leading-relaxed">{passo.texto}</p>

        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-3 pt-1">
          <div className="flex gap-1">
            {roteiro.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === indice ? "w-4 bg-lime" : "w-1.5 bg-border"}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {indice > 0 && (
              <button
                onClick={() => setIndice(indice - 1)}
                className="text-muted hover:text-white text-xs font-medium px-2 py-2"
              >
                Voltar
              </button>
            )}
            {passo.acao && (
              <Link
                href={passo.acao.href}
                onClick={fechar}
                className="border border-border text-white text-xs font-medium rounded-full px-3.5 py-2 hover:border-lime/40 transition-colors"
              >
                {passo.acao.rotulo}
              </Link>
            )}
            <button
              onClick={() => (ultimo ? fechar() : setIndice(indice + 1))}
              className="bg-lime text-black text-xs font-semibold rounded-full px-4 py-2 flex items-center gap-1.5 hover:brightness-105"
            >
              {ultimo ? "Entendi" : "Próximo"}
              {!ultimo && <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>,
    document.body
  );
}

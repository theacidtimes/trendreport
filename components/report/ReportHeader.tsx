"use client";

import { useEffect, useRef, useState } from "react";
import { List, X } from "lucide-react";
import Logo from "../Logo";

export type Capitulo = { id: string; titulo: string };

// Header fixo do report: marca, índice dos capítulos e barra de progresso.
// O scroll é ouvido no document em modo capture porque no dashboard o report
// rola dentro de um container, não na janela.
export default function ReportHeader({
  capitulos,
  cliente,
  edicao,
  standalone,
  logoUrl,
  displayName,
}: {
  capitulos: Capitulo[];
  cliente: string;
  edicao: string;
  standalone: boolean;
  logoUrl?: string;
  displayName?: string;
}) {
  const barra = useRef<HTMLDivElement>(null);
  const [atual, setAtual] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const raiz = document.getElementById("report-raiz");
    if (!raiz) return;
    const onScroll = () => {
      const r = raiz.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      if (barra.current) barra.current.style.width = `${p * 100}%`;
      // Capítulo atual = o último cujo topo já passou do terço de cima da tela.
      let id: string | null = null;
      for (const c of capitulos) {
        const el = document.getElementById(c.id);
        if (el && el.getBoundingClientRect().top < window.innerHeight / 3) id = c.id;
      }
      setAtual(id);
    };
    onScroll();
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, [capitulos]);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [aberto]);

  const idxAtual = capitulos.findIndex((c) => c.id === atual);

  return (
    <>
      {/* Fixo só no link público: no dashboard já existem a barra do app e a do editor. */}
      <header
        className={`${standalone ? "sticky top-0 z-40" : "relative"} bg-bg/95 backdrop-blur border-b border-border`}
      >
        <div className="absolute left-0 top-0 h-[2px] bg-lime" ref={barra} style={{ width: 0 }} />
        <div className="max-w-6xl mx-auto px-5 md:px-10 h-14 flex items-center gap-4">
          {standalone && (
            <a href="#topo" className="flex items-center shrink-0" aria-label="Início do report">
              <Logo size="xs" logoUrl={logoUrl} displayName={displayName} />
            </a>
          )}
          <span className="kicker text-muted truncate min-w-0">
            {cliente}
            <span className="text-muted-2"> · {edicao}</span>
          </span>
          <nav className="hidden lg:flex items-center ml-auto" aria-label="Capítulos">
            {capitulos.map((c, i) => (
              <a
                key={c.id}
                href={`#${c.id}`}
                title={c.titulo}
                aria-current={c.id === atual ? "true" : undefined}
                className={`min-w-[30px] h-14 inline-flex items-center justify-center font-sans text-xs tabular-nums border-b-2 transition-colors ${
                  c.id === atual
                    ? "text-white border-lime"
                    : "text-muted-2 border-transparent hover:text-white"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </a>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="ml-auto lg:ml-2 h-10 px-3 inline-flex items-center gap-2 border border-border rounded-full kicker text-white hover:border-lime transition-colors shrink-0"
            aria-expanded={aberto}
            aria-controls="report-indice"
          >
            <List className="w-4 h-4" strokeWidth={1.8} />
            <span className="hidden sm:inline">
              {idxAtual >= 0 ? `${String(idxAtual + 1).padStart(2, "0")} / ${capitulos.length}` : "Índice"}
            </span>
          </button>
        </div>
      </header>

      {aberto && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Índice do report">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Fechar índice"
            onClick={() => setAberto(false)}
          />
          <div
            id="report-indice"
            className="absolute right-0 top-0 bottom-0 w-[min(92vw,400px)] bg-bg border-l border-border overflow-y-auto"
          >
            <div className="flex items-center justify-between pl-6 pr-3 h-14 border-b border-border">
              <span className="kicker text-muted">Índice</span>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="w-10 h-10 inline-flex items-center justify-center text-white"
                aria-label="Fechar índice"
              >
                <X className="w-5 h-5" strokeWidth={1.8} />
              </button>
            </div>
            <ol>
              {capitulos.map((c, i) => (
                <li key={c.id}>
                  <a
                    href={`#${c.id}`}
                    onClick={() => setAberto(false)}
                    className={`flex gap-4 items-baseline px-6 py-4 border-b border-border font-serif text-lg leading-snug hover:bg-surface transition-colors ${
                      c.id === atual ? "text-lime" : "text-white"
                    }`}
                  >
                    <span className="font-sans text-xs text-muted-2 tabular-nums w-6 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {c.titulo}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </>
  );
}

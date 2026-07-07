"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Sparkle } from "lucide-react";
import ReportCard from "./ReportCard";

export type ReportCardData = {
  id: string;
  slug: string;
  cliente: string;
  createdAt: string;
  status: string;
  indiceHype: number;
  hypeMotivo: string;
  imagemUrl: string | null;
  corMarca: string | null;
};

type SortValue = "recentes" | "antigos" | "hype";

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: "recentes", label: "Mais recentes" },
  { value: "antigos", label: "Mais antigos" },
  { value: "hype", label: "Maior hype" },
];

function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = options.find((o) => o.value === value)?.label ?? label;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl bg-surface border border-border px-3.5 py-2.5 text-sm text-white hover:border-lime/40 transition-colors"
      >
        <span className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium">
          {label}
        </span>
        <span className="font-medium max-w-[10rem] truncate">{current}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2.5}
        />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 min-w-[12rem] max-h-72 overflow-y-auto rounded-xl bg-surface border border-border p-1.5 shadow-xl">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-left transition-colors ${
                o.value === value ? "bg-black/40 text-lime" : "text-white hover:bg-black/30"
              }`}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check className="w-4 h-4 shrink-0" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReportsBrowser({ cards }: { cards: ReportCardData[] }) {
  const [cliente, setCliente] = useState("todos");
  const [sort, setSort] = useState<SortValue>("recentes");
  const [pending, setPending] = useState(false);

  // Guarda o timeout do loader pra não empilhar timers quando o usuário troca
  // vários filtros em sequência.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Loader deliberado ao trocar filtro: dá o feedback de "remanejando" sem
  // recarregar a página — a filtragem em si é síncrona e instantânea.
  function withLoader(apply: () => void) {
    setPending(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      apply();
      setPending(false);
    }, 400);
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const clienteOptions = useMemo(() => {
    const nomes = Array.from(new Set(cards.map((c) => c.cliente))).sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
    return [{ value: "todos", label: "Todos" }, ...nomes.map((n) => ({ value: n, label: n }))];
  }, [cards]);

  const visible = useMemo(() => {
    let list = cards;
    if (cliente !== "todos") list = list.filter((c) => c.cliente === cliente);

    const sorted = [...list];
    if (sort === "recentes") {
      sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    } else if (sort === "antigos") {
      sorted.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    } else {
      sorted.sort((a, b) => b.indiceHype - a.indiceHype);
    }
    return sorted;
  }, [cards, cliente, sort]);

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap pt-6">
        <div className="flex flex-col gap-1">
          <span className="text-muted text-xs uppercase tracking-[0.14em] font-medium">
            {visible.length} {visible.length === 1 ? "report" : "reports"}
          </span>
          <h2 className="font-sans text-white font-bold text-2xl md:text-3xl tracking-[-0.01em]">
            Seus reports
          </h2>
        </div>

        {cards.length > 0 && (
          <div className="flex items-center gap-2">
            <Dropdown
              label="Cliente"
              value={cliente}
              options={clienteOptions}
              onChange={(v) => withLoader(() => setCliente(v))}
            />
            <Dropdown
              label="Ordem"
              value={sort}
              options={SORT_OPTIONS}
              onChange={(v) => withLoader(() => setSort(v as SortValue))}
            />
          </div>
        )}
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 border border-dashed border-border rounded-3xl">
          <span className="w-11 h-11 rounded-full bg-surface flex items-center justify-center">
            <Sparkle className="w-5 h-5 text-muted" strokeWidth={2} />
          </span>
          <p className="text-muted text-center max-w-xs">
            Nenhum report ainda. Clique em &ldquo;O que está bombando agora?&rdquo; e gere o
            primeiro relatório de tendências.
          </p>
        </div>
      ) : (
        <div className="relative">
          {pending && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-bg/60 backdrop-blur-sm">
              <Loader2 className="w-6 h-6 text-lime animate-spin" strokeWidth={2.5} />
            </div>
          )}

          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 border border-dashed border-border rounded-3xl">
              <p className="text-muted text-center max-w-xs text-sm">
                Nenhum report para esse filtro.
              </p>
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity ${
                pending ? "opacity-40" : "opacity-100"
              }`}
            >
              {visible.map((c, i) => (
                <ReportCard
                  key={c.id}
                  index={i + 1}
                  slug={c.slug}
                  cliente={c.cliente}
                  createdAt={c.createdAt}
                  status={c.status}
                  indiceHype={c.indiceHype}
                  hypeMotivo={c.hypeMotivo}
                  imagemUrl={c.imagemUrl}
                  corMarca={c.corMarca}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Loader2, Radar } from "lucide-react";
import ReportsBrowser, { Dropdown, type ReportCardData } from "./ReportsBrowser";

export type DropCardData = {
  id: string;
  marcaNome: string | null;
  insightTitulo: string;
  descricaoFato: string;
  ganchoProduto: string;
  statusHype: "em_alta" | "subindo" | "estabilizando" | "esfriando";
  categoriaFunil: "growth" | "base";
  indiceHype: number;
  createdAt: string;
};

const STATUS_LABEL: Record<DropCardData["statusHype"], string> = {
  em_alta: "Em alta",
  subindo: "Subindo",
  estabilizando: "Estabilizando",
  esfriando: "Esfriando",
};

// em_alta = lime, subindo = roxo, resto = neutro — mesmo código de cor do DropCard.
function statusBadgeClass(status: DropCardData["statusHype"]) {
  if (status === "em_alta") return "bg-lime text-black";
  if (status === "subindo") return "bg-purple text-white";
  return "border border-border text-muted";
}

const FUNIL_LABEL: Record<DropCardData["categoriaFunil"], string> = {
  growth: "↗ Growth",
  base: "→ Base",
};

function relativo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 60) return `há ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  return `há ${d}d`;
}

export default function HomeFeed({
  cards,
  drops,
  reportsTotal,
  reportsAvgHype,
}: {
  cards: ReportCardData[];
  drops: DropCardData[];
  reportsTotal: number;
  reportsAvgHype: number | null;
}) {
  const [cliente, setCliente] = useState("todos");
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Loader deliberado ao trocar cliente: mostra o "remanejando" nas duas seções
  // (bentos + reports) antes de aplicar o novo filtro.
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

  // Opções cobrem clientes dos reports E marcas dos drops — o seletor governa as
  // duas seções de uma vez.
  const clienteOptions = useMemo(() => {
    const nomes = Array.from(
      new Set([
        ...cards.map((c) => c.cliente),
        ...drops.map((d) => d.marcaNome).filter((n): n is string => !!n),
      ])
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return [{ value: "todos", label: "Todos" }, ...nomes.map((n) => ({ value: n, label: n }))];
  }, [cards, drops]);

  const visibleDrops = useMemo(() => {
    if (cliente === "todos") return drops;
    return drops.filter((d) => d.marcaNome === cliente);
  }, [drops, cliente]);

  const destaque = visibleDrops[0] ?? null;
  const showMarca = cliente === "todos";

  return (
    <>
      {/* RADAR RECENTE — bentos preditivos, filtrados pelo seletor de cliente */}
      <div className="flex items-end justify-between gap-4 flex-wrap pt-6">
        <div className="flex flex-col gap-1.5">
          <span className="kicker text-muted-2">Sinais preditivos do radar</span>
          <h2 className="font-serif text-white font-medium text-2xl md:text-3xl leading-tight">
            Radar recente
          </h2>
        </div>

        {clienteOptions.length > 1 && (
          <Dropdown
            label="Cliente"
            value={cliente}
            options={clienteOptions}
            onChange={(v) => withLoader(() => setCliente(v))}
          />
        )}
      </div>

      <div className="relative">
        {pending && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-bg/60 backdrop-blur-sm">
            <Loader2 className="w-6 h-6 text-lime animate-spin" strokeWidth={2.5} />
          </div>
        )}
        <div className={`transition-opacity ${pending ? "opacity-40" : "opacity-100"}`}>
      {destaque ? (
          // BENTO destaque — drop mais recente do cliente
          <Link
            href="/dashboard/radar"
            className="group rounded-3xl bg-surface border border-border p-6 flex flex-col gap-4 hover:border-white/20 transition-colors shadow-card"
          >
            <div className="flex items-center gap-2 flex-wrap">
              {showMarca && destaque.marcaNome && (
                <span className="text-[11px] font-semibold tracking-[0.04em] rounded-full bg-purple-mid text-white px-2.5 py-1">
                  {destaque.marcaNome}
                </span>
              )}
              <span
                className={`text-[11px] font-semibold uppercase tracking-[0.08em] rounded-full px-2.5 py-1 ${statusBadgeClass(
                  destaque.statusHype
                )}`}
              >
                {STATUS_LABEL[destaque.statusHype]}
              </span>
              <span className="text-[11px] font-medium text-muted tracking-[0.06em]">
                {FUNIL_LABEL[destaque.categoriaFunil]}
              </span>
              <span className="ml-auto text-[11px] text-muted tabular-nums">
                Hype {destaque.indiceHype}/100
              </span>
            </div>

            <div className="font-serif text-white font-medium text-2xl leading-snug">
              {destaque.insightTitulo}
            </div>

            {destaque.descricaoFato && (
              <p className="text-muted text-sm leading-relaxed line-clamp-2">
                {destaque.descricaoFato}
              </p>
            )}

            {destaque.ganchoProduto && (
              <div className="border-l-2 border-lime pl-3">
                <span className="block text-[10px] tracking-[0.08em] text-lime mb-1">
                  INSIGHT
                </span>
                <span className="text-white text-sm leading-relaxed line-clamp-3">
                  {destaque.ganchoProduto}
                </span>
              </div>
            )}

            <div className="mt-auto flex items-center justify-between text-[11px] text-muted">
              <span>{relativo(destaque.createdAt)}</span>
              <span className="flex items-center gap-1 group-hover:text-white transition-colors">
                Ver no radar
                <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2.5} />
              </span>
            </div>
          </Link>
      ) : (
        <div className="flex flex-col items-center gap-3 py-16 border border-dashed border-border rounded-3xl">
          <span className="w-11 h-11 rounded-full bg-surface flex items-center justify-center">
            <Radar className="w-5 h-5 text-muted" strokeWidth={2} />
          </span>
          <p className="text-muted text-center max-w-xs text-sm">
            {cliente === "todos"
              ? "Nenhum drop capturado ainda. O radar preenche esta seção conforme raspa sinais."
              : "Nenhum drop recente para esse cliente."}
          </p>
        </div>
      )}
        </div>
      </div>

      <ReportsBrowser
        cards={cards}
        cliente={cliente}
        externalPending={pending}
        reportsTotal={reportsTotal}
        reportsAvgHype={reportsAvgHype}
      />
    </>
  );
}

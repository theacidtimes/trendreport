"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Search,
  TriangleAlert,
} from "lucide-react";
import SmartImage from "@/components/SmartImage";
import type { ColetaItem } from "@/lib/types";

// Busca e lista do acervo (o que os reports e o radar coletaram). Usada no
// painel "Trocar pela coleta" do editor e na tela "Montar do acervo".

const REDES: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "twitter", label: "X" },
  { value: "news", label: "Notícias" },
  { value: "reddit", label: "Reddit" },
];

const PERIODOS: { value: number; label: string }[] = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 0, label: "Tudo" },
];

export const NOME_REDE: Record<ColetaItem["plataforma"], string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X",
  news: "Notícia",
  reddit: "Reddit",
};

const fmt = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function resumoMetricas(item: ColetaItem): string | null {
  const m = item.metricas ?? {};
  const partes: string[] = [];
  if (m.views) partes.push(`${fmt.format(m.views)} views`);
  if (m.curtidas) partes.push(`${fmt.format(m.curtidas)} curtidas`);
  if (m.upvotes) partes.push(`${fmt.format(m.upvotes)} upvotes`);
  if (m.respostas) partes.push(`${fmt.format(m.respostas)} respostas`);
  return partes.length ? partes.join(" · ") : null;
}

function quando(item: ColetaItem): string {
  const d = new Date(item.publicado_em ?? item.coletado_em);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function chaveItem(item: Pick<ColetaItem, "origem" | "id">): string {
  return `${item.origem}:${item.id}`;
}

/** Miniatura do item: imagem quando houver, nome da rede quando não. */
export function MiniaturaItem({ item, className = "w-14 h-16" }: { item: ColetaItem; className?: string }) {
  return (
    <div className={`relative rounded-lg overflow-hidden bg-black border border-border shrink-0 ${className}`}>
      {item.imagem_url ? (
        <SmartImage
          src={item.imagem_url}
          className="absolute inset-0 w-full h-full object-cover"
          fallback={<ImageIcon className="w-4 h-4 text-white/25" strokeWidth={1.5} />}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted uppercase tracking-wide">
          {NOME_REDE[item.plataforma]}
        </div>
      )}
    </div>
  );
}

export default function AcervoBusca({
  escopo,
  onEscolher,
  acoes,
  marcado,
}: {
  escopo: { slug: string } | { marca: string };
  // Linha inteira clicável (painel do editor).
  onEscolher?: (item: ColetaItem) => void;
  // Botões à direita de cada item (tela de montar).
  acoes?: (item: ColetaItem) => ReactNode;
  // Item já usado: aparece com borda de destaque.
  marcado?: (item: ColetaItem) => boolean;
}) {
  const [q, setQ] = useState("");
  const [rede, setRede] = useState("");
  const [dias, setDias] = useState(30);
  const [ordem, setOrdem] = useState<"engajamento" | "recentes">("engajamento");
  const [itens, setItens] = useState<ColetaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const escopoParam = "slug" in escopo ? `slug=${encodeURIComponent(escopo.slug)}` : `marca=${encodeURIComponent(escopo.marca)}`;

  useEffect(() => {
    const ctrl = new AbortController();
    // Espera a digitação parar antes de buscar.
    const t = setTimeout(async () => {
      setCarregando(true);
      setErro("");
      const params = new URLSearchParams({ q, plataforma: rede, dias: String(dias), ordem });
      try {
        const res = await fetch(`/api/acervo?${escopoParam}&${params}`, { signal: ctrl.signal });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Não deu pra carregar o acervo.");
        setItens(data.itens ?? []);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setErro(e instanceof Error ? e.message : "Não deu pra carregar o acervo.");
        setItens([]);
      } finally {
        if (!ctrl.signal.aborted) setCarregando(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [escopoParam, q, rede, dias, ordem]);

  const chip = (ativo: boolean) =>
    `text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
      ativo
        ? "bg-lime text-black border-lime"
        : "border-border text-muted hover:text-white hover:border-white/20"
    }`;

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex flex-col gap-3 pb-4 border-b border-border">
        <label className="relative">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={2} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar no texto ou autor"
            className="bg-surface border border-border text-white text-sm rounded-lg pl-9 pr-3 py-2.5 outline-none focus:border-lime transition-colors placeholder:text-muted/60 w-full"
          />
        </label>

        <div className="flex flex-wrap gap-1.5">
          {REDES.map((r) => (
            <button key={r.value} onClick={() => setRede(r.value)} className={chip(rede === r.value)}>
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            aria-label="Período"
            className="bg-surface border border-border text-white text-xs rounded-lg px-2.5 py-2 outline-none [color-scheme:dark]"
          >
            {PERIODOS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select
            value={ordem}
            onChange={(e) => setOrdem(e.target.value as "engajamento" | "recentes")}
            aria-label="Ordenar por"
            className="bg-surface border border-border text-white text-xs rounded-lg px-2.5 py-2 outline-none [color-scheme:dark]"
          >
            <option value="engajamento">Mais engajados</option>
            <option value="recentes">Mais recentes</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-2">
        {carregando && itens.length === 0 ? (
          <div className="flex items-center justify-center gap-2 text-muted text-sm py-10">
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
            Carregando acervo
          </div>
        ) : erro ? (
          <p className="flex items-center gap-2 text-red-400 text-sm py-6">
            <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
            {erro}
          </p>
        ) : itens.length === 0 ? (
          <div className="text-center py-10 flex flex-col gap-1">
            <span className="text-white text-sm">Nada no acervo com esses filtros</span>
            <span className="text-muted text-xs">
              Amplie o período ou limpe a busca. Reports gerados antes do acervo existir não entram aqui.
            </span>
          </div>
        ) : (
          itens.map((item, n) => {
            const metricas = resumoMetricas(item);
            const conteudo = (
              <>
                <MiniaturaItem item={item} />
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-white text-sm leading-snug line-clamp-2">
                    {item.texto || "(sem texto)"}
                  </span>
                  <span className="text-muted text-[11px] truncate">
                    {NOME_REDE[item.plataforma]}
                    {item.autor ? ` · ${item.autor}` : ""} · {quando(item)}
                    {metricas ? ` · ${metricas}` : ""}
                  </span>
                  {(item.linguagem_explicita || (item.imagem_url && !item.imagem_estavel)) && (
                    <span className="flex flex-wrap gap-1.5">
                      {item.linguagem_explicita && (
                        <span className="text-[10px] text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-full px-2 py-0.5">
                          Linguagem explícita
                        </span>
                      )}
                      {item.imagem_url && !item.imagem_estavel && (
                        <span
                          title="Imagem do CDN da rede: some em horas (TikTok) ou dias (Instagram). Se sumir, suba uma no card."
                          className="text-[10px] text-muted border border-border rounded-full px-2 py-0.5"
                        >
                          Imagem pode expirar
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </>
            );
            return (
              <div
                key={chaveItem(item)}
                className={`flex gap-3 bg-surface/50 border rounded-xl p-3 transition-colors ${
                  marcado?.(item) ? "border-lime/60" : "border-border hover:border-lime/40"
                }`}
              >
                {onEscolher ? (
                  <button
                    onClick={() => onEscolher(item)}
                    className="flex gap-3 text-left flex-1 min-w-0"
                    aria-label={`Usar ${NOME_REDE[item.plataforma]} de ${item.autor ?? "autor desconhecido"}`}
                  >
                    {conteudo}
                  </button>
                ) : (
                  <div className="flex gap-3 flex-1 min-w-0">{conteudo}</div>
                )}
                <div
                  className="flex flex-col items-end gap-1.5 shrink-0"
                  data-tour={n === 0 && acoes ? "acervo-acoes" : undefined}
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Abrir post original"
                    className="text-muted hover:text-white p-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                  </a>
                  {acoes?.(item)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

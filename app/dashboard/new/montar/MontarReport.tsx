"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Loader2,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import AcervoBusca, { MiniaturaItem, NOME_REDE, chaveItem } from "@/components/acervo/AcervoBusca";
import PreviewItem from "@/components/acervo/PreviewItem";
import Tour from "@/components/tour/Tour";
import type { ColetaItem } from "@/lib/types";

// "Montar do acervo": escolher itens da coleta da marca e distribuir nos blocos
// do report (tendências e memes). Ao criar, o worker escreve o report com o
// mesmo modelo dos gerados, em cima dos itens escolhidos (lib/redigirMontado.ts).

type Bloco = "tendencias" | "memes";
const MAX_POR_BLOCO = 12;

const NOME_BLOCO: Record<Bloco, string> = {
  tendencias: "Tendências",
  memes: "Memes",
};

const inputClass =
  "bg-surface border border-border text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-lime transition-colors placeholder:text-muted/60 w-full";

export default function MontarReport({
  marcas,
  marcaInicial,
}: {
  marcas: { id: string; nome: string }[];
  marcaInicial?: string;
}) {
  const router = useRouter();
  const [marcaId, setMarcaId] = useState(
    marcas.find((m) => m.id === marcaInicial)?.id ?? marcas[0]?.id ?? ""
  );
  const [produto, setProduto] = useState("");
  const [edicao, setEdicao] = useState("");
  const [tituloSocial, setTituloSocial] = useState("");
  const [orientacao, setOrientacao] = useState("");
  const [preview, setPreview] = useState<{ item: ColetaItem; lista: ColetaItem[] } | null>(null);
  const [blocos, setBlocos] = useState<Record<Bloco, ColetaItem[]>>({ tendencias: [], memes: [] });
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  const total = blocos.tendencias.length + blocos.memes.length;
  const blocoDe = (item: ColetaItem): Bloco | null =>
    (Object.keys(blocos) as Bloco[]).find((b) =>
      blocos[b].some((i) => chaveItem(i) === chaveItem(item))
    ) ?? null;

  function trocarMarca(id: string) {
    // A cesta é da marca: itens de outra marca seriam recusados na criação.
    if (total > 0 && !window.confirm("Trocar de marca esvazia o report que você está montando. Continuar?")) {
      return;
    }
    setBlocos({ tendencias: [], memes: [] });
    setMarcaId(id);
  }

  function adicionar(item: ColetaItem, bloco: Bloco) {
    setErro("");
    setBlocos((prev) => {
      if (prev[bloco].length >= MAX_POR_BLOCO) return prev;
      // Um item fica em um bloco só: adicionar em outro move.
      const sem = (lista: ColetaItem[]) => lista.filter((i) => chaveItem(i) !== chaveItem(item));
      return { tendencias: sem(prev.tendencias), memes: sem(prev.memes), [bloco]: [...sem(prev[bloco]), item] };
    });
  }

  function remover(bloco: Bloco, index: number) {
    setBlocos((prev) => ({ ...prev, [bloco]: prev[bloco].filter((_, i) => i !== index) }));
  }

  function mover(bloco: Bloco, index: number, delta: -1 | 1) {
    setBlocos((prev) => {
      const lista = [...prev[bloco]];
      const alvo = index + delta;
      if (alvo < 0 || alvo >= lista.length) return prev;
      [lista[index], lista[alvo]] = [lista[alvo], lista[index]];
      return { ...prev, [bloco]: lista };
    });
  }

  function botoesBloco(item: ColetaItem, grande = false) {
    const atual = blocoDe(item);
    return (["tendencias", "memes"] as Bloco[]).map((b) => (
      <button
        key={b}
        onClick={() => (atual === b ? remover(b, blocos[b].findIndex((i) => chaveItem(i) === chaveItem(item))) : adicionar(item, b))}
        disabled={atual !== b && blocos[b].length >= MAX_POR_BLOCO}
        className={`flex items-center gap-1 font-medium rounded-full border transition-colors whitespace-nowrap ${
          grande ? "text-sm px-4 py-2" : "text-[11px] px-2.5 py-1"
        } ${
          atual === b
            ? "bg-lime/10 border-lime/60 text-lime"
            : "border-border text-muted hover:text-white hover:border-white/20 disabled:opacity-40"
        }`}
      >
        {atual === b ? (
          <Check className={grande ? "w-4 h-4" : "w-3 h-3"} strokeWidth={2.5} />
        ) : (
          <Plus className={grande ? "w-4 h-4" : "w-3 h-3"} strokeWidth={2.5} />
        )}
        {b === "tendencias" ? "Tendência" : "Meme"}
      </button>
    ));
  }

  async function criar() {
    if (total === 0) {
      setErro("Adicione pelo menos um item ao report.");
      return;
    }
    setErro("");
    setCriando(true);
    const ref = (i: ColetaItem) => ({ id: i.id, origem: i.origem });
    try {
      const res = await fetch("/api/reports/montar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marcaId,
          produto,
          edicao,
          tituloSocial,
          orientacao,
          tendencias: blocos.tendencias.map(ref),
          memes: blocos.memes.map(ref),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.slug) throw new Error(data.error ?? "Não deu pra criar o report.");
      router.push(`/dashboard/${data.slug}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não deu pra criar o report.");
      setCriando(false);
    }
  }

  if (marcas.length === 0) {
    return (
      <div className="max-w-md mx-auto py-24 text-center flex flex-col gap-2">
        <span className="text-white font-serif text-2xl">Nenhuma marca cadastrada</span>
        <span className="text-muted text-sm">
          O acervo é organizado por marca. Cadastre uma marca e gere um report dela para começar.
        </span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-6">
      {/* Espera o acervo carregar, pra poder apontar pro primeiro item. */}
      <Tour id="montar-acervo" atraso={1800} />
      <div className="flex flex-col gap-2">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-muted hover:text-white text-xs w-fit">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
          Voltar
        </Link>
        <span className="text-muted uppercase text-xs tracking-[0.14em] font-medium">Novo report</span>
        <h1 className="font-serif text-white font-medium text-3xl md:text-4xl leading-tight">
          Monte a partir do acervo.
        </h1>
        <p className="text-muted text-[15px] max-w-xl">
          Escolha posts e notícias que já foram coletados para a marca e coloque cada um em um bloco.
          A IA escreve o report em cima deles, no formato de sempre: títulos, leitura, por que importa,
          hype e gatilho.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium">Marca</span>
          <select
            value={marcaId}
            onChange={(e) => trocarMarca(e.target.value)}
            className={`${inputClass} [color-scheme:dark]`}
          >
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium">Produto</span>
          <input
            value={produto}
            onChange={(e) => setProduto(e.target.value)}
            placeholder="A IA tira da marca"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium">Edição</span>
          <input
            value={edicao}
            onChange={(e) => setEdicao(e.target.value)}
            placeholder="A IA nomeia pelo tema"
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium">Título (manchete)</span>
          <input
            value={tituloSocial}
            onChange={(e) => setTituloSocial(e.target.value)}
            placeholder="A IA escreve"
            className={inputClass}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium">
          Orientação para a leitura (opcional)
        </span>
        <textarea
          value={orientacao}
          onChange={(e) => setOrientacao(e.target.value)}
          rows={2}
          maxLength={600}
          placeholder="Ex.: foco na janela de plantio da safra 26/27; o cliente quer entender o que o produtor está falando."
          className={`${inputClass} resize-y`}
        />
      </label>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        {/* ACERVO */}
        <section
          data-tour="montar-acervo"
          className="bg-surface/30 border border-border rounded-2xl p-4 h-[85vh] flex flex-col"
        >
          <span className="text-white font-medium text-sm mb-3">Acervo da marca</span>
          <div className="flex-1 min-h-0">
            {marcaId && (
              <AcervoBusca
                key={marcaId}
                escopo={{ marca: marcaId }}
                layout="grade"
                marcado={(item) => {
                  const b = blocoDe(item);
                  return b ? (b === "tendencias" ? "Tendência" : "Meme") : false;
                }}
                onAbrir={(item, lista) => setPreview({ item, lista })}
                acoes={(item) => botoesBloco(item)}
              />
            )}
          </div>
        </section>

        {/* O REPORT */}
        <section
          data-tour="montar-report"
          className="lg:sticky lg:top-6 bg-surface/50 border border-border rounded-2xl p-4 flex flex-col gap-5"
        >
          <span className="text-white font-medium text-sm">Seu report</span>

          {(["tendencias", "memes"] as Bloco[]).map((bloco) => (
            <div key={bloco} className="flex flex-col gap-2">
              <span className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium">
                {NOME_BLOCO[bloco]} · {blocos[bloco].length}
              </span>
              {blocos[bloco].length === 0 ? (
                <span className="text-muted text-xs border border-dashed border-border rounded-xl px-3 py-4 text-center">
                  Use “+ {bloco === "tendencias" ? "Tendência" : "Meme"}” num item do acervo.
                </span>
              ) : (
                blocos[bloco].map((item, i) => (
                  <div key={chaveItem(item)} className="flex items-center gap-2.5 bg-bg/60 border border-border rounded-xl p-2">
                    <button
                      onClick={() => setPreview({ item, lista: blocos[bloco] })}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                      aria-label="Ver item"
                    >
                    <MiniaturaItem item={item} className="w-10 h-12" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-white text-xs leading-snug line-clamp-2">{item.texto || "(sem texto)"}</span>
                      <span className="text-muted text-[10px] truncate">
                        {NOME_REDE[item.plataforma]}
                        {item.autor ? ` · ${item.autor}` : ""}
                      </span>
                    </div>
                    </button>
                    <div className="flex items-center shrink-0">
                      <button
                        onClick={() => mover(bloco, i, -1)}
                        disabled={i === 0}
                        aria-label="Subir"
                        className="text-muted hover:text-white p-1 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => mover(bloco, i, 1)}
                        disabled={i === blocos[bloco].length - 1}
                        aria-label="Descer"
                        className="text-muted hover:text-white p-1 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => remover(bloco, i)}
                        aria-label="Tirar do report"
                        className="text-muted hover:text-red-400 p-1"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ))}

          {erro && (
            <span className="flex items-center gap-2 text-red-400 text-sm">
              <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
              {erro}
            </span>
          )}

          <button
            onClick={criar}
            disabled={criando}
            className="bg-lime text-black font-semibold text-sm rounded-full h-12 flex items-center justify-center gap-2 hover:brightness-105 transition-[filter] disabled:opacity-70"
          >
            {criando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                Criando
              </>
            ) : (
              "Criar report"
            )}
          </button>
          <span className="text-muted text-[11px] leading-relaxed">
            A IA escreve a leitura em cima dos itens escolhidos; imagem, link e autor de cada card vêm do
            post. Leva alguns minutos, usa 1 crédito e o report nasce em revisão.
          </span>
        </section>
      </div>

      {preview && (
        <PreviewItem
          item={preview.item}
          lista={preview.lista}
          onTrocar={(item) => setPreview((p) => (p ? { ...p, item } : p))}
          onFechar={() => setPreview(null)}
          acoes={(item) => botoesBloco(item, true)}
        />
      )}
    </div>
  );
}

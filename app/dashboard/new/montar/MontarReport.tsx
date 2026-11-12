"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, GripVertical, Loader2, Plus, TriangleAlert, X } from "lucide-react";
import AcervoBusca, { MiniaturaItem, NOME_REDE, chaveItem } from "@/components/acervo/AcervoBusca";
import PreviewItem from "@/components/acervo/PreviewItem";
import Tour from "@/components/tour/Tour";
import type { ColetaItem } from "@/lib/types";

// "Montar do acervo": escolher itens da coleta da marca e a ordem deles. A
// pessoa só inclui; se cada item vira tendência ou meme é o modelo que decide,
// pelo teor do post, como no report gerado (lib/redigirMontado.ts).

const MAX_ITENS = 20;

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
  const [itens, setItens] = useState<ColetaItem[]>([]);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");

  const total = itens.length;
  const incluido = (item: ColetaItem) => itens.some((i) => chaveItem(i) === chaveItem(item));

  function trocarMarca(id: string) {
    // A seleção é da marca: itens de outra marca seriam recusados na criação.
    if (total > 0 && !window.confirm("Trocar de marca esvazia o report que você está montando. Continuar?")) {
      return;
    }
    setItens([]);
    setMarcaId(id);
  }

  function alternar(item: ColetaItem) {
    setErro("");
    setItens((prev) =>
      prev.some((i) => chaveItem(i) === chaveItem(item))
        ? prev.filter((i) => chaveItem(i) !== chaveItem(item))
        : prev.length >= MAX_ITENS
          ? prev
          : [...prev, item]
    );
  }

  // Solta o item arrastado na posição `destino` (antes do item que está lá;
  // `itens.length` = no fim).
  function soltar(destino: number) {
    setItens((prev) => {
      if (arrastando === null) return prev;
      const lista = [...prev];
      const [movido] = lista.splice(arrastando, 1);
      lista.splice(destino > arrastando ? destino - 1 : destino, 0, movido);
      return lista;
    });
    setArrastando(null);
    setAlvo(null);
  }

  function botaoIncluir(item: ColetaItem, grande = false) {
    const dentro = incluido(item);
    return (
      <button
        onClick={() => alternar(item)}
        disabled={!dentro && total >= MAX_ITENS}
        className={`flex items-center justify-center gap-1.5 font-medium rounded-full border transition-colors whitespace-nowrap ${
          grande ? "text-sm px-5 py-2" : "text-xs px-3 py-1.5 w-full"
        } ${
          dentro
            ? "bg-lime text-black border-lime"
            : "border-border text-white hover:border-lime/60 disabled:opacity-40"
        }`}
      >
        {dentro ? (
          <Check className={grande ? "w-4 h-4" : "w-3.5 h-3.5"} strokeWidth={2.5} />
        ) : (
          <Plus className={grande ? "w-4 h-4" : "w-3.5 h-3.5"} strokeWidth={2.5} />
        )}
        {dentro ? "No report" : "Incluir no report"}
      </button>
    );
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
          itens: itens.map(ref),
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
          Inclua os posts e notícias que já foram coletados para a marca. A IA escreve o report em cima
          deles, no formato de sempre: separa tendências e memes pelo teor de cada post e escreve
          títulos, leitura, por que importa, hype e gatilho.
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
                semRuido
                marcado={(item) => (incluido(item) ? "No report" : false)}
                onAbrir={(item, lista) => setPreview({ item, lista })}
                acoes={(item) => botaoIncluir(item)}
              />
            )}
          </div>
        </section>

        {/* O REPORT */}
        <section
          data-tour="montar-report"
          className="lg:sticky lg:top-6 bg-surface/50 border border-border rounded-2xl p-4 flex flex-col gap-5"
        >
          <span className="text-white font-medium text-sm">
            Seu report{total ? ` · ${total} ${total === 1 ? "item" : "itens"}` : ""}
          </span>

          {itens.length === 0 ? (
            <span className="text-muted text-xs border border-dashed border-border rounded-xl px-3 py-6 text-center leading-relaxed">
              Use “Incluir no report” nos itens do acervo. Depois arraste para mudar a ordem.
            </span>
          ) : (
            <div className="flex flex-col" onDragLeave={() => setAlvo(null)}>
              {itens.map((item, i) => (
                <div
                  key={chaveItem(item)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setArrastando(i);
                  }}
                  onDragEnd={() => {
                    setArrastando(null);
                    setAlvo(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    // Metade de cima do item = solta antes dele; de baixo = depois.
                    const r = e.currentTarget.getBoundingClientRect();
                    setAlvo(e.clientY < r.top + r.height / 2 ? i : i + 1);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (alvo !== null) soltar(alvo);
                  }}
                  className="relative py-1"
                >
                  {alvo === i && arrastando !== null && (
                    <span className="absolute -top-px left-2 right-2 h-0.5 rounded-full bg-lime" />
                  )}
                  <div
                    className={`flex items-center gap-2 bg-bg/60 border border-border rounded-xl p-2 cursor-grab active:cursor-grabbing transition-opacity ${
                      arrastando === i ? "opacity-40" : ""
                    }`}
                  >
                    <GripVertical className="w-4 h-4 text-muted shrink-0" strokeWidth={2} />
                    <span className="text-muted text-[11px] tabular-nums w-4 shrink-0">{i + 1}</span>
                    <button
                      onClick={() => setPreview({ item, lista: itens })}
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
                    <button
                      onClick={() => alternar(item)}
                      aria-label="Tirar do report"
                      className="text-muted hover:text-red-400 p-1 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                  {i === itens.length - 1 && alvo === itens.length && arrastando !== null && (
                    <span className="absolute -bottom-px left-2 right-2 h-0.5 rounded-full bg-lime" />
                  )}
                </div>
              ))}
            </div>
          )}

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
            A IA decide o que é tendência e o que é meme e escreve a leitura em cima dos itens; imagem,
            link e autor de cada card vêm do post. Leva alguns minutos, usa 1 crédito e o report nasce em
            revisão.
          </span>
        </section>
      </div>

      {preview && (
        <PreviewItem
          item={preview.item}
          lista={preview.lista}
          onTrocar={(item) => setPreview((p) => (p ? { ...p, item } : p))}
          onFechar={() => setPreview(null)}
          acoes={(item) => botaoIncluir(item, true)}
        />
      )}
    </div>
  );
}

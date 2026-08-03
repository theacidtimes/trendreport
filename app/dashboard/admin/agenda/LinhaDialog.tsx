"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { PAISES } from "@/lib/paises";
import { normalizarDominio, PESO_MAX, PESO_MIN } from "@/lib/radar/agendaLinha";
import type { PulsoCultural } from "@/lib/types";
import { salvarLinha } from "./actions";

const FIELD =
  "w-full rounded-xl bg-surface border border-border px-3.5 py-2.5 text-sm text-white placeholder:text-muted/60 focus:outline-none focus:border-lime/50 transition-colors";
const LABEL = "text-muted text-xs uppercase tracking-[0.12em] font-medium";

export type TenantOpcao = { id: string; nome: string };

// Rótulo do peso. O número sozinho não diz nada; o que ele faz é ordenar dentro
// do próprio grupo em `distribuirVagas`, e é isso que a frase precisa explicar.
const PESOS: [number, string][] = [
  [3, "3 · domina a conversa quando está no ar"],
  [2, "2 · relevante, disputa vaga com as outras"],
  [1, "1 · entra só se sobrar vaga"],
];

export default function LinhaDialog({
  linha,
  dominiosExistentes,
  tenants,
  aberto,
  onFechar,
}: {
  linha?: PulsoCultural;
  dominiosExistentes: string[];
  tenants: TenantOpcao[];
  aberto: boolean;
  onFechar: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [dominio, setDominio] = useState(linha?.dominio ?? "");
  // Datada vs perene é uma ESCOLHA, não duas datas opcionais. Deixar os campos
  // soltos convida ao meio-termo silencioso: só `janela_fim` preenchido já conta
  // como datada em `ehDatada`, e a linha passa a disputar as vagas por outra
  // régua sem que ninguém tenha decidido isso.
  const [datada, setDatada] = useState(
    Boolean(linha?.janela_inicio || linha?.janela_fim)
  );

  const close = useCallback(() => {
    if (loading) return;
    setErro(null);
    onFechar();
  }, [loading, onFechar]);

  useEffect(() => {
    if (!aberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [aberto, close]);

  if (!aberto) return null;

  const normalizado = normalizarDominio(dominio);
  const novoDominio = Boolean(normalizado) && !dominiosExistentes.includes(normalizado);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      await salvarLinha({
        id: linha?.id,
        dominio: String(fd.get("dominio") || ""),
        titulo: String(fd.get("titulo") || ""),
        termos: String(fd.get("termos") || "")
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean),
        // Trocar para perene LIMPA as datas. Sem isso, uma linha que virou
        // sensor continuaria carregando a janela antiga escondida no banco e
        // sumiria da varredura no dia em que aquela janela terminasse.
        janela_inicio: datada ? String(fd.get("janela_inicio") || "") : null,
        janela_fim: datada ? String(fd.get("janela_fim") || "") : null,
        peso: Number(fd.get("peso")),
        ativo: fd.get("ativo") === "on",
        pais: String(fd.get("pais") || "") || null,
        tenant_id: String(fd.get("tenant_id") || "") || null,
      });
      onFechar();
      router.refresh();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar a linha.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 sm:p-6 md:p-10"
      onClick={close}
    >
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-2xl my-auto rounded-3xl bg-bg border border-border p-6 md:p-8 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className={LABEL}>Agenda cultural</span>
            <h2 className="font-serif text-white font-medium text-2xl md:text-3xl leading-tight">
              {linha ? "Editar linha" : "Nova linha"}
            </h2>
            <p className="text-muted text-[15px] max-w-md">
              Um assunto que o radar vasculha mesmo quando ninguém citou a marca.
              Vale para toda marca que assinar este domínio.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={loading}
            aria-label="Fechar"
            className="shrink-0 w-10 h-10 rounded-full border border-border text-muted hover:text-white hover:border-white/20 transition-colors flex items-center justify-center disabled:opacity-40"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Domínio *</span>
            <input
              name="dominio"
              required
              list="dominios-existentes"
              value={dominio}
              onChange={(e) => setDominio(e.target.value)}
              placeholder="saude"
              className={FIELD}
            />
            <datalist id="dominios-existentes">
              {dominiosExistentes.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            {/* O domínio é chave de junção por igualdade exata de string. Mostrar
                a forma normalizada evita a pergunta "por que a marca não pegou
                minha linha de Saúde?" seis semanas depois. */}
            {normalizado && normalizado !== dominio && (
              <span className="text-[11px] text-muted/70">
                será gravado como <span className="text-white">{normalizado}</span>
              </span>
            )}
            {novoDominio && (
              <span className="text-[11px] text-amber-400">
                Domínio novo — nenhuma marca assina ainda. Rode “Reavaliar
                perfis” depois de salvar.
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Título *</span>
            <input
              name="titulo"
              required
              defaultValue={linha?.titulo}
              placeholder="Outubro Rosa"
              className={FIELD}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className={LABEL}>Termos *</span>
          <textarea
            name="termos"
            rows={4}
            required
            defaultValue={linha?.termos?.join("\n")}
            placeholder={
              "um por linha — é o que vai cru na busca\noutubro rosa\ncâncer de mama prevenção\nmamografia"
            }
            className={FIELD}
          />
          <span className="text-muted/60 text-[11px]">
            O scraper corta em 3 termos por lane. Mais que isso alimenta termo que
            nunca é buscado.
          </span>
        </label>

        {/* ── Sensor vs data ────────────────────────────────────
            A distinção não é de formulário, é de produto: foi uma linha PERENE
            ("comportamento nas redes") que capturou o lançamento do Homem-Aranha,
            não uma data de calendário. */}
        <div className="rounded-2xl border border-border bg-surface/40 p-4 flex flex-col gap-3">
          <span className={LABEL}>Quando vale</span>
          <div className="flex flex-col gap-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="radio"
                checked={!datada}
                onChange={() => setDatada(false)}
                className="mt-1 accent-lime"
              />
              <span className="text-sm text-white">
                Sensor — o ano inteiro
                <span className="block text-muted/60 text-[11px]">
                  fica ligado esperando algo acontecer (chuva forte, estreia de
                  filme, comportamento nas redes)
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="radio"
                checked={datada}
                onChange={() => setDatada(true)}
                className="mt-1 accent-lime"
              />
              <span className="text-sm text-white">
                Data — só nesta janela
                <span className="block text-muted/60 text-[11px]">
                  tem hora para começar e acabar (Outubro Rosa, Black Friday,
                  safra)
                </span>
              </span>
            </label>
          </div>
          {datada && (
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Início</span>
                <input
                  name="janela_inicio"
                  type="date"
                  defaultValue={linha?.janela_inicio ?? ""}
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Fim</span>
                <input
                  name="janela_fim"
                  type="date"
                  defaultValue={linha?.janela_fim ?? ""}
                  className={FIELD}
                />
              </label>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Peso</span>
            <select
              name="peso"
              defaultValue={String(linha?.peso ?? 2)}
              className={FIELD}
            >
              {PESOS.filter(([p]) => p >= PESO_MIN && p <= PESO_MAX).map(
                ([p, rotulo]) => (
                  <option key={p} value={p}>
                    {rotulo}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>País</span>
            <select
              name="pais"
              defaultValue={linha?.pais ?? "BR"}
              className={FIELD}
            >
              <option value="">Universal</option>
              {PAISES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <span className="text-muted/60 text-[11px]">
              Universal só se valer em qualquer calendário — “Dia dos Pais” não é.
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>Escopo</span>
            <select
              name="tenant_id"
              defaultValue={linha?.tenant_id ?? ""}
              className={FIELD}
            >
              <option value="">Global — todos os clientes</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  Só {t.nome}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            name="ativo"
            type="checkbox"
            defaultChecked={linha?.ativo ?? true}
            className="w-4 h-4 rounded accent-lime"
          />
          <span className="text-sm text-white">Ativa</span>
        </label>

        {erro && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">
            {erro}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={close}
            disabled={loading}
            className="text-muted hover:text-white text-sm font-medium px-4 py-2 transition-colors disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-lime text-black text-sm font-semibold px-5 py-2.5 hover:brightness-95 transition disabled:opacity-50"
          >
            {loading ? "Salvando..." : linha ? "Salvar alterações" : "Criar linha"}
          </button>
        </div>
      </form>
    </div>
  );
}

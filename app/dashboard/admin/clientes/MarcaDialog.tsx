"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import { createMarca, updateMarca } from "@/app/dashboard/radar/actions";
import type { Marca } from "@/lib/types";

const FIELD =
  "w-full rounded-xl bg-surface border border-border px-3.5 py-2.5 text-sm text-white placeholder:text-muted/60 focus:outline-none focus:border-lime/50 transition-colors";
const LABEL = "text-muted text-xs uppercase tracking-[0.12em] font-medium";

function toLines(v: string): string[] {
  return v
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function MarcaDialog({ marca }: { marca?: Marca }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(marca);
  const dna = marca?.yaml_conhecimento;

  const close = useCallback(() => {
    if (loading) return;
    setOpen(false);
    setError(null);
  }, [loading]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, close]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const nome = String(fd.get("nome") || "").trim();
    if (!nome) {
      setError("Informe o nome da marca.");
      return;
    }
    const payload = {
      nome,
      produto: String(fd.get("produto") || ""),
      tom: String(fd.get("tom") || ""),
      perfil_comportamental: String(fd.get("perfil_comportamental") || ""),
      universos_culturais: toLines(String(fd.get("universos_culturais") || "")),
      o_que_evitar: toLines(String(fd.get("o_que_evitar") || "")),
      ambicao_de_marca: String(fd.get("ambicao_de_marca") || ""),
      termos_busca: toLines(String(fd.get("termos_busca") || "")),
      linkedin_ativo: fd.get("linkedin_ativo") === "on",
      intervalo_horas: Number(fd.get("intervalo_horas")) || 8,
    };
    setLoading(true);
    try {
      if (marca) {
        await updateMarca(marca.id, payload);
      } else {
        await createMarca(payload);
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar a marca.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {isEdit ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-full border border-border text-muted hover:text-white hover:border-lime/40 text-sm font-medium px-3.5 h-9 transition-colors print:hidden"
        >
          <Pencil className="w-4 h-4" strokeWidth={2} />
          Editar DNA
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex items-center gap-2 rounded-full bg-purple hover:bg-purple-mid text-white text-sm font-medium px-4 py-2 transition-colors"
        >
          <span className="w-5 h-5 rounded-full bg-lime text-black flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus className="w-3.5 h-3.5" strokeWidth={2.6} />
          </span>
          Novo cliente
        </button>
      )}

      {open && (
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
                <span className={LABEL}>Trend Radar</span>
                <h2 className="font-sans text-white font-bold text-2xl md:text-3xl tracking-[-0.01em]">
                  {isEdit ? `Editar ${marca?.nome}` : "Novo cliente"}
                </h2>
                <p className="text-muted text-[15px] max-w-md">
                  O DNA da marca vira o conhecimento que orienta a varredura e os
                  drops. Quanto mais específico, melhor o fit cultural.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={loading}
                aria-label="Fechar"
                className="shrink-0 w-10 h-10 rounded-full border border-border text-muted hover:text-white hover:border-lime/40 transition-colors flex items-center justify-center disabled:opacity-40"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Nome *</span>
                <input
                  name="nome"
                  required
                  defaultValue={marca?.nome}
                  placeholder="Vivo"
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Produto</span>
                <input
                  name="produto"
                  defaultValue={dna?.produto}
                  placeholder="Fibra residencial e Wi-Fi 7"
                  className={FIELD}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Termos de busca</span>
              <textarea
                name="termos_busca"
                rows={3}
                defaultValue={dna?.termos_busca?.join("\n")}
                placeholder={"um por linha — palavras-chave que o agente busca nas fontes\nVivo fibra\nWi-Fi 7\ninternet residencial"}
                className={FIELD}
              />
              <span className="text-muted/60 text-[11px]">
                É o que vai cru na busca do Reddit/News. Use palavras-chave
                curtas, não descrições. Vazio = usa nome + produto.
              </span>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Tom de voz</span>
              <input
                name="tom"
                defaultValue={dna?.tom}
                placeholder="irreverente, cultura pop brasileira, sem ser corporativo"
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Perfil comportamental</span>
              <textarea
                name="perfil_comportamental"
                rows={2}
                defaultValue={dna?.perfil_comportamental}
                placeholder="Adultos 25-45, classes B e C, hiperconectados..."
                className={FIELD}
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>Universos culturais</span>
                <textarea
                  name="universos_culturais"
                  rows={4}
                  defaultValue={dna?.universos_culturais?.join("\n")}
                  placeholder={"um por linha\ncomunidade gamer BR\npáginas de meme"}
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={LABEL}>O que evitar</span>
                <textarea
                  name="o_que_evitar"
                  rows={4}
                  defaultValue={dna?.o_que_evitar?.join("\n")}
                  placeholder={"um por linha\ntom político\nlinguagem técnica"}
                  className={FIELD}
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Ambição de marca</span>
              <textarea
                name="ambicao_de_marca"
                rows={2}
                defaultValue={dna?.ambicao_de_marca}
                placeholder="Ser a marca de conectividade que entende a cultura brasileira..."
                className={FIELD}
              />
            </label>

            <div className="flex flex-wrap items-end gap-6">
              <label className="flex flex-col gap-1.5 max-w-[10rem]">
                <span className={LABEL}>Intervalo (horas)</span>
                <input
                  name="intervalo_horas"
                  type="number"
                  min={1}
                  defaultValue={marca?.intervalo_horas ?? 8}
                  className={FIELD}
                />
              </label>
              <label className="flex items-center gap-2.5 pb-2.5 cursor-pointer">
                <input
                  name="linkedin_ativo"
                  type="checkbox"
                  defaultChecked={dna?.linkedin_ativo ?? false}
                  className="w-4 h-4 rounded accent-lime"
                />
                <span className="text-sm text-white">
                  Varrer LinkedIn
                  <span className="block text-muted/60 text-[11px]">
                    ligue para clientes B2B/B2BC
                  </span>
                </span>
              </label>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">
                {error}
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
                {loading
                  ? "Salvando..."
                  : isEdit
                    ? "Salvar alterações"
                    : "Cadastrar marca"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";
import { createMarca, updateMarca } from "@/app/dashboard/radar/actions";
import type { Marca } from "@/lib/types";
import { PAISES } from "@/lib/paises";

const FIELD =
  "w-full rounded-xl bg-surface border border-border px-3.5 py-2.5 text-sm text-white placeholder:text-muted/60 focus:outline-none focus:border-lime/50 transition-colors";
const LABEL = "text-muted text-xs uppercase tracking-[0.12em] font-medium";

function toLines(v: string): string[] {
  return v
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

// Mantido em sincronia com CAP_AGENDA_CLUSTERS do planner (importar o módulo do
// radar aqui arrastaria o SDK da Anthropic pro bundle do cliente). O check
// script assere que os dois números são o mesmo.
const CAP_VAGAS = 6;


export default function MarcaDialog({
  marca,
  dominios = [],
}: {
  marca?: Marca;
  dominios?: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = Boolean(marca);
  const dna = marca?.yaml_conhecimento;

  // A agenda cultural é DERIVADA por padrão. O modo manual existe porque a
  // derivação é um chute bom, não uma autoridade: quem olhou a marca e discordou
  // precisa poder decidir — e precisa que a decisão SOBREVIVA ao próximo save,
  // que é o que a mesclagem no updateMarca garante.
  const [manual, setManual] = useState(dna?.perfil_cultural_manual ?? false);
  const vagasAtuais = Math.round(
    Math.max(0, Math.min(1, dna?.peso_cultural ?? 0)) * CAP_VAGAS
  );
  const [vagas, setVagas] = useState(vagasAtuais);
  const [assinados, setAssinados] = useState<string[]>(
    dna?.dominios_culturais ?? []
  );

  function toggleDominio(d: string) {
    setAssinados((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  }

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
      pais: String(fd.get("pais") || "BR"),
      intervalo_horas: Number(fd.get("intervalo_horas")) || 24,
      // Vai SEMPRE, inclusive `false`: desmarcar a caixa é a forma de devolver a
      // marca para a derivação, e um campo ausente não desmarca nada — a
      // mesclagem preservaria o `true` antigo e a marca ficaria congelada na
      // escolha manual para sempre.
      perfil_cultural_manual: manual,
      // Só vai no payload no modo manual. Ausente (`undefined`) é o sinal que o
      // `precisaDerivar` lê como "ninguém opinou, pode derivar"; mandar os
      // valores atuais aqui congelaria a derivação para sempre no primeiro save.
      ...(manual
        ? {
            dominios_culturais: assinados,
            // Vagas (0-6) e não o float: é a unidade em que a decisão é
            // avaliável ("4 de 6"), e a que se traduz direto em custo. O peso
            // 0..1 é reconstruído exatamente aqui porque o planner faz
            // round(peso × CAP) de volta.
            peso_cultural: assinados.length ? vagas / CAP_VAGAS : 0,
          }
        : {}),
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
          className="inline-flex items-center gap-2 rounded-full border border-border text-muted hover:text-white hover:border-white/20 text-sm font-medium px-3.5 h-9 transition-colors print:hidden"
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
                <h2 className="font-serif text-white font-medium text-2xl md:text-3xl leading-tight">
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
                className="shrink-0 w-10 h-10 rounded-full border border-border text-muted hover:text-white hover:border-white/20 transition-colors flex items-center justify-center disabled:opacity-40"
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

            {/* ── Agenda cultural ──────────────────────────────
                Estes dois campos existiam só no banco: a única forma de
                preenchê-los era SQL direto, então marca criada por aqui saía,
                por construção, sem agenda cultural nenhuma — e a ausência não
                dava erro nem log. */}
            <div className="rounded-2xl border border-border bg-surface/40 p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex flex-col gap-1">
                  <span className={LABEL}>Agenda cultural</span>
                  <span className="text-muted/60 text-[11px] max-w-sm">
                    Assuntos do calendário compartilhado (Dia dos Pais, Black
                    Friday, Brasileirão) que entram na varredura. Cada vaga custa
                    3 lanes de raspagem — nenhuma vaga é uma resposta válida.
                  </span>
                </div>
                <label className="flex items-center gap-2.5 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={manual}
                    onChange={(e) => setManual(e.target.checked)}
                    className="w-4 h-4 rounded accent-lime"
                  />
                  <span className="text-sm text-white">Definir manualmente</span>
                </label>
              </div>

              {!manual ? (
                <p className="text-muted text-[13px] leading-relaxed">
                  {dna?.justificativa_cultural ? (
                    <>
                      <span className="text-white">
                        {dna.dominios_culturais?.length
                          ? `${dna.dominios_culturais.join(", ")} · ${vagasAtuais} de ${CAP_VAGAS} vagas`
                          : "Nenhum domínio assinado"}
                      </span>
                      <span className="block text-muted/70 mt-0.5">
                        {dna.justificativa_cultural}
                      </span>
                    </>
                  ) : (
                    "Será derivada do DNA acima ao salvar."
                  )}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    {dominios.length === 0 ? (
                      <span className="text-muted/60 text-[13px]">
                        Nenhum domínio ativo na agenda ainda.
                      </span>
                    ) : (
                      dominios.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDominio(d)}
                          className={`rounded-full border px-3 h-8 text-xs font-medium transition-colors ${
                            assinados.includes(d)
                              ? "border-lime/60 bg-lime/10 text-lime"
                              : "border-border text-muted hover:text-white hover:border-white/20"
                          }`}
                        >
                          {d}
                        </button>
                      ))
                    )}
                  </div>
                  <label className="flex items-center gap-3 flex-wrap">
                    <span className={LABEL}>Vagas por varredura</span>
                    <input
                      type="range"
                      min={0}
                      max={CAP_VAGAS}
                      value={vagas}
                      onChange={(e) => setVagas(Number(e.target.value))}
                      disabled={assinados.length === 0}
                      className="accent-lime max-w-[12rem] disabled:opacity-40"
                    />
                    <span className="text-white text-sm tabular-nums">
                      {assinados.length === 0 ? 0 : vagas} de {CAP_VAGAS}
                    </span>
                  </label>
                  {/* As duas metades têm que concordar: domínio assinado com
                      zero vaga é config que parece ligada e não roda; vaga sem
                      domínio é custo reservado para uma agenda vazia. */}
                  {assinados.length > 0 && vagas === 0 && (
                    <span className="text-[11px] text-amber-400">
                      Domínios assinados com 0 vaga não rodam. Suba pelo menos 1.
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-6">
              <label className="flex flex-col gap-1.5 max-w-[8rem]">
                <span className={LABEL}>País</span>
                <select
                  name="pais"
                  defaultValue={dna?.pais ?? "BR"}
                  className={FIELD}
                >
                  {PAISES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 max-w-[10rem]">
                <span className={LABEL}>Intervalo (horas)</span>
                <input
                  name="intervalo_horas"
                  type="number"
                  min={1}
                  defaultValue={marca?.intervalo_horas ?? 24}
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

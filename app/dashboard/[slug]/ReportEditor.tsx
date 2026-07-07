"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Eye,
  Image as ImageIcon,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Send,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import ReportView from "@/components/ReportView";
import SmartImage from "@/components/SmartImage";
import { createClient } from "@/lib/supabase/client";
import type {
  CopyItem,
  Oportunidade,
  TendenciaStatus,
  TrendReport,
} from "@/lib/types";

const STATUS_OPCOES: { value: TendenciaStatus; label: string }[] = [
  { value: "em_alta", label: "Em alta" },
  { value: "subindo", label: "Subindo" },
  { value: "estabilizando", label: "Estabilizando" },
  { value: "esfriando", label: "Esfriando" },
];

function parseHashtags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((h) => h.replace(/^#/, "").trim())
    .filter(Boolean);
}

const inputClass =
  "bg-surface border border-border text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-lime transition-colors placeholder:text-muted/60 w-full font-body";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium font-body">
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-sans text-white font-bold text-xl tracking-[-0.01em]">
      {children}
    </h2>
  );
}

export default function ReportEditor({
  slug,
  initialReport,
  briefing,
  geradoEm,
}: {
  slug: string;
  initialReport: TrendReport;
  briefing?: Record<string, unknown> | string | null;
  geradoEm?: string;
}) {
  const router = useRouter();
  const [report, setReport] = useState<TrendReport>(initialReport);
  const [tab, setTab] = useState<"editar" | "preview">("editar");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [error, setError] = useState("");

  function mutate(fn: (draft: TrendReport) => void) {
    setReport((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    });
    setSavedAt(false);
  }

  // Sobe uma imagem escolhida pelo analista pro bucket público report-images e
  // aponta a imagem_url da tendência pra URL definitiva do Storage — que não
  // expira, ao contrário das URLs assinadas das redes.
  async function handleImageUpload(index: number, file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem.");
      return;
    }
    setError("");
    setUploadingIndex(index);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${slug}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("report-images")
        .upload(path, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("report-images").getPublicUrl(path);
      mutate((d) => {
        d.tendencias[index].imagem_url = data.publicUrl;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao subir a imagem.");
    } finally {
      setUploadingIndex(null);
    }
  }

  async function persist(status?: "published") {
    setError("");
    const body: { report: TrendReport; status?: "published" } = { report };
    if (status) body.status = status;

    const res = await fetch(`/api/reports/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail ?? data.error ?? "Falha ao salvar.");
    }
  }

  async function handleSaveDraft() {
    setSaving(true);
    try {
      await persist();
      setSavedAt(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar rascunho.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      await persist("published");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao publicar.");
      setPublishing(false);
    }
  }

  const busy = saving || publishing;

  return (
    <div className="min-h-screen pb-28">
      {/* BARRA DE REVISÃO */}
      <div className="sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-5 md:px-10 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2 text-lime text-xs uppercase tracking-[0.14em] font-medium">
              <Pencil className="w-3 h-3 shrink-0" strokeWidth={2.5} />
              Em revisão
            </span>
            <span className="text-muted text-xs">
              O cliente ainda não vê este relatório. Revise e homologue.
            </span>
          </div>

          <div className="flex items-center gap-2 bg-surface border border-border rounded-lg p-1">
            <button
              onClick={() => setTab("editar")}
              className={`flex items-center gap-1.5 text-xs font-medium rounded-md px-3 py-1.5 transition-colors ${
                tab === "editar" ? "bg-lime text-black" : "text-muted hover:text-white"
              }`}
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={2.5} />
              Editar
            </button>
            <button
              onClick={() => setTab("preview")}
              className={`flex items-center gap-1.5 text-xs font-medium rounded-md px-3 py-1.5 transition-colors ${
                tab === "preview" ? "bg-lime text-black" : "text-muted hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" strokeWidth={2.5} />
              Preview
            </button>
          </div>
        </div>
      </div>

      {tab === "preview" ? (
        <ReportView report={report} geradoEm={geradoEm} standalone={false} briefing={briefing} />
      ) : (
        <div className="max-w-3xl mx-auto px-5 md:px-10 py-8 flex flex-col gap-10">
          {/* CAPA */}
          <section className="flex flex-col gap-4">
            <SectionHeading>Capa</SectionHeading>
            <Field label="Título social (manchete)">
              <textarea
                value={report.meta.titulo_social ?? ""}
                onChange={(e) => mutate((d) => (d.meta.titulo_social = e.target.value))}
                className={`${inputClass} min-h-[64px] resize-y`}
              />
            </Field>
            <Field label="Motivo do hype (subtítulo)">
              <textarea
                value={report.meta.hype_motivo}
                onChange={(e) => mutate((d) => (d.meta.hype_motivo = e.target.value))}
                className={`${inputClass} min-h-[64px] resize-y`}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Índice de hype (0–100)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={report.meta.indice_hype}
                  onChange={(e) =>
                    mutate((d) => (d.meta.indice_hype = Number(e.target.value)))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Edição">
                <input
                  type="text"
                  value={report.meta.edicao}
                  onChange={(e) => mutate((d) => (d.meta.edicao = e.target.value))}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Produto">
                <input
                  type="text"
                  value={report.meta.produto}
                  onChange={(e) => mutate((d) => (d.meta.produto = e.target.value))}
                  className={inputClass}
                />
              </Field>
              <Field label="Cor da marca (hex)">
                <input
                  type="text"
                  value={report.meta.cor_marca ?? ""}
                  placeholder="#660099"
                  onChange={(e) => mutate((d) => (d.meta.cor_marca = e.target.value))}
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          {/* PRÓXIMO GATILHO */}
          <section className="flex flex-col gap-4">
            <SectionHeading>Próximo gatilho</SectionHeading>
            <Field label="Evento">
              <input
                type="text"
                value={report.meta.proximo_gatilho.evento}
                onChange={(e) =>
                  mutate((d) => (d.meta.proximo_gatilho.evento = e.target.value))
                }
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Data">
                <input
                  type="text"
                  value={report.meta.proximo_gatilho.data}
                  onChange={(e) =>
                    mutate((d) => (d.meta.proximo_gatilho.data = e.target.value))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Destaque">
                <input
                  type="text"
                  value={report.meta.proximo_gatilho.destaque}
                  onChange={(e) =>
                    mutate((d) => (d.meta.proximo_gatilho.destaque = e.target.value))
                  }
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          {/* MEMES / TENDÊNCIAS */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <SectionHeading>Memes em alta</SectionHeading>
              <span className="flex items-center gap-1.5 text-muted text-[11px] uppercase tracking-[0.1em]">
                <Lock className="w-3 h-3" strokeWidth={2.5} />
                link travado
              </span>
            </div>
            {report.tendencias.map((t, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 bg-surface/50 border border-border rounded-xl p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted text-xs font-medium">
                    #{String(i + 1).padStart(2, "0")}
                  </span>
                  <button
                    onClick={() =>
                      mutate((d) => d.tendencias.splice(i, 1))
                    }
                    aria-label="Remover meme"
                    className="text-muted hover:text-red-400 transition-colors flex items-center gap-1 text-xs"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2} /> remover
                  </button>
                </div>

                {/* IMAGEM — o analista pode subir uma imagem real pra substituir
                    a da rede quando ela expira/quebra. */}
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-20 rounded-lg overflow-hidden bg-black border border-border shrink-0">
                    {t.imagem_url ? (
                      <SmartImage
                        src={t.imagem_url}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-white/25" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-1.5">
                    <label
                      className={`flex items-center gap-1.5 text-xs font-medium border border-border rounded-lg px-3 py-2 transition-colors ${
                        uploadingIndex === i
                          ? "text-muted"
                          : "text-white hover:border-lime/40 cursor-pointer"
                      }`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingIndex === i}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(i, file);
                          e.target.value = "";
                        }}
                      />
                      {uploadingIndex === i ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.5} />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" strokeWidth={2.5} />
                          {t.imagem_url ? "Trocar imagem" : "Adicionar imagem"}
                        </>
                      )}
                    </label>
                    {t.imagem_url && uploadingIndex !== i && (
                      <button
                        onClick={() => mutate((d) => (d.tendencias[i].imagem_url = undefined))}
                        className="text-muted hover:text-red-400 transition-colors text-[11px]"
                      >
                        remover imagem
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Título">
                    <input
                      type="text"
                      value={t.titulo}
                      onChange={(e) =>
                        mutate((d) => (d.tendencias[i].titulo = e.target.value))
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Status">
                    <select
                      value={t.status}
                      onChange={(e) =>
                        mutate(
                          (d) =>
                            (d.tendencias[i].status = e.target
                              .value as TendenciaStatus)
                        )
                      }
                      className={`${inputClass} [color-scheme:dark]`}
                    >
                      {STATUS_OPCOES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Descrição">
                  <textarea
                    value={t.descricao}
                    onChange={(e) =>
                      mutate((d) => (d.tendencias[i].descricao = e.target.value))
                    }
                    className={`${inputClass} min-h-[60px] resize-y`}
                  />
                </Field>
                <Field label="Gancho com o produto">
                  <textarea
                    value={t.gancho_produto}
                    onChange={(e) =>
                      mutate((d) => (d.tendencias[i].gancho_produto = e.target.value))
                    }
                    className={`${inputClass} min-h-[60px] resize-y`}
                  />
                </Field>
              </div>
            ))}
          </section>

          {/* OPORTUNIDADES */}
          <section className="flex flex-col gap-4">
            <SectionHeading>Oportunidades</SectionHeading>
            {report.oportunidades?.map((o, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 bg-surface/50 border border-border rounded-xl p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted text-xs font-medium">
                    #{String(i + 1).padStart(2, "0")}
                  </span>
                  <button
                    onClick={() => mutate((d) => d.oportunidades.splice(i, 1))}
                    aria-label="Remover oportunidade"
                    className="text-muted hover:text-red-400 transition-colors flex items-center gap-1 text-xs"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2} /> remover
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Label">
                    <input
                      type="text"
                      value={o.label}
                      onChange={(e) =>
                        mutate((d) => (d.oportunidades[i].label = e.target.value))
                      }
                      className={inputClass}
                    />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Título">
                      <input
                        type="text"
                        value={o.titulo}
                        onChange={(e) =>
                          mutate((d) => (d.oportunidades[i].titulo = e.target.value))
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </div>
                <Field label="Descrição">
                  <textarea
                    value={o.descricao}
                    onChange={(e) =>
                      mutate((d) => (d.oportunidades[i].descricao = e.target.value))
                    }
                    className={`${inputClass} min-h-[60px] resize-y`}
                  />
                </Field>
              </div>
            ))}
            <button
              onClick={() =>
                mutate((d) => {
                  const novo: Oportunidade = { label: "", titulo: "", descricao: "" };
                  (d.oportunidades ??= []).push(novo);
                })
              }
              className="self-start flex items-center gap-1.5 text-sm text-muted hover:text-lime transition-colors font-body"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Adicionar oportunidade
            </button>
          </section>

          {/* COPY / INSIGHTS */}
          <section className="flex flex-col gap-4">
            <SectionHeading>Insights criativos (copy)</SectionHeading>
            {report.copy?.map((c, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 bg-surface/50 border border-border rounded-xl p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={c.tipo}
                    onChange={(e) =>
                      mutate(
                        (d) => (d.copy[i].tipo = e.target.value as CopyItem["tipo"])
                      )
                    }
                    className={`${inputClass} w-auto [color-scheme:dark]`}
                  >
                    <option value="feed">Feed</option>
                    <option value="stories">Stories</option>
                  </select>
                  <button
                    onClick={() => mutate((d) => d.copy.splice(i, 1))}
                    aria-label="Remover copy"
                    className="text-muted hover:text-red-400 transition-colors flex items-center gap-1 text-xs"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2} /> remover
                  </button>
                </div>
                <Field label="Texto">
                  <textarea
                    value={c.texto}
                    onChange={(e) =>
                      mutate((d) => (d.copy[i].texto = e.target.value))
                    }
                    className={`${inputClass} min-h-[80px] resize-y`}
                  />
                </Field>
                <Field label="Hashtags (separadas por espaço ou vírgula)">
                  <input
                    type="text"
                    value={(c.hashtags ?? []).map((h) => `#${h}`).join(" ")}
                    onChange={(e) =>
                      mutate((d) => (d.copy[i].hashtags = parseHashtags(e.target.value)))
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
            ))}
            <button
              onClick={() =>
                mutate((d) => {
                  const novo: CopyItem = { tipo: "feed", texto: "", hashtags: [] };
                  (d.copy ??= []).push(novo);
                })
              }
              className="self-start flex items-center gap-1.5 text-sm text-muted hover:text-lime transition-colors font-body"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Adicionar copy
            </button>
          </section>

          <p className="flex items-center gap-2 text-muted text-xs bg-surface/40 border border-border rounded-lg px-4 py-3">
            <Lock className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
            Radar das redes, Vozes reais e Fontes vêm de dados coletados e não
            são editáveis — para não inventar tendências. Use o Preview para ver
            como o cliente vai receber.
          </p>
        </div>
      )}

      {/* AÇÕES FIXAS */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-bg/95 backdrop-blur border-t border-border">
        <div className="max-w-6xl mx-auto px-5 md:px-10 py-4 flex items-center justify-between gap-3 flex-wrap md:pl-10">
          {error ? (
            <span className="flex items-center gap-2 text-red-400 text-sm">
              <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
              {error}
            </span>
          ) : (
            <span className="text-muted text-xs">
              Ao homologar, o link público fica disponível pro cliente.
            </span>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleSaveDraft}
              disabled={busy}
              className="border border-border text-white font-medium text-sm rounded-lg px-5 h-12 flex items-center justify-center gap-2 hover:border-lime/40 transition-colors disabled:opacity-60"
            >
              {savedAt ? (
                <>
                  Rascunho salvo
                  <Check className="w-4 h-4 text-lime" strokeWidth={2.5} />
                </>
              ) : (
                <>{saving ? "Salvando..." : "Salvar rascunho"}</>
              )}
            </button>
            <button
              onClick={handlePublish}
              disabled={busy}
              className="bg-lime text-black font-bold text-sm uppercase tracking-wide rounded-lg px-6 h-12 flex items-center justify-center gap-2 shadow-lime hover:brightness-110 transition-[filter] disabled:opacity-70"
            >
              {publishing ? "Publicando..." : "Homologar e publicar"}
              <Send className="w-4 h-4" strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus, TriangleAlert, Upload, X } from "lucide-react";
import * as yaml from "js-yaml";
import { createClient } from "@/lib/supabase/client";
import {
  useBriefingState,
  type BriefingState,
} from "@/components/briefing/useBriefingState";

type MarcaOption = { id: string; nome: string };

export default function BriefingForm({
  onLoadingChange,
  state,
}: {
  onLoadingChange?: (loading: boolean) => void;
  state?: BriefingState;
}) {
  const router = useRouter();

  // Controlado quando o modal passa um estado compartilhado (pra o assistente
  // preencher junto); senão, gerencia o próprio (uso avulso em /dashboard/new).
  const internal = useBriefingState();
  const {
    cliente,
    setCliente,
    tom,
    setTom,
    data,
    setData,
    contexto,
    setContexto,
    memes,
    setMemes,
    quero,
    setQuero,
  } = state ?? internal;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Marca cadastrada (DNA oficial) vs. report avulso (só briefing). Vazio = avulso.
  const [marcas, setMarcas] = useState<MarcaOption[]>([]);
  const [marcaId, setMarcaId] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("marcas")
      .select("id, nome")
      .order("nome", { ascending: true })
      .then(({ data }) => {
        if (data) setMarcas(data as MarcaOption[]);
      });
  }, []);

  // Ao escolher uma marca cadastrada, o cliente passa a ser o nome dela (o DNA é
  // a fonte). Ao voltar pra avulso, libera o campo pra digitar à mão.
  function handleMarcaChange(id: string) {
    setMarcaId(id);
    const marca = marcas.find((m) => m.id === id);
    if (marca) setCliente(marca.nome);
  }

  function setLoadingState(next: boolean) {
    setLoading(next);
    onLoadingChange?.(next);
  }

  function updateMeme(index: number, value: string) {
    setMemes((prev) => prev.map((m, i) => (i === index ? value : m)));
  }

  function addMeme() {
    setMemes((prev) => [...prev, ""]);
  }

  function removeMeme(index: number) {
    setMemes((prev) => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== index)));
  }

  async function handleYamlUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reenviar o mesmo arquivo
    if (!file) return;

    setError("");
    try {
      const text = await file.text();
      const parsed = yaml.load(text);

      if (!parsed || typeof parsed !== "object") {
        setError("Arquivo YAML inválido.");
        return;
      }

      const b = parsed as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

      if (b.data != null) setData(str(b.data));
      if (b.cliente != null) setCliente(str(b.cliente));
      if (b.tom != null) setTom(str(b.tom));
      if (b.contexto != null) setContexto(str(b.contexto));
      if (b.quero != null) setQuero(str(b.quero));

      if (Array.isArray(b.memes_que_vi)) {
        const list = b.memes_que_vi.map(str).filter(Boolean);
        setMemes(list.length > 0 ? list : [""]);
      }
    } catch {
      setError("Não foi possível ler o YAML. Confira o formato.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!cliente.trim()) {
      setError("Preencha o nome do cliente.");
      return;
    }
    if (!contexto.trim()) {
      setError("Descreva o contexto antes de gerar.");
      return;
    }

    // Montamos o objeto só com os campos preenchidos e deixamos o js-yaml
    // serializar — assim indentação, dois-pontos e caracteres especiais
    // saem sempre válidos, sem o analista precisar saber o que é YAML.
    const briefingObj: Record<string, unknown> = {};
    if (data) briefingObj.data = data;
    briefingObj.cliente = cliente.trim();
    if (tom.trim()) briefingObj.tom = tom.trim();
    if (contexto.trim()) briefingObj.contexto = contexto.trim();

    const memesLimpos = memes.map((m) => m.trim()).filter(Boolean);
    if (memesLimpos.length > 0) briefingObj.memes_que_vi = memesLimpos;

    if (quero.trim()) briefingObj.quero = quero.trim();

    const briefing = yaml.dump(briefingObj, { lineWidth: -1 });

    setLoadingState(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing, marcaId: marcaId || null }),
      });

      const resData = await res.json();

      if (!res.ok) {
        const base = resData.error ?? "Erro ao gerar relatório.";
        setError(resData.detail ? `${base} — ${resData.detail}` : base);
        setLoadingState(false);
        return;
      }

      // Navega direto pro /dashboard/[slug] assim que a linha "pending" existe —
      // é lá que mora o loader real, ligado ao progresso de verdade da geração
      // (ver PendingReport). Nada de animação de "concluído" falsa aqui, pra não
      // parecer que terminou e reiniciar de novo na página seguinte.
      router.push(`/dashboard/${resData.slug}`);
    } catch {
      setError("Erro de rede ao gerar relatório.");
      setLoadingState(false);
    }
  }

  const fieldClass =
    "bg-surface border border-border text-white text-[15px] rounded-xl p-4 outline-none focus:border-lime transition-colors placeholder:text-muted/70 disabled:opacity-60 font-body";

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="group flex items-center gap-3 rounded-xl border border-dashed border-border bg-surface/60 px-4 py-3 cursor-pointer hover:border-lime/40 transition-colors">
          <span className="shrink-0 w-9 h-9 rounded-lg bg-surface-2 border border-border grid place-items-center text-muted group-hover:text-lime transition-colors">
            <Upload className="w-4 h-4" strokeWidth={2} />
          </span>
          <span className="flex flex-col">
            <span className="text-white text-sm font-medium">Já tem um briefing pronto?</span>
            <span className="text-muted text-[13px]">Suba um arquivo .yaml e a gente preenche os campos.</span>
          </span>
          <input
            type="file"
            accept=".yaml,.yml,text/yaml,application/x-yaml"
            onChange={handleYamlUpload}
            disabled={loading}
            className="sr-only"
          />
        </label>

        {marcas.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium font-body">
              Marca <span className="text-muted/60 normal-case tracking-normal">(usa o DNA cadastrado)</span>
            </label>
            <select
              value={marcaId}
              onChange={(e) => handleMarcaChange(e.target.value)}
              disabled={loading}
              className={`${fieldClass} [color-scheme:dark] cursor-pointer`}
            >
              <option value="">Report avulso (só o briefing)</option>
              {marcas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
            <span className="text-muted/70 text-[12px]">
              Com marca, radar e report bebem do mesmo DNA. O briefing segue valendo pro contexto da edição.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium font-body">
              Cliente
            </label>
            <input
              type="text"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Vivo Fibra"
              disabled={loading || marcaId !== ""}
              className={fieldClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium font-body">
              Data
            </label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              disabled={loading}
              className={`${fieldClass} [color-scheme:dark]`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium font-body">
            Tom <span className="text-muted/60 normal-case tracking-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={tom}
            onChange={(e) => setTom(e.target.value)}
            placeholder="irreverente, cultura pop brasileira"
            disabled={loading}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium font-body">
            Contexto
          </label>
          <textarea
            value={contexto}
            onChange={(e) => setContexto(e.target.value)}
            placeholder="Brasil 3x0 Escócia ontem. Vini Jr fez 2 gols. Próximo jogo: 29/06, Houston, 14h. Calor de 33°C."
            disabled={loading}
            className={`${fieldClass} min-h-[120px] resize-y`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium font-body">
            Memes que vi <span className="text-muted/60 normal-case tracking-normal">(opcional)</span>
          </label>
          <div className="flex flex-col gap-2">
            {memes.map((meme, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={meme}
                  onChange={(e) => updateMeme(i, e.target.value)}
                  placeholder="Wepinko (Vini Jr + Virginia Fonseca)"
                  disabled={loading}
                  className={`${fieldClass} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => removeMeme(i)}
                  disabled={loading}
                  aria-label="Remover meme"
                  className="shrink-0 w-11 h-11 rounded-xl border border-border text-muted hover:text-white hover:border-lime/40 transition-colors flex items-center justify-center disabled:opacity-60"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addMeme}
            disabled={loading}
            className="self-start flex items-center gap-1.5 text-sm text-muted hover:text-lime transition-colors font-body disabled:opacity-60"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Adicionar meme
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium font-body">
            Quero <span className="text-muted/60 normal-case tracking-normal">(opcional)</span>
          </label>
          <textarea
            value={quero}
            onChange={(e) => setQuero(e.target.value)}
            placeholder="Conectar o calor extremo com Fibra em casa. Publicar antes do jogo de segunda."
            disabled={loading}
            className={`${fieldClass} min-h-[100px] resize-y`}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="self-end bg-lime text-black font-semibold text-sm tracking-[-0.01em] h-11 px-6 rounded-full inline-flex items-center justify-center gap-2 hover:brightness-105 transition-[filter] disabled:opacity-70 disabled:pointer-events-none"
        >
          {loading ? (
            <>
              Enviando briefing...
              <Loader2 className="w-[18px] h-[18px] animate-spin" strokeWidth={2.5} />
            </>
          ) : (
            <>
              Gerar relatório
              <ArrowRight className="w-[18px] h-[18px]" strokeWidth={2.5} />
            </>
          )}
        </button>
      </form>

      {error && (
        <p className="text-red-400 text-sm flex items-center gap-2">
          <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
          {error}
        </p>
      )}
    </>
  );
}

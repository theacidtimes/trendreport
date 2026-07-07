"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus, TriangleAlert, X } from "lucide-react";
import * as yaml from "js-yaml";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NewReportPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | undefined>();

  const [cliente, setCliente] = useState("");
  const [tom, setTom] = useState("");
  const [data, setData] = useState(todayISO());
  const [contexto, setContexto] = useState("");
  const [memes, setMemes] = useState<string[]>([""]);
  const [quero, setQuero] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email));
  }, []);

  function updateMeme(index: number, value: string) {
    setMemes((prev) => prev.map((m, i) => (i === index ? value : m)));
  }

  function addMeme() {
    setMemes((prev) => [...prev, ""]);
  }

  function removeMeme(index: number) {
    setMemes((prev) => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== index)));
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

    setLoading(true);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing }),
      });

      const resData = await res.json();

      if (!res.ok) {
        const base = resData.error ?? "Erro ao gerar relatório.";
        setError(resData.detail ? `${base} — ${resData.detail}` : base);
        setLoading(false);
        return;
      }

      // Navega direto pro /dashboard/[slug] assim que a linha "pending" existe —
      // é lá que mora o loader real, ligado ao progresso de verdade da geração
      // (ver PendingReport). Nada de animação de "concluído" falsa aqui, pra não
      // parecer que terminou e reiniciar de novo na página seguinte.
      router.push(`/dashboard/${resData.slug}`);
    } catch {
      setError("Erro de rede ao gerar relatório.");
      setLoading(false);
    }
  }

  const fieldClass =
    "bg-surface border border-border text-white text-[15px] rounded-xl p-4 outline-none focus:border-lime transition-colors placeholder:text-muted/70 disabled:opacity-60 font-body";

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={userEmail} />

      <main className="md:pl-64">
        <div className="min-h-screen md:min-h-0 flex items-center justify-center px-4 py-10 md:py-24">
          <div className="w-full max-w-2xl flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-muted uppercase text-xs tracking-[0.14em] font-medium">
                Novo report
              </span>
              <h1 className="font-sans text-white font-bold text-3xl md:text-4xl tracking-[-0.01em]">
                Monte o briefing.
              </h1>
              <p className="text-muted text-[15px] max-w-md">
                Preencha os campos abaixo. A gente cuida do resto pra IA entender a marca,
                a campanha e o contexto que você quer explorar.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
                    disabled={loading}
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
                className="bg-lime text-black font-bold text-base uppercase h-14 rounded-lg w-full flex items-center justify-center gap-2 shadow-lime hover:brightness-110 transition-[filter] disabled:opacity-70 disabled:pointer-events-none"
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
          </div>
        </div>
      </main>
    </div>
  );
}

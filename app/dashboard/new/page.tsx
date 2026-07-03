"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import ProcessLoader from "@/components/ProcessLoader";

const PLACEHOLDER = `data: "2026-07-01"
cliente: "Vivo Fibra"
tom: "irreverente, cultura pop brasileira"

contexto: >
  Brasil 3x0 Escócia ontem. Vini Jr fez 2 gols.
  Próximo jogo: 29/06, Houston, 14h. Calor de 33°C.

memes_que_vi:
  - "Wepinko (Vini Jr + Virginia Fonseca)"
  - "Pausa de hidratação da FIFA"

quero: >
  Conectar o calor extremo com Fibra em casa.
  Publicar antes do jogo de segunda.`;

export default function NewReportPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [briefing, setBriefing] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!briefing.trim()) {
      setError("Cole o briefing antes de gerar.");
      return;
    }

    setLoading(true);
    setDone(false);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing }),
      });

      const data = await res.json();

      if (!res.ok) {
        const base = data.error ?? "Erro ao gerar relatório.";
        setError(data.detail ? `${base} — ${data.detail}` : base);
        setLoading(false);
        return;
      }

      setDone(true);
      setTimeout(() => router.push(`/dashboard/${data.slug}`), 350);
    } catch {
      setError("Erro de rede ao gerar relatório.");
      setLoading(false);
    }
  }

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
                Cole o briefing.
              </h1>
              <p className="text-muted text-[15px] max-w-md">
                Conte pra IA sobre a marca, campanha ou contexto que você quer explorar.
              </p>
            </div>

            {loading ? (
              <ProcessLoader done={done} />
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <textarea
                  value={briefing}
                  onChange={(e) => setBriefing(e.target.value)}
                  placeholder={PLACEHOLDER}
                  className="bg-surface border border-border text-white text-[15px] rounded-xl p-4 min-h-[240px] md:min-h-[320px] resize-y outline-none focus:border-lime transition-colors font-mono placeholder:text-muted/70"
                />

                <button
                  type="submit"
                  className="bg-lime text-black font-bold text-base uppercase h-14 rounded-lg w-full flex items-center justify-center gap-2 shadow-lime hover:brightness-110 transition-[filter]"
                >
                  Gerar relatório
                  <ArrowRight className="w-[18px] h-[18px]" strokeWidth={2.5} />
                </button>
              </form>
            )}

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

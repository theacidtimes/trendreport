"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, TriangleAlert, CheckCircle2 } from "lucide-react";
import { redefinirSenha } from "@/app/auth/actions";
import Logo from "@/components/Logo";

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (senha.length < 8) {
      setError("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      await redefinirSenha(senha);
      setOk(true);
      // Sessão de recuperação é curta: mando pro login pra a pessoa entrar já com
      // a senha nova (serve tanto tenant quanto admin do console).
      setTimeout(() => router.push("/login"), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível redefinir a senha.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-bg p-4 md:p-6">
      <div className="relative w-full max-w-[420px] flex flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-card px-8 py-10">
        <div className="mb-6">
          <Logo size="md" />
        </div>

        {ok ? (
          <div className="flex flex-col gap-3">
            <div className="w-10 h-10 rounded-full bg-lime/15 grid place-items-center">
              <CheckCircle2 className="w-5 h-5 text-lime" strokeWidth={2} />
            </div>
            <h1 className="text-white font-serif text-[24px] leading-[1.2] tracking-[-0.01em]">
              Senha redefinida
            </h1>
            <p className="text-muted text-sm leading-relaxed">
              Pronto. Estamos te levando para o login.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 mb-1">
              <h1 className="text-white font-serif text-[24px] leading-[1.2] tracking-[-0.01em]">
                Criar nova senha
              </h1>
              <p className="text-muted text-sm">
                Escolha uma senha com ao menos 8 caracteres.
              </p>
            </div>

            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="nova senha"
              className="bg-bg border border-border text-white text-base h-12 px-4 rounded-lg outline-none focus:border-lime transition-colors placeholder:text-muted/70"
            />
            <input
              type="password"
              required
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              placeholder="confirmar senha"
              className="bg-bg border border-border text-white text-base h-12 px-4 rounded-lg outline-none focus:border-lime transition-colors placeholder:text-muted/70"
            />

            <button
              type="submit"
              disabled={loading}
              className="bg-lime text-black font-semibold text-[15px] tracking-[-0.01em] w-full h-12 rounded-xl mt-1 flex items-center justify-center gap-2 shadow-lime hover:brightness-105 transition-[filter] disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  Salvando
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                </>
              ) : (
                <>
                  Salvar senha
                  <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </>
              )}
            </button>

            {error && (
              <div className="flex flex-col gap-2">
                <p className="text-red-400 text-sm flex items-center gap-2">
                  <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
                  {error}
                </p>
                <Link
                  href="/esqueci-senha"
                  className="text-muted text-sm hover:text-white transition"
                >
                  Pedir um novo link
                </Link>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

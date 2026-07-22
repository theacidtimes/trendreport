"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Loader2, TriangleAlert, CheckCircle2 } from "lucide-react";
import { ativarConta } from "@/app/auth/actions";
import Logo from "@/components/Logo";
import LegalFooter from "@/components/LegalFooter";
import TermosLink from "@/components/TermosLink";

export default function AtivarPage() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [aceito, setAceito] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!nome.trim()) {
      setError("Informe seu nome.");
      return;
    }
    if (senha.length < 8) {
      setError("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setError("As senhas não conferem.");
      return;
    }
    if (!aceito) {
      setError("É necessário aceitar os Termos e Condições.");
      return;
    }
    setLoading(true);
    try {
      await ativarConta(nome, senha, aceito);
      setOk(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ativar a conta.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-bg p-4 md:p-6">
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
              Conta ativada
            </h1>
            <p className="text-muted text-sm leading-relaxed">
              Tudo pronto. Estamos te levando para o seu workspace.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 mb-1">
              <h1 className="text-white font-serif text-[24px] leading-[1.2] tracking-[-0.01em]">
                Ative sua conta
              </h1>
              <p className="text-muted text-sm">
                Defina seu nome e uma senha para entrar no workspace.
              </p>
            </div>

            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="seu nome"
              className="bg-bg border border-border text-white text-base h-12 px-4 rounded-lg outline-none focus:border-lime transition-colors placeholder:text-muted/70"
            />
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="senha (mín. 8 caracteres)"
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

            <label className="flex items-start gap-2.5 cursor-pointer select-none mt-1">
              <input
                type="checkbox"
                checked={aceito}
                onChange={(e) => setAceito(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 rounded border-border bg-bg accent-lime cursor-pointer"
              />
              <span className="text-muted text-[13px] leading-snug">
                Li e aceito os{" "}
                <TermosLink className="text-lime underline underline-offset-2 hover:brightness-110 transition">
                  Termos e Condições
                </TermosLink>{" "}
                da The Acid Times.
              </span>
            </label>

            <button
              type="submit"
              disabled={loading || !aceito}
              className="bg-lime text-black font-semibold text-[15px] tracking-[-0.01em] w-full h-12 rounded-xl mt-1 flex items-center justify-center gap-2 shadow-lime hover:brightness-105 transition-[filter] disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  Ativando
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                </>
              ) : (
                <>
                  Ativar e entrar
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
                  href="/login"
                  className="text-muted text-sm hover:text-white transition"
                >
                  Ir para o login
                </Link>
              </div>
            )}
          </form>
        )}
      </div>

      <LegalFooter className="w-full max-w-[420px]" />
    </div>
  );
}

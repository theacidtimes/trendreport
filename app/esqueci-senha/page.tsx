"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, TriangleAlert, MailCheck } from "lucide-react";
import { solicitarReset } from "@/app/auth/actions";
import Logo from "@/components/Logo";
import LegalFooter from "@/components/LegalFooter";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await solicitarReset(email);
      setEnviado(true);
    } catch {
      // Não distinguimos "e-mail não existe" de sucesso (anti-enumeração). Só um
      // erro de infra chega aqui — mensagem genérica pra não expor detalhe.
      setError("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-bg p-4 md:p-6">
      <div className="relative w-full max-w-[420px] flex flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-card px-8 py-10">
        <div className="mb-6">
          <Logo size="md" />
        </div>

        {enviado ? (
          <div className="flex flex-col gap-3">
            <div className="w-10 h-10 rounded-full bg-lime/15 grid place-items-center">
              <MailCheck className="w-5 h-5 text-lime" strokeWidth={2} />
            </div>
            <h1 className="text-white font-serif text-[24px] leading-[1.2] tracking-[-0.01em]">
              Verifique seu e-mail
            </h1>
            <p className="text-muted text-sm leading-relaxed">
              Se houver uma conta associada a esse endereço, enviamos um link para
              redefinir a senha. Verifique também a caixa de spam.
            </p>
            <Link
              href="/login"
              className="text-lime text-sm mt-2 hover:brightness-110 transition"
            >
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 mb-1">
              <h1 className="text-white font-serif text-[24px] leading-[1.2] tracking-[-0.01em]">
                Esqueceu a senha?
              </h1>
              <p className="text-muted text-sm">
                Digite seu e-mail e enviamos um link para você criar uma nova.
              </p>
            </div>

            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
              className="bg-bg border border-border text-white text-base h-12 px-4 rounded-lg outline-none focus:border-lime transition-colors placeholder:text-muted/70"
            />

            <button
              type="submit"
              disabled={loading}
              className="bg-lime text-black font-semibold text-[15px] tracking-[-0.01em] w-full h-12 rounded-xl mt-1 flex items-center justify-center gap-2 shadow-lime hover:brightness-105 transition-[filter] disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  Enviando
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
                </>
              ) : (
                <>
                  Enviar link
                  <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                </>
              )}
            </button>

            {error && (
              <p className="text-red-400 text-sm flex items-center gap-2">
                <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
                {error}
              </p>
            )}

            <Link
              href="/login"
              className="text-muted text-sm text-center hover:text-white transition"
            >
              Voltar para o login
            </Link>
          </form>
        )}
      </div>

      <LegalFooter className="w-full max-w-[420px]" />
    </div>
  );
}

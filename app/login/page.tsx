"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";
import GenerativeBackdrop from "@/components/login/GenerativeBackdrop";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("Email ou senha inválidos.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Painel do formulário */}
      <div className="flex flex-1 items-center justify-center px-6 py-10 md:px-10">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-[380px] flex flex-col gap-5"
        >
        <div className="flex flex-col items-start gap-2 mb-3">
          <Logo size="lg" />
          <span className="text-muted uppercase text-xs tracking-[0.14em] font-medium">
            trend report
          </span>
        </div>

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="bg-bg border border-border text-white text-base h-12 px-4 rounded-lg outline-none focus:border-lime transition-colors placeholder:text-muted/70"
        />

        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="senha"
          className="bg-bg border border-border text-white text-base h-12 px-4 rounded-lg outline-none focus:border-lime transition-colors placeholder:text-muted/70"
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-lime text-black font-semibold text-[15px] tracking-[-0.01em] w-full h-12 rounded-xl mt-1 flex items-center justify-center gap-2 shadow-lime hover:brightness-105 transition-[filter] disabled:opacity-60 disabled:pointer-events-none"
        >
          {loading ? (
            <>
              Entrando
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2.5} />
            </>
          ) : (
            <>
              Entrar
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
        </form>
      </div>

      {/* Painel visual — sketch generativa em código (rodízio futuro) */}
      <div className="hidden md:block w-[46%] max-w-[760px] p-3">
        <div className="relative h-full w-full overflow-hidden rounded-3xl bg-black">
          <GenerativeBackdrop tint="#81D300" highlight="#FFFFFF" />
        </div>
      </div>
    </div>
  );
}

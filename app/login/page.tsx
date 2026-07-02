"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Sparkle, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[400px] bg-surface border border-border rounded-2xl p-10 flex flex-col gap-5 shadow-card"
      >
        <div className="flex flex-col items-center gap-3 mb-1">
          <span className="w-10 h-10 rounded-full bg-lime flex items-center justify-center">
            <Sparkle className="w-5 h-5 text-black" strokeWidth={2.5} fill="currentColor" />
          </span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-white font-bold text-base">cccaramelo</span>
            <span className="text-muted uppercase text-xs tracking-[0.14em] font-medium">
              trend report
            </span>
          </div>
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
          className="bg-lime text-black font-bold w-full h-12 rounded-lg uppercase tracking-wide mt-1 flex items-center justify-center gap-2 shadow-lime hover:brightness-110 transition-[filter] disabled:opacity-60 disabled:pointer-events-none"
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
          <p className="text-red-400 text-sm flex items-center gap-2 justify-center">
            <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

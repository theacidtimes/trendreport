"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
        className="w-full max-w-[400px] bg-surface rounded-2xl p-10 flex flex-col gap-4"
      >
        <span className="text-muted uppercase text-xs tracking-[0.08em] font-medium">
          ACESSO
        </span>

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          className="bg-bg border border-border text-white text-base h-12 px-4 rounded-lg outline-none focus:border-lime transition-colors"
        />

        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="senha"
          className="bg-bg border border-border text-white text-base h-12 px-4 rounded-lg outline-none focus:border-lime transition-colors"
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-lime text-black font-bold w-full h-12 rounded-lg uppercase tracking-wide mt-2 disabled:opacity-60"
        >
          {loading ? "ENTRANDO..." : "ENTRAR →"}
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>
    </div>
  );
}

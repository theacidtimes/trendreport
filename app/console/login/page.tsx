"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AcidLogo from "@/components/AcidLogo";
import GenerativeBackdrop from "@/components/login/GenerativeBackdrop";

// Porta de entrada SEPARADA do console ACID. Distinta do /login do tenant:
// marca Acid Fabric (não a do tenant) e só deixa passar super-admin da ACID.
export default function ConsoleLoginPage() {
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

    if (signInError) {
      setLoading(false);
      setError("Email ou senha inválidos.");
      return;
    }

    // Só super-admin da ACID entra no console. Conta de tenant sem esse papel
    // é deslogada aqui mesmo (não vaza pro workspace por esta porta).
    const { data: isAcid } = await supabase.rpc("is_acid_admin");
    if (isAcid !== true) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Esta conta não tem acesso ao console Acid Fabric.");
      return;
    }

    router.push("/console");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-bg">
      {/* Painel do formulário */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-10 md:px-10">
        {/* Marca no canto superior esquerdo (só o símbolo) */}
        <div className="absolute top-6 left-6 md:top-8 md:left-8">
          <AcidLogo size="md" wordmark={false} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="w-full max-w-[380px] flex flex-col gap-5"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            className="bg-bg border border-border text-white text-base h-12 px-4 rounded-lg outline-none focus:border-purple transition-colors placeholder:text-muted/70"
          />

          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="senha"
            className="bg-bg border border-border text-white text-base h-12 px-4 rounded-lg outline-none focus:border-purple transition-colors placeholder:text-muted/70"
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-purple text-white font-semibold text-[15px] tracking-[-0.01em] w-full h-12 rounded-full mt-1 flex items-center justify-center gap-2 hover:brightness-110 transition-[filter] disabled:opacity-60 disabled:pointer-events-none"
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

      {/* Painel visual — sketch generativa (tint roxo do console) */}
      <div className="hidden md:block w-[46%] max-w-[760px] p-3">
        <div className="relative h-full w-full overflow-hidden rounded-3xl bg-black">
          <GenerativeBackdrop tint="#A063E8" highlight="#FFFFFF" />
        </div>
      </div>
    </div>
  );
}

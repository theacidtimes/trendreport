"use client";

import { useRouter } from "next/navigation";
import { LogOut, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Tela cheia mostrada quando o tenant da sessao esta suspenso ou cancelado.
// O usuario esta autenticado de verdade, mas a conta do tenant nao esta ativa,
// entao o workspace inteiro fica bloqueado ate a ACID reativar (pelo console).
// So oferece sair. Nao e um redirect pro login (o login funcionaria de novo e
// cairia aqui outra vez); e um estado terminal explicativo.
export default function TenantBloqueado({
  status,
  email,
}: {
  status: "suspenso" | "cancelado";
  email?: string;
}) {
  const router = useRouter();

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const titulo =
    status === "cancelado" ? "Conta cancelada" : "Conta suspensa";
  const texto =
    status === "cancelado"
      ? "O acesso a esta conta foi encerrado. Fale com o administrador para reativar."
      : "O acesso a esta conta está temporariamente suspenso. Fale com o administrador para regularizar.";

  return (
    <div className="min-h-screen bg-bg grid place-items-center px-6">
      <div className="w-full max-w-md rounded-3xl bg-surface border border-border p-8 flex flex-col items-center text-center gap-5 shadow-card">
        <span className="grid place-items-center w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400">
          <Lock className="w-6 h-6" strokeWidth={2} />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-white font-medium text-2xl">
            {titulo}
          </h1>
          <p className="text-muted text-sm leading-relaxed">{texto}</p>
        </div>
        <button
          onClick={sair}
          className="inline-flex items-center gap-2 rounded-full bg-surface-2 border border-border text-white text-sm font-medium px-5 py-2.5 hover:border-purple/50 transition-colors"
        >
          <LogOut className="w-4 h-4" strokeWidth={2} />
          Sair
        </button>
        {email && (
          <span className="text-muted-2 text-[11px]">{email}</span>
        )}
      </div>
    </div>
  );
}

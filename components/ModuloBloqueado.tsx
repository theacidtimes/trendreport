import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";
import { MODULO_LABEL } from "@/lib/modulos";
import type { ModuloNome } from "@/lib/types";

// Tela mostrada quando o tenant tenta acessar uma feature de um modulo que NAO
// assinou (tenant_modulos.ativo=false ou ausente). Diferente do TenantBloqueado
// (conta inteira suspensa): aqui a conta esta ativa, so ESTE app nao esta no
// plano. Oferece voltar ao inicio — o resto do workspace segue acessivel.
export default function ModuloBloqueado({ modulo }: { modulo: ModuloNome }) {
  const label = MODULO_LABEL[modulo] ?? modulo;
  return (
    <div className="min-h-screen bg-bg grid place-items-center px-6">
      <div className="w-full max-w-md rounded-3xl bg-surface border border-border p-8 flex flex-col items-center text-center gap-5 shadow-card">
        <span className="grid place-items-center w-14 h-14 rounded-2xl bg-purple/10 text-purple">
          <Lock className="w-6 h-6" strokeWidth={2} />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-serif text-white font-medium text-2xl">
            {label} não está no seu plano
          </h1>
          <p className="text-muted text-sm leading-relaxed">
            Este módulo não faz parte da sua assinatura. Fale com o administrador
            para habilitar o {label} na sua conta.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-surface-2 border border-border text-white text-sm font-medium px-5 py-2.5 hover:border-purple/50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={2} />
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

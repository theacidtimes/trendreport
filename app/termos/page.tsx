import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/Logo";
import TermosContent from "@/components/TermosContent";
import { OPERADORA, TERMOS_VERSAO } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Termos e Condições de Uso",
  description: `Termos e Condições de Uso da plataforma, operada por ${OPERADORA.nome}.`,
};

// Rota canônica dos T&C (link direto / acesso por URL). No fluxo do produto, os
// termos abrem em modal (TermosModal); esta página reusa o mesmo conteúdo.
export default function TermosPage() {
  return (
    <div className="min-h-screen bg-bg text-white">
      <div className="mx-auto w-full max-w-[720px] px-5 py-12 md:py-16">
        <div className="flex items-center justify-between mb-10">
          <Logo size="md" />
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-muted text-sm hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            Voltar
          </Link>
        </div>

        <header className="mb-10 border-b border-border pb-8">
          <h1 className="font-serif text-[34px] leading-[1.1] tracking-[-0.02em]">
            Termos e Condições de Uso
          </h1>
          <p className="text-muted-2 text-sm mt-3">
            Versão {TERMOS_VERSAO}. Plataforma desenvolvida e operada por{" "}
            {OPERADORA.nome}, CNPJ {OPERADORA.cnpj}.
          </p>
        </header>

        <TermosContent />

        <footer className="mt-14 border-t border-border pt-6">
          <p className="text-muted-2 text-[13px] leading-relaxed">
            Ao ativar sua conta ou realizar o primeiro login na Plataforma, você
            declara ter lido e aceitado estes Termos e Condições de Uso.
          </p>
        </footer>
      </div>
    </div>
  );
}

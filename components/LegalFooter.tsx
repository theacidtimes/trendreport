import { OPERADO_POR } from "@/lib/legal";
import TermosLink from "./TermosLink";

// Rodapé legal das telas de autenticação (login, ativação, recuperação).
// Atribuição fixa da operadora + T&C em modal. Não usa o branding do tenant de
// propósito: quem opera a plataforma aparece em todas.
export default function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <p className={`text-muted-2 text-[11px] leading-relaxed text-center ${className}`}>
      {OPERADO_POR}
      {" · "}
      <TermosLink className="underline underline-offset-2 hover:text-muted transition-colors">
        Termos e Condições
      </TermosLink>
    </p>
  );
}

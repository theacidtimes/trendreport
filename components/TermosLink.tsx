"use client";

import { useState } from "react";
import TermosModal from "./TermosModal";

// Gatilho que abre os T&C em modal. Usado no rodapé legal e no checkbox de aceite.
// stopPropagation evita que o clique borbulhe pro <label> pai (no aceite) e acabe
// marcando o checkbox junto.
export default function TermosLink({
  className = "",
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={className}
      >
        {children ?? "Termos e Condições"}
      </button>
      {open && <TermosModal onClose={() => setOpen(false)} />}
    </>
  );
}

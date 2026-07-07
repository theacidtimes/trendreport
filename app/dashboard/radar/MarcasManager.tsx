"use client";

import { Marca } from "@/lib/types";
import MarcaToggle from "@/components/radar/MarcaToggle";
import { toggleMarca } from "./actions";

export default function MarcasManager({ marcas }: { marcas: Marca[] }) {
  if (marcas.length === 0) {
    return (
      <p className="text-muted text-sm">
        nenhuma marca cadastrada. adicione uma marca na tabela{" "}
        <code>marcas</code> do Supabase para começar a monitorar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {marcas.map((marca) => (
        <MarcaToggle key={marca.id} marca={marca} onToggle={toggleMarca} />
      ))}
    </div>
  );
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MarcaKnowledge } from "@/lib/types";

export async function toggleMarca(id: string, status: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("marcas")
    .update({ status_varredura: status })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createMarca(data: {
  nome: string;
  produto: string;
  tom: string;
  perfil_comportamental: string;
  universos_culturais: string[];
  o_que_evitar: string[];
  ambicao_de_marca: string;
  intervalo_horas: number;
}): Promise<void> {
  const nome = data.nome.trim();
  if (!nome) throw new Error("Nome da marca é obrigatório.");

  const yaml_conhecimento: MarcaKnowledge = {
    marca: nome,
    produto: data.produto.trim(),
    tom: data.tom.trim(),
    perfil_comportamental: data.perfil_comportamental.trim(),
    universos_culturais: data.universos_culturais,
    o_que_evitar: data.o_que_evitar,
    ambicao_de_marca: data.ambicao_de_marca.trim(),
  };

  const supabase = createClient();
  const { error } = await supabase.from("marcas").insert({
    nome,
    yaml_conhecimento,
    status_varredura: false,
    intervalo_horas: data.intervalo_horas,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/radar");
}

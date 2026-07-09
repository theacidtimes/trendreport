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
  revalidatePath("/dashboard/radar");
  revalidatePath("/dashboard/admin/clientes");
}

export async function createMarca(data: {
  nome: string;
  produto: string;
  tom: string;
  perfil_comportamental: string;
  universos_culturais: string[];
  o_que_evitar: string[];
  ambicao_de_marca: string;
  termos_busca: string[];
  termos_culturais?: string[];
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
    termos_busca: data.termos_busca,
    termos_culturais: data.termos_culturais ?? [],
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
  revalidatePath("/dashboard/admin/clientes");
}

export async function updateMarca(
  id: string,
  data: {
    nome: string;
    produto: string;
    tom: string;
    perfil_comportamental: string;
    universos_culturais: string[];
    o_que_evitar: string[];
    ambicao_de_marca: string;
    termos_busca: string[];
    termos_culturais?: string[];
    intervalo_horas: number;
  }
): Promise<void> {
  const nome = data.nome.trim();
  if (!nome) throw new Error("Nome da marca é obrigatório.");

  const supabase = createClient();

  // Preserva termos_culturais quando o form não manda (a lane cultural é curada por
  // SQL/DNA e não está no form ainda; um update de marca não pode zerá-la).
  let termos_culturais = data.termos_culturais;
  if (termos_culturais === undefined) {
    const { data: atual } = await supabase
      .from("marcas")
      .select("yaml_conhecimento")
      .eq("id", id)
      .single();
    termos_culturais =
      (atual?.yaml_conhecimento as MarcaKnowledge | undefined)?.termos_culturais ?? [];
  }

  const yaml_conhecimento: MarcaKnowledge = {
    marca: nome,
    produto: data.produto.trim(),
    tom: data.tom.trim(),
    perfil_comportamental: data.perfil_comportamental.trim(),
    universos_culturais: data.universos_culturais,
    o_que_evitar: data.o_que_evitar,
    ambicao_de_marca: data.ambicao_de_marca.trim(),
    termos_busca: data.termos_busca,
    termos_culturais,
  };

  const { error } = await supabase
    .from("marcas")
    .update({ nome, yaml_conhecimento, intervalo_horas: data.intervalo_horas })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/radar");
  revalidatePath("/dashboard/admin/clientes");
  revalidatePath(`/dashboard/admin/clientes/${id}`);
}

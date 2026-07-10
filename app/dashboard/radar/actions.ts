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

// LinkedIn é a única lane ligável (as outras — reddit/tiktok/x/news — são default e
// travadas). linkedin_ativo vive dentro do jsonb yaml_conhecimento, então lê o DNA atual,
// troca só o flag e regrava (preserva o resto do DNA).
export async function toggleLinkedin(id: string, active: boolean): Promise<void> {
  const supabase = createClient();
  const { data: atual } = await supabase
    .from("marcas")
    .select("yaml_conhecimento")
    .eq("id", id)
    .single();
  const dna = (atual?.yaml_conhecimento ?? {}) as MarcaKnowledge;
  const yaml_conhecimento: MarcaKnowledge = { ...dna, linkedin_ativo: active };
  const { error } = await supabase
    .from("marcas")
    .update({ yaml_conhecimento })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/radar");
  revalidatePath("/dashboard/admin/clientes");
  revalidatePath(`/dashboard/admin/clientes/${id}`);
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
  termos_culturais_en?: string[];
  linkedin_ativo?: boolean;
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
    termos_culturais_en: data.termos_culturais_en ?? [],
    linkedin_ativo: data.linkedin_ativo ?? false,
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
    termos_culturais_en?: string[];
    linkedin_ativo?: boolean;
    intervalo_horas: number;
  }
): Promise<void> {
  const nome = data.nome.trim();
  if (!nome) throw new Error("Nome da marca é obrigatório.");

  const supabase = createClient();

  // Preserva campos que o form não manda (termos_culturais e termos_culturais_en são
  // curados por SQL/DNA, não estão no form; um update de marca não pode zerá-los).
  // linkedin_ativo vem do form, mas se faltar, mantém o valor atual.
  let termos_culturais = data.termos_culturais;
  let termos_culturais_en = data.termos_culturais_en;
  let linkedin_ativo = data.linkedin_ativo;
  if (
    termos_culturais === undefined ||
    termos_culturais_en === undefined ||
    linkedin_ativo === undefined
  ) {
    const { data: atual } = await supabase
      .from("marcas")
      .select("yaml_conhecimento")
      .eq("id", id)
      .single();
    const dna = atual?.yaml_conhecimento as MarcaKnowledge | undefined;
    if (termos_culturais === undefined) termos_culturais = dna?.termos_culturais ?? [];
    if (termos_culturais_en === undefined)
      termos_culturais_en = dna?.termos_culturais_en ?? [];
    if (linkedin_ativo === undefined) linkedin_ativo = dna?.linkedin_ativo ?? false;
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
    termos_culturais_en,
    linkedin_ativo,
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

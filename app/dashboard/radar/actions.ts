"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { MarcaKnowledge } from "@/lib/types";
import { mesclarDNA, precisaDerivar, type PatchDNA } from "@/lib/marcaDNA";
import { derivarPerfilCultural } from "@/lib/radar/perfilCultural";
import { dominiosDaAgenda } from "@/lib/radar/agendaDominios";

// Deriva o perfil cultural e devolve os campos a gravar. Roda no SAVE, nunca na
// varredura: é decisão de configuração, muda quando o DNA muda, e não pode virar
// custo por rodada.
async function comPerfilDerivado(dna: MarcaKnowledge): Promise<MarcaKnowledge> {
  // O vocabulário é o do PAÍS da marca. Oferecer domínio sem linha no calendário
  // dela produziria uma assinatura que nunca casa — config que parece ligada,
  // reserva custo e não raspa nada.
  const perfil = await derivarPerfilCultural(dna, await dominiosDaAgenda(dna.pais));
  console.log(
    `[PERFIL] ${dna.marca}: [${perfil.dominios_culturais.join(", ") || "nenhum domínio"}] ` +
      `peso ${perfil.peso_cultural.toFixed(2)} — ${perfil.justificativa}`
  );
  return {
    ...dna,
    dominios_culturais: perfil.dominios_culturais,
    peso_cultural: perfil.peso_cultural,
    justificativa_cultural: perfil.justificativa,
    // Derivou, logo não é manual. Sem esta linha uma marca que já foi manual e
    // voltou a ser derivada continuaria marcada, e a reavaliação em lote a
    // pularia para sempre — invisível, porque a tela mostraria o perfil certo.
    perfil_cultural_manual: false,
  };
}

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
  pais?: string;
  dominios_culturais?: string[];
  peso_cultural?: number;
  perfil_cultural_manual?: boolean;
  intervalo_horas: number;
}): Promise<void> {
  const nome = data.nome.trim();
  if (!nome) throw new Error("Nome da marca é obrigatório.");

  const base: MarcaKnowledge = {
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
    pais: (data.pais ?? "BR").trim().toUpperCase(),
  };

  const supabase = createClient();
  // Marca nova SEM perfil declarado é exatamente o caso que criou o buraco: antes
  // disto ela nascia, por construção, sem agenda cultural nenhuma, e a ausência
  // não dava erro nem log. Se o admin já preencheu os campos na tela, a escolha
  // dele vale e a derivação nem roda.
  const yaml_conhecimento = precisaDerivar(null, data as PatchDNA)
    ? await comPerfilDerivado(base)
    : mesclarDNA(base, {
        dominios_culturais: data.dominios_culturais,
        peso_cultural: data.peso_cultural,
        perfil_cultural_manual: data.perfil_cultural_manual,
      });

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
    pais?: string;
    dominios_culturais?: string[];
    peso_cultural?: number;
    perfil_cultural_manual?: boolean;
    intervalo_horas: number;
  }
): Promise<void> {
  const nome = data.nome.trim();
  if (!nome) throw new Error("Nome da marca é obrigatório.");

  const supabase = createClient();

  // Sempre lê o DNA gravado. Antes, esta leitura era condicional (só quando algum
  // dos três campos conhecidos faltava) e o resultado era montado do zero: quem
  // salvasse a tela completa nunca lia nada e apagava tudo que a tela não conhece.
  const { data: atual } = await supabase
    .from("marcas")
    .select("yaml_conhecimento")
    .eq("id", id)
    .single();
  const dna = (atual?.yaml_conhecimento ?? null) as MarcaKnowledge | null;

  const patch: PatchDNA = {
    marca: nome,
    produto: data.produto.trim(),
    tom: data.tom.trim(),
    perfil_comportamental: data.perfil_comportamental.trim(),
    universos_culturais: data.universos_culturais,
    o_que_evitar: data.o_que_evitar,
    ambicao_de_marca: data.ambicao_de_marca.trim(),
    termos_busca: data.termos_busca,
    termos_culturais: data.termos_culturais,
    termos_culturais_en: data.termos_culturais_en,
    linkedin_ativo: data.linkedin_ativo,
    pais: data.pais?.trim().toUpperCase(),
    dominios_culturais: data.dominios_culturais,
    peso_cultural: data.peso_cultural,
    perfil_cultural_manual: data.perfil_cultural_manual,
  };

  // MESCLA sobre o gravado: campo que a tela não manda (`undefined`) fica como
  // está. `termos_linkedin`, `idioma` e o perfil cultural sobrevivem a um save
  // que só corrigiu o "tom" — que é o que não acontecia antes.
  const mesclado = mesclarDNA(dna, patch);
  const yaml_conhecimento = precisaDerivar(dna, patch)
    ? await comPerfilDerivado(mesclado)
    : mesclado;

  const { error } = await supabase
    .from("marcas")
    .update({ nome, yaml_conhecimento, intervalo_horas: data.intervalo_horas })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/radar");
  revalidatePath("/dashboard/admin/clientes");
  revalidatePath(`/dashboard/admin/clientes/${id}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizarLinha, type EntradaLinha } from "@/lib/radar/agendaLinha";
import { dominiosDaAgenda } from "@/lib/radar/agendaDominios";
import { derivarPerfilCultural } from "@/lib/radar/perfilCultural";
import { paisDaMarca } from "@/lib/radar/planner";
import type { Marca, MarcaKnowledge } from "@/lib/types";

// Toda escrita aqui passa pelo cliente do USUÁRIO, nunca pela service key: a RLS
// de `pulso_cultural` já separa quem pode o quê (`tenant_id = jwt_tenant_id() OR
// is_acid_admin()`). Repetir essa regra em TypeScript criaria uma segunda fonte
// de verdade que só é consultada quando a requisição vem pela tela — e a que
// vale de fato continuaria sendo a do banco.
function revalidar(): void {
  revalidatePath("/dashboard/admin/agenda");
  // A agenda muda o VOCABULÁRIO oferecido no DNA da marca: domínio novo aqui
  // aparece lá sem deploy, mas só se a página não vier de cache.
  revalidatePath("/dashboard/admin/clientes");
}

export async function salvarLinha(entrada: EntradaLinha): Promise<void> {
  const v = normalizarLinha(entrada);
  if (!v.ok) throw new Error(v.erro);

  const supabase = createClient();
  if (entrada.id) {
    const { error } = await supabase
      .from("pulso_cultural")
      .update(v.linha)
      .eq("id", entrada.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("pulso_cultural")
      .insert({ ...v.linha, origem: "curadoria" });
    if (error) throw new Error(error.message);
  }
  revalidar();
}

export async function alternarLinha(id: string, ativo: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("pulso_cultural")
    .update({ ativo })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidar();
}

export async function excluirLinha(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("pulso_cultural").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidar();
}

export type MudancaPerfil = {
  marca: string;
  antes: string[];
  depois: string[];
  motivo: string;
  estado: "mudou" | "igual" | "manual" | "erro";
};

/**
 * Reavalia o perfil cultural de todas as marcas contra o vocabulário ATUAL.
 *
 * Não é um botão de manutenção — é a outra metade de criar um domínio. O perfil
 * fica gravado no DNA da marca e só é recalculado quando alguém salva aquela
 * marca. Sem esta ação, criar `saude` produz um domínio que existe, que aparece
 * na tela, que ninguém assina e que nunca roda: a mesma config que MENTE que o
 * resto desta fase passou inteira consertando, reintroduzida pela porta nova.
 *
 * Pula quem foi definido na mão. A escolha de alguém que olhou a marca vale mais
 * que a do modelo, e sobrescrevê-la em lote seria destruir trabalho sem aviso.
 */
export async function reavaliarPerfis(): Promise<MudancaPerfil[]> {
  const supabase = createClient();
  const { data } = await supabase.from("marcas").select("*");
  const marcas = (data ?? []) as Marca[];

  // Um domínio por PAÍS, buscado uma vez: a carteira inteira é BR hoje, e uma
  // consulta por marca seria N consultas idênticas.
  const vocabulario = new Map<string, string[]>();
  for (const pais of Array.from(new Set(marcas.map(paisDaMarca)))) {
    vocabulario.set(pais, await dominiosDaAgenda(pais));
  }

  const out: MudancaPerfil[] = [];
  for (const marca of marcas) {
    const dna = (marca.yaml_conhecimento ?? {}) as MarcaKnowledge;
    const antes = dna.dominios_culturais ?? [];
    const nome = dna.marca || marca.nome;

    if (dna.perfil_cultural_manual) {
      out.push({
        marca: nome,
        antes,
        depois: antes,
        motivo: "definido manualmente — preservado",
        estado: "manual",
      });
      continue;
    }

    try {
      const perfil = await derivarPerfilCultural(
        dna,
        vocabulario.get(paisDaMarca(marca)) ?? []
      );
      const yaml_conhecimento: MarcaKnowledge = {
        ...dna,
        dominios_culturais: perfil.dominios_culturais,
        peso_cultural: perfil.peso_cultural,
        justificativa_cultural: perfil.justificativa,
        perfil_cultural_manual: false,
      };
      const { error } = await supabase
        .from("marcas")
        .update({ yaml_conhecimento })
        .eq("id", marca.id);
      if (error) throw new Error(error.message);

      const depois = perfil.dominios_culturais;
      const mudou =
        antes.length !== depois.length ||
        antes.some((d) => !depois.includes(d)) ||
        (dna.peso_cultural ?? -1) !== perfil.peso_cultural;
      console.log(
        `[REAVALIA] ${nome}: [${antes.join(", ") || "—"}] -> ` +
          `[${depois.join(", ") || "—"}] peso ${perfil.peso_cultural.toFixed(2)}`
      );
      out.push({
        marca: nome,
        antes,
        depois,
        motivo: perfil.justificativa,
        estado: mudou ? "mudou" : "igual",
      });
    } catch (err) {
      // Uma marca que falha não pode abortar o lote: as outras já foram
      // gravadas, e um erro no meio deixaria a carteira metade nova, metade
      // velha, sem ninguém saber onde foi a fronteira.
      out.push({
        marca: nome,
        antes,
        depois: antes,
        motivo: err instanceof Error ? err.message : "erro na derivação",
        estado: "erro",
      });
    }
  }

  revalidar();
  return out;
}

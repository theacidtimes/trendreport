import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COLUNAS_COLETA,
  COLUNAS_RADAR,
  linhaColetaParaItem,
  linhaRadarParaItem,
  type LinhaRadar,
} from "./acervo";
import type { ColetaItem } from "./types";

// REPORT MONTADO
//
// A pessoa escolhe no acervo da marca quais posts entram no report e em que
// ordem. Quem decide se cada um é tendência ou meme é o modelo, pelo mesmo
// critério do report gerado: a pessoa só inclui. A rota /api/reports/montar só valida e enfileira: a linha nasce
// em "pending" com este briefing, e o worker (scripts/generate-report.ts)
// escreve o report com o mesmo modelo e o mesmo prompt do report gerado, só
// que sem coletar: a matéria-prima são os itens escolhidos (lib/redigirMontado.ts).

export type RefAcervo = { id: string; origem: "report" | "radar" };

export interface BriefingMontado {
  modo: "montado";
  cliente: string;
  // Vazios = o modelo decide, como no report gerado.
  produto?: string;
  edicao?: string;
  titulo_social?: string;
  // Direção de leitura opcional ("foco no plantio da safra 26/27").
  orientacao?: string;
  // Na ordem em que a pessoa deixou.
  itens: RefAcervo[];
}

export const MAX_ITENS = 20;

export function ehBriefingMontado(b: unknown): b is BriefingMontado {
  return !!b && typeof b === "object" && (b as { modo?: unknown }).modo === "montado";
}

export function refsValidas(refs: unknown): RefAcervo[] {
  if (!Array.isArray(refs)) return [];
  return refs
    .filter(
      (r): r is RefAcervo =>
        !!r &&
        typeof (r as RefAcervo).id === "string" &&
        ((r as RefAcervo).origem === "report" || (r as RefAcervo).origem === "radar")
    )
    .map((r) => ({ id: r.id, origem: r.origem }))
    .slice(0, MAX_ITENS);
}

/**
 * Relê do banco os itens escolhidos, presos à marca, e devolve na ordem em que
 * a pessoa montou. Item que sumiu ou é de outra marca não entra. Serve à rota
 * (com a RLS do tenant) e ao worker (service role).
 */
export async function resolverItens(
  supabase: SupabaseClient,
  marcaId: string,
  refs: RefAcervo[]
): Promise<ColetaItem[] | { error: string }> {
  const todos = refs;
  const idsColeta = todos.filter((r) => r.origem === "report").map((r) => r.id);
  const idsRadar = todos.filter((r) => r.origem === "radar").map((r) => r.id);

  const [resColeta, resRadar] = await Promise.all([
    idsColeta.length
      ? supabase.from("coleta_item").select(COLUNAS_COLETA).eq("marca_id", marcaId).in("id", idsColeta)
      : Promise.resolve({ data: [], error: null }),
    idsRadar.length
      ? supabase.from("radar_raw_data").select(COLUNAS_RADAR).eq("marca_id", marcaId).in("id", idsRadar)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (resColeta.error || resRadar.error) {
    return { error: (resColeta.error ?? resRadar.error)?.message ?? "Falha ao ler o acervo." };
  }

  const porChave = new Map<string, ColetaItem>();
  for (const r of resColeta.data ?? []) {
    porChave.set(`report:${(r as { id: string }).id}`, linhaColetaParaItem(r as Omit<ColetaItem, "origem">));
  }
  for (const r of (resRadar.data ?? []) as LinhaRadar[]) {
    const item = linhaRadarParaItem(r);
    if (item) porChave.set(`radar:${item.id}`, item);
  }

  return refs.map((r) => porChave.get(`${r.origem}:${r.id}`)).filter((i): i is ColetaItem => !!i);
}

import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { registrarCustos } from "../lib/custos";
import { classificarRelevancia } from "../lib/relevancia";
import type { MarcaKnowledge } from "../lib/types";

// Classifica o acervo que ainda não tem relevância (coleta_item.relevante null):
// as linhas gravadas antes da migration 0050 e os lotes em que o classificador
// falhou. Roda pelo workflow "Acervo — Relevância" (as chaves reais só existem
// nos secrets). Pode rodar de novo à vontade: só pega o que está null.
//
//   MARCA_ID (opcional) = só esta marca. Sem ele, todas as marcas.

const PAGINA = 500;

async function main() {
  const url = process.env.SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.");
  // Mesmo motivo do generate-report.ts: o runner nem sempre tem WebSocket global.
  const supabase = createClient(url, chave, { realtime: { transport: WebSocket as never } });

  const so = process.env.MARCA_ID?.trim() || null;
  let consulta = supabase.from("marcas").select("id, nome, tenant_id, yaml_conhecimento");
  if (so) consulta = consulta.eq("id", so);
  const { data: marcas, error } = await consulta;
  if (error) throw new Error(`Falha ao ler marcas: ${error.message}`);

  let totalUsd = 0;
  for (const marca of marcas ?? []) {
    let classificados = 0;
    // Sempre a primeira página das pendentes: o que é classificado sai do
    // filtro. Página que volta inteira sem classificação (falha do modelo)
    // encerra a marca, senão o laço não termina.
    for (;;) {
      const { data: linhas, error: e } = await supabase
        .from("coleta_item")
        .select("id, plataforma, autor, texto")
        .eq("marca_id", marca.id)
        .is("relevante", null)
        .order("coletado_em", { ascending: false })
        .limit(PAGINA);
      if (e) throw new Error(`Falha ao ler acervo de ${marca.nome}: ${e.message}`);
      if (!linhas?.length) break;

      const { resultado, custos } = await classificarRelevancia(linhas, {
        nome: marca.nome,
        knowledge: marca.yaml_conhecimento as MarcaKnowledge | null,
      });
      await registrarCustos(
        supabase,
        custos.map((c) => ({
          ...c,
          tenantId: marca.tenant_id ?? null,
          marcaId: marca.id,
          origem: "report" as const,
        }))
      );
      totalUsd += custos.reduce((s, c) => s + c.custoUsd, 0);

      for (const valor of [true, false]) {
        const ids = linhas.filter((_, n) => resultado[n] === valor).map((l) => l.id);
        if (!ids.length) continue;
        const { error: eu } = await supabase
          .from("coleta_item")
          .update({ relevante: valor })
          .in("id", ids);
        if (eu) throw new Error(`Falha ao gravar relevância de ${marca.nome}: ${eu.message}`);
        classificados += ids.length;
      }
      if (resultado.every((v) => v === null)) {
        console.error(`[ACERVO] ${marca.nome}: classificador falhou na página inteira, parando esta marca.`);
        break;
      }
    }
    if (classificados) console.log(`[ACERVO] ${marca.nome}: ${classificados} item(ns) classificado(s).`);
  }
  console.log(`[ACERVO] fim. Custo de classificação: US$${totalUsd.toFixed(4)}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

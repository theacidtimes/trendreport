import { fetchTikTok, type ApifyRunLog } from "../lib/apify";
import { enriquecerComLegendas, vttParaTexto } from "../lib/legendas";

// Validação CONTRA A APIFY REAL do que ficou pendente por falta de saldo:
//   1. o refactor do runActor (POST /runs + poll + dataset) devolve run id,
//      status terminal e usageTotalUsd?
//   2. DOWNLOAD_SUBTITLES realmente traz `videoMeta.subtitleLinks`?
//   3. o `downloadLink` é buscável, e em que formato? (o parser foi escrito
//      tolerante a VTT e SRT justamente porque isto não pôde ser conferido)
//   4. o custo real do run — que é o número que vira linha em custos_uso.
//
// Roda UM actor com UMA keyword. Não escreve nada no Supabase.

async function main() {
  const keyword = process.argv[2] ?? "tendencia";
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN ausente (rode com dotenv/-r)");

  console.log(`\n=== 1. rodando fetchTikTok(["${keyword}"]) ===`);
  const log: ApifyRunLog = [];
  const t0 = Date.now();
  const items = await fetchTikTok([keyword], log);
  const seg = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n--- log de run (o que vira custos_uso) --- ${seg}s`);
  for (const r of log) {
    console.log(
      `  fonte=${r.fonte} runId=${r.runId} status=${r.status} ` +
        `custoUsd=${r.custoUsd} itens=${r.itens} startedAt=${r.startedAt} ` +
        `falha=${r.falha ? JSON.stringify(r.falha) : "null"}`
    );
  }
  console.log(`  itens apos os filtros (recencia/PT/anuncio): ${items.length}`);

  // ── 2. o dataset bruto: a legenda veio mesmo? ───────────────
  const runId = log[0]?.runId;
  if (!runId) {
    console.error("Sem runId — nada mais a validar.");
    return;
  }
  const runRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${token}`
  );
  const runData = (await runRes.json())?.data ?? {};
  console.log(
    `\n=== 2. run conferido na API: status=${runData.status} ` +
      `usageTotalUsd=${runData.usageTotalUsd} ===`
  );

  const dsRes = await fetch(
    `https://api.apify.com/v2/datasets/${runData.defaultDatasetId}/items?token=${token}&limit=100`
  );
  const brutos = (await dsRes.json()) as Record<string, unknown>[];
  const comLinks = brutos.filter((b) => {
    const vm = b.videoMeta as { subtitleLinks?: unknown[] } | undefined;
    return Array.isArray(vm?.subtitleLinks) && vm!.subtitleLinks!.length > 0;
  });
  console.log(
    `  ${brutos.length} itens no dataset, ${comLinks.length} com subtitleLinks`
  );

  const amostra = comLinks[0]?.videoMeta as
    | { subtitleLinks?: Record<string, unknown>[] }
    | undefined;
  if (amostra?.subtitleLinks?.length) {
    console.log("\n  FORMA REAL de subtitleLinks[0] (o que o codigo assume):");
    console.log("  " + JSON.stringify(amostra.subtitleLinks[0], null, 2).replace(/\n/g, "\n  "));
    console.log(`  linguas ofertadas: ${amostra.subtitleLinks.map((l) => `${l.language}/${l.source}`).join(", ")}`);
  } else {
    console.error("  NENHUM item trouxe subtitleLinks — DOWNLOAD_SUBTITLES nao surtiu efeito.");
  }

  // ── 3. o downloadLink baixa? em que formato? ────────────────
  const url = amostra?.subtitleLinks?.[0]?.downloadLink as string | undefined;
  if (url) {
    console.log(`\n=== 3. baixando o arquivo de legenda ===`);
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TrendsAgent/1.0)" },
    });
    console.log(`  HTTP ${res.status} content-type=${res.headers.get("content-type")}`);
    const raw = await res.text();
    console.log(`  ${raw.length} chars. PRIMEIROS 300 CRUS:`);
    console.log("  ---8<---");
    console.log(raw.slice(0, 300).replace(/\n/g, "\n  "));
    console.log("  ---8<---");
    console.log(`\n  vttParaTexto() sobre ele:`);
    console.log(`  "${vttParaTexto(raw)}"`);
  }

  // ── 4. o caminho de verdade, ponta a ponta ──────────────────
  console.log(`\n=== 4. enriquecerComLegendas() nos ${items.length} itens ===`);
  const diag = await enriquecerComLegendas(items);
  console.log(`  ${diag.resumo}`);
  for (const i of items.filter((x) => x.transcricao).slice(0, 3)) {
    console.log(`\n  ${i.webVideoUrl}`);
    console.log(`    caption:    "${(i.text ?? "").slice(0, 90)}"`);
    console.log(`    transcricao:"${(i.transcricao ?? "").slice(0, 200)}"`);
  }
  console.log(
    `\n  sobrou algum subtitleUrl no payload (nao deve)? ` +
      `${items.some((i) => i.subtitleUrl) ? "SIM — BUG" : "nao"}`
  );
}

main().catch((e) => {
  console.error("FALHOU:", e);
  process.exit(1);
});

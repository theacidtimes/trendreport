import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import * as yaml from "js-yaml";
import WebSocket from "ws";

// Worker da fila de reports. Inverte quem começa a conversa: em vez de a Vercel
// EMPURRAR um repository_dispatch pro GitHub (que exigia um PAT de longa duração
// e morreu três vezes em quatro dias, sempre com 401), o Actions PUXA daqui os
// reports que estão esperando. O app só escreve a linha em "pending" — coisa que
// ele já fazia e já tinha credencial pra fazer.
//
// O que isso elimina: nenhum token do GitHub em lugar nenhum do caminho. Não há
// o que expirar, renovar ou vazar. É o mesmo padrão do radar-cron, que roda há
// semanas sem nunca ter dado esse problema.
//
// Retry sai de graça: report que ficou pendente porque o job morreu no meio é
// simplesmente pego de novo na próxima passada. Antes isso virava órfão eterno.

// Teto por passada. Cada report leva minutos; com o timeout de 25min do job,
// três é o que cabe com folga. O resto espera o próximo tique (5min), não se
// perde.
const MAX_POR_PASSADA = 3;

// Carência antes de pegar um report recém-criado. Evita corrida com a própria
// rota que acabou de inserir a linha e ainda está respondendo ao navegador.
const CARENCIA_SEGUNDOS = 20;

if (!(globalThis as { WebSocket?: unknown }).WebSocket) {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket as unknown;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios (verifique os secrets do repositório)."
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    realtime: { transport: WebSocket as never },
  });

  const ate = new Date(Date.now() - CARENCIA_SEGUNDOS * 1000).toISOString();

  // Mais antigo primeiro: quem esperou mais, gera antes.
  const { data: fila, error } = await supabase
    .from("reports")
    .select("slug, cliente, briefing, created_at")
    .eq("status", "pending")
    .lt("created_at", ate)
    .order("created_at", { ascending: true })
    .limit(MAX_POR_PASSADA);

  if (error) {
    throw new Error(`Falha ao ler a fila de reports: ${error.message}`);
  }

  if (!fila?.length) {
    console.log("[FILA] Nenhum report pendente.");
    return;
  }

  console.log(`[FILA] ${fila.length} report(s) pendente(s) nesta passada.`);

  let falhas = 0;

  for (const item of fila) {
    console.log(`\n[FILA] ── gerando ${item.slug} (${item.cliente}) ──`);

    // O briefing foi salvo como jsonb (a rota faz yaml.load antes de inserir),
    // e o gerador quer o YAML em texto. Redump devolve um YAML equivalente —
    // mesmo conteúdo, formatação canônica. É o que permite a fila funcionar sem
    // depender de um payload carregado pelo dispatch.
    const briefingYaml = yaml.dump(item.briefing);

    // Processo separado de propósito: reaproveita scripts/generate-report.ts
    // exatamente como está (já testado em produção há semanas) e isola falhas —
    // um report que estoura memória ou lança não derruba os outros da passada.
    const res = spawnSync("npx", ["tsx", "scripts/generate-report.ts"], {
      stdio: "inherit",
      env: {
        ...process.env,
        REPORT_SLUG: item.slug,
        BRIEFING_YAML: briefingYaml,
      },
    });

    if (res.status !== 0) {
      falhas++;
      console.error(`[FILA] ${item.slug} terminou com código ${res.status}.`);
      // Não marcamos "error" aqui: o próprio generate-report.ts já grava o
      // motivo quando consegue. Se ele morreu antes disso, a linha continua
      // "pending" e a próxima passada tenta de novo — que é o comportamento
      // desejado pra falha transitória (rede, rate limit, runner morto).
    } else {
      console.log(`[FILA] ${item.slug} concluído.`);
    }
  }

  console.log(
    `\n[FILA] Passada encerrada: ${fila.length - falhas} ok, ${falhas} com falha.`
  );

  // Job vermelho quando algo falhou — a varredura de manutenção lê execuções
  // falhas do Actions e te avisa. Silêncio só quando foi tudo bem.
  if (falhas) process.exitCode = 1;
}

main().catch((err) => {
  console.error(
    "[FILA] Erro fatal no worker:",
    err instanceof Error ? err.message : String(err)
  );
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exitCode = 1;
});

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

// Teto por consulta à fila. Cada report leva minutos; três de uma vez é o que
// cabe sem estourar o timeout do job. O resto é pego na volta seguinte do laço.
const MAX_POR_PASSADA = 3;

// Carência antes de pegar um report recém-criado. Evita corrida com a própria
// rota que acabou de inserir a linha e ainda está respondendo ao navegador.
const CARENCIA_SEGUNDOS = 20;

// JANELA DE VIGÍLIA. O worker não faz uma passada e sai: fica olhando a fila
// por este tempo antes de encerrar. Motivo, medido nos runs de 01 a 09/09: o
// `cron: */5` do GitHub estava disparando a cada 2 a 4 HORAS (não é bug nosso,
// é o GitHub atrasando schedule de repositório com pouca atividade). O report
// 4b9ec88a da Vivo, criado 17:54, só começou a gerar 20:07 — e a interface
// mostra "gerando" o tempo todo. Com a janela, o run que está vivo pega o
// report em até INTERVALO segundos, e o próprio workflow se re-dispara ao
// terminar (ver report-queue.yml), então sempre há um worker acordado.
const JANELA_SEGUNDOS = Number(process.env.FILA_JANELA_SEGUNDOS ?? 240);
const INTERVALO_SEGUNDOS = Number(process.env.FILA_INTERVALO_SEGUNDOS ?? 15);

const dormir = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

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

  const fim = Date.now() + JANELA_SEGUNDOS * 1000;
  let gerados = 0;
  let falhas = 0;
  let voltas = 0;

  console.log(
    `[FILA] Vigiando a fila por ${JANELA_SEGUNDOS}s (consulta a cada ${INTERVALO_SEGUNDOS}s).`
  );

  // O laço não interrompe um report no meio: se a janela vence enquanto um
  // report gera, ele termina e só então o worker sai. O timeout do job tem
  // folga pra isso.
  do {
    voltas++;
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
      if (Date.now() < fim) await dormir(INTERVALO_SEGUNDOS);
      continue;
    }

    console.log(`[FILA] ${fila.length} report(s) pendente(s) (volta ${voltas}).`);
    const resultado = processarLote(fila);
    gerados += resultado.ok;
    falhas += resultado.falhas;
  } while (Date.now() < fim);

  console.log(
    `\n[FILA] Janela encerrada: ${gerados} ok, ${falhas} com falha, ${voltas} consulta(s).`
  );

  // Job vermelho quando algo falhou — a varredura de manutenção lê execuções
  // falhas do Actions e te avisa. Silêncio só quando foi tudo bem.
  if (falhas) process.exitCode = 1;
}

type ItemFila = {
  slug: string;
  cliente: string | null;
  briefing: unknown;
  created_at: string;
};

function processarLote(fila: ItemFila[]): { ok: number; falhas: number } {
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

  return { ok: fila.length - falhas, falhas };
}

main().catch((err) => {
  console.error(
    "[FILA] Erro fatal no worker:",
    err instanceof Error ? err.message : String(err)
  );
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exitCode = 1;
});

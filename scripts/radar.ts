import WebSocket from "ws";
import { runAllActiveRadars } from "../lib/radar/runRadar";

// O @supabase/supabase-js quebra na criação do client quando o runtime não
// expõe um WebSocket global (depende da build exata do Node no runner do
// GitHub Actions), mesmo sem usarmos Realtime. O runRadar cria o próprio client
// internamente, então não dá pra injetar o transporte lá como no gerador de
// report — em vez disso garantimos o global aqui antes de qualquer chamada.
if (!(globalThis as { WebSocket?: unknown }).WebSocket) {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket as unknown;
}

// runRadar lê NEXT_PUBLIC_SUPABASE_URL (nome do ambiente Next/Vercel). No runner
// o secret canônico é SUPABASE_URL (igual ao workflow do report) — mapeamos aqui
// pra não precisar duplicar secret nem tocar no lib compartilhado.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
}

async function main() {
  const required = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    APIFY_TOKEN: process.env.APIFY_TOKEN,
    VOYAGE_API_KEY: process.env.VOYAGE_API_KEY,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `Envs obrigatórias ausentes (verifique os secrets do repositório): ${missing.join(", ")}`
    );
  }

  console.log("[RADAR] Iniciando varredura no runner. Node =", process.version);
  await runAllActiveRadars();
  console.log("[RADAR] Varredura concluída.");
}

main().catch((err) => {
  console.error(
    "[RADAR] Erro fatal na varredura:",
    err instanceof Error ? err.message : String(err)
  );
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exitCode = 1;
});

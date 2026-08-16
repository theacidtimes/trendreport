import WebSocket from "ws";
import { rodarVarredura } from "../lib/manutencao/varredura";

// Mesmo motivo do scripts/radar.ts: o @supabase/supabase-js quebra na criação do
// client quando o runtime não expõe WebSocket global, dependendo da build do Node
// no runner. Garantimos o global antes de qualquer chamada.
if (!(globalThis as { WebSocket?: unknown }).WebSocket) {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket as unknown;
}

// lib lê NEXT_PUBLIC_SUPABASE_URL (nome do ambiente Next/Vercel); no runner o
// secret canônico é SUPABASE_URL. Mesmo mapeamento do radar.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
}

// Janela padrão de 26h. Como a varredura virou manual, ajuste via env quando
// quiser olhar mais pra trás: MANUTENCAO_JANELA_HORAS=168 npm run manutencao
// varre a semana inteira.
const JANELA_HORAS = Number(process.env.MANUTENCAO_JANELA_HORAS ?? 26);

// --dry-run: varre e imprime os achados crus, sem chamar o Claude. Zero custo,
// útil quando você só quer saber SE tem algo, não o diagnóstico.
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const required = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ...(dryRun ? {} : { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }),
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `Envs obrigatórias ausentes (verifique os secrets do repositório): ${missing.join(", ")}`
    );
  }

  console.log(
    `[MANUTENCAO] Varrendo últimas ${JANELA_HORAS}h${dryRun ? " (dry-run)" : ""}.`
  );

  if (dryRun) {
    const { coletarAchados } = await import("../lib/manutencao/varredura");
    const achados = await coletarAchados(JANELA_HORAS);
    if (!achados.length) {
      console.log("[MANUTENCAO] Nada encontrado.");
      return;
    }
    for (const a of achados) {
      console.log(`\n[${a.severidade}] ${a.fonte}: ${a.resumo}`);
      console.log(JSON.stringify(a.dados, null, 2));
    }
    return;
  }

  await rodarVarredura(JANELA_HORAS);
}

main().catch((err) => {
  console.error(
    "[MANUTENCAO] Erro fatal na varredura:",
    err instanceof Error ? err.message : String(err)
  );
  if (err instanceof Error && err.stack) console.error(err.stack);
  // Sai com erro pro job ficar vermelho no Actions. A varredura que vigia o
  // sistema também precisa ser vigiada — se ela morrer calada, você volta a não
  // saber de nada, que é exatamente o problema que ela veio resolver.
  process.exitCode = 1;
});

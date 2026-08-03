import { createClient } from "@supabase/supabase-js";
import { registrarCustos, type RegistroCusto } from "../lib/custos";

// Importa o histórico de custo da Apify e atribui a tenant/marca.
//
// Sem isto o painel de custo nasceria zerado e só teria valor daqui a um mês.
// O dinheiro já foi gasto e a Apify já sabe quanto: cada run guarda seu
// usageTotalUsd. E `radar_scrape_jobs.apify_run_id` liga run -> marca -> tenant.
// Então o passado inteiro é reconstruível — só nunca tinha sido lido.
//
// Run que NÃO está em radar_scrape_jobs é gasto real que existe na fatura e não
// dá pra atribuir: reports (o endpoint síncrono usado em lib/apify.ts não
// devolve run id — confirmado na doc, só manda headers de paginação) e sondagens
// manuais. Esses entram como origem 'desconhecido' com tenant null, em vez de
// serem descartados. Assim o total da tela reconcilia com a fatura, e o tamanho
// do balde "não atribuído" vira a métrica de quanto ainda falta instrumentar.
//
// Idempotente pelo unique (provedor, ref): rodar de novo não duplica.
//
//   npx tsx scripts/backfill-custos.ts [--dias=60] [--dry]

const APIFY_BASE = "https://api.apify.com/v2";

type ApifyRun = {
  id: string;
  actId: string;
  status: string;
  startedAt: string;
  usageTotalUsd?: number;
};

async function listarRuns(token: string, desde: Date): Promise<ApifyRun[]> {
  // A listagem vem em ordem crescente por padrão; desc=1 traz os recentes
  // primeiro, então dá pra parar assim que passar da janela.
  const out: ApifyRun[] = [];
  const limit = 1000;
  for (let offset = 0; ; offset += limit) {
    const res = await fetch(
      `${APIFY_BASE}/actor-runs?token=${token}&limit=${limit}&offset=${offset}&desc=1`
    );
    if (!res.ok) throw new Error(`Apify HTTP ${res.status}: ${await res.text()}`);
    const items: ApifyRun[] = (await res.json())?.data?.items ?? [];
    if (!items.length) break;
    out.push(...items);
    const ultimo = items[items.length - 1]?.startedAt;
    if (ultimo && new Date(ultimo) < desde) break;
    if (items.length < limit) break;
  }
  return out.filter((r) => new Date(r.startedAt) >= desde);
}

async function main() {
  const arg = (n: string) =>
    process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1];
  const dias = Number(arg("dias") ?? 60);
  const dry = process.argv.includes("--dry");

  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN ausente");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const desde = new Date(Date.now() - dias * 86_400_000);
  console.log(`Janela: desde ${desde.toISOString()} (${dias} dias)`);

  const runs = await listarRuns(token, desde);
  console.log(`Apify: ${runs.length} runs na janela`);

  // Mapa run -> job do radar. Paginado: o PostgREST corta em 1000 por padrão e
  // um limite silencioso aqui viraria custo "não atribuído" fantasma.
  const jobs: {
    apify_run_id: string | null;
    marca_id: string | null;
    tenant_id: string | null;
    fonte: string | null;
    created_at: string;
  }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("radar_scrape_jobs")
      .select("apify_run_id, marca_id, tenant_id, fonte, created_at")
      .range(from, from + 999);
    if (error) throw new Error(`Supabase: ${error.message}`);
    if (!data?.length) break;
    jobs.push(...data);
    if (data.length < 1000) break;
  }
  const porRun = new Map(
    jobs.filter((j) => j.apify_run_id).map((j) => [j.apify_run_id as string, j])
  );
  console.log(`Radar: ${jobs.length} jobs (${porRun.size} com run id)`);

  const registros: RegistroCusto[] = [];
  let semCusto = 0;
  for (const run of runs) {
    if (typeof run.usageTotalUsd !== "number") {
      semCusto++;
      continue;
    }
    const job = porRun.get(run.id);
    registros.push({
      tenantId: job?.tenant_id ?? null,
      marcaId: job?.marca_id ?? null,
      origem: job ? "radar" : "desconhecido",
      provedor: "apify",
      detalhe: job?.fonte ?? run.actId,
      ref: run.id,
      custoUsd: run.usageTotalUsd,
      ocorridoEm: run.startedAt,
    });
  }

  const atribuidos = registros.filter((r) => r.tenantId);
  const soma = (rs: RegistroCusto[]) =>
    rs.reduce((s, r) => s + r.custoUsd, 0).toFixed(2);
  console.log(
    `\n${registros.length} eventos | atribuidos ${atribuidos.length} ($${soma(
      atribuidos
    )}) | nao atribuidos ${registros.length - atribuidos.length} ($${soma(
      registros.filter((r) => !r.tenantId)
    )})`
  );
  console.log(`TOTAL NA JANELA: $${soma(registros)}`);
  if (semCusto) console.log(`(${semCusto} runs sem usageTotalUsd, ignorados)`);

  if (dry) {
    console.log("\n--dry: nada gravado.");
    return;
  }

  // Em lotes: um upsert de 1000+ linhas estoura o limite de payload.
  for (let i = 0; i < registros.length; i += 500) {
    await registrarCustos(supabase, registros.slice(i, i + 500));
    console.log(`gravado ${Math.min(i + 500, registros.length)}/${registros.length}`);
  }
  console.log("Backfill concluido.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

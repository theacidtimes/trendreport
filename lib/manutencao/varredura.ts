import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { sendEmail } from "../email/send";

// Varredura de manutenção: roda no cron, olha o estado do sistema e SÓ incomoda
// quando acha algo. O desenho tem uma regra central de custo — a detecção é 100%
// SQL (de graça) e o Claude só é chamado depois que já existe achado. Em dia
// normal o job termina sem gastar um token e sem mandar e-mail; silêncio é o
// sinal de que está tudo certo.
//
// O gatilho pra isso existir foram os 6 reports órfãos da Julia (10/08/2026):
// GITHUB_DISPATCH_TOKEN expirado devolvia 401, cada tentativa deixava uma linha
// em erro e ninguém soube até alguém abrir o painel e reparar.

const MODELO_DIAGNOSTICO = "claude-sonnet-4-6";

// Radar tica a cada 15min (radar-cron.yml), mas só GRAVA em radar_runs quando
// alguma marca vence o próprio intervalo_horas — então tabela quieta é rotina,
// não falha (testado em produção: 7,6h sem linha com o cron passando bem).
// Quem diz se o cron está vivo é a execução do workflow, e é isso que medimos.
// 2h sem execução alguma é cron morto: secret expirado, ou o GitHub desabilitou
// o schedule sozinho depois de falhas seguidas.
const RADAR_PARADO_HORAS = 2;

// Report leva minutos pra gerar. Passou de 1h em "pending" e o dispatch não
// chegou no outro lado: a linha nasceu mas o GitHub Actions nunca pegou.
const REPORT_TRAVADO_MIN = 60;

export type Severidade = "erro" | "aviso";

export interface Achado {
  fonte: string;
  severidade: Severidade;
  resumo: string;
  // Contexto cru pro Claude ler. Vai inteiro no prompt, então mantenha enxuto:
  // amostra de linhas, não a tabela toda.
  dados: unknown;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── coleta ────────────────────────────────────────────────

export async function coletarAchados(janelaHoras: number): Promise<Achado[]> {
  const supabase = getSupabase();
  const desde = new Date(Date.now() - janelaHoras * 3600_000).toISOString();
  const achados: Achado[] = [];

  // 1. Reports que falharam na janela. error_message já carrega o motivo cru
  // (foi ele que entregou o "401 Bad credentials" do incidente da Julia).
  const { data: reportsErro } = await supabase
    .from("reports")
    .select("slug, cliente, status, error_message, created_at, user_id")
    .eq("status", "error")
    .gte("created_at", desde)
    .order("created_at", { ascending: false });

  if (reportsErro?.length) {
    achados.push({
      fonte: "reports",
      severidade: "erro",
      resumo: `${reportsErro.length} relatório(s) com status "error"`,
      dados: reportsErro,
    });
  }

  // 2. Reports travados em "pending". Diferente do caso acima: aqui o insert
  // funcionou e o erro não foi nem registrado — o dispatch sumiu no caminho.
  // Sem esta checagem eles ficariam invisíveis pra sempre.
  const travadoAntesDe = new Date(
    Date.now() - REPORT_TRAVADO_MIN * 60_000
  ).toISOString();
  const { data: reportsTravados } = await supabase
    .from("reports")
    .select("slug, cliente, status, created_at")
    .eq("status", "pending")
    .lt("created_at", travadoAntesDe)
    .order("created_at", { ascending: false });

  if (reportsTravados?.length) {
    achados.push({
      fonte: "reports",
      severidade: "erro",
      resumo: `${reportsTravados.length} relatório(s) presos em "pending" há mais de ${REPORT_TRAVADO_MIN}min`,
      dados: reportsTravados,
    });
  }

  // 3. Varreduras do radar que quebraram. radar_runs não tem coluna de mensagem,
  // então o "porquê" vem do log do workflow — por isso a etapa 5 existe.
  const { data: radarErro } = await supabase
    .from("radar_runs")
    .select("id, marca_id, status, created_at, sinais_captados, drops_gerados")
    .eq("status", "erro")
    .gte("created_at", desde)
    .order("created_at", { ascending: false });

  if (radarErro?.length) {
    achados.push({
      fonte: "radar_runs",
      severidade: "erro",
      resumo: `${radarErro.length} varredura(s) do radar com status "erro"`,
      dados: radarErro,
    });
  }

  // 4. Cron do radar em silêncio. Não é uma linha com erro — é a AUSÊNCIA de
  // execução, que nenhuma query por status pegaria. Falha silenciosa é a pior
  // das duas: o produto para de coletar e ninguém recebe alerta de nada.
  const ultimoTick = await ultimoTickRadar();
  if (ultimoTick !== null) {
    const horasParado = (Date.now() - ultimoTick) / 3600_000;
    if (horasParado > RADAR_PARADO_HORAS) {
      achados.push({
        fonte: "radar-cron",
        severidade: "erro",
        resumo: `Workflow do radar sem executar há ${horasParado.toFixed(1)}h (esperado: a cada 15min)`,
        dados: { ultima_execucao: new Date(ultimoTick).toISOString() },
      });
    }
  }

  // 5. Workflows do GitHub que falharam. Fecha o ciclo: o banco mostra O QUE
  // quebrou, o Actions mostra POR QUE. GITHUB_TOKEN é injetado pelo runner.
  const falhasCI = await coletarFalhasCI(janelaHoras);
  if (falhasCI.length) {
    achados.push({
      fonte: "github-actions",
      severidade: "erro",
      resumo: `${falhasCI.length} execução(ões) de workflow com falha`,
      dados: falhasCI,
    });
  }

  // 6. Varreduras sem dado nenhum. Não quebrou, mas coletar zero em toda marca
  // costuma ser token de scraper vencido se repetir.
  const { data: semDados } = await supabase
    .from("radar_runs")
    .select("id, marca_id, created_at")
    .eq("status", "sem_dados")
    .gte("created_at", desde);

  if (semDados && semDados.length >= 3) {
    achados.push({
      fonte: "radar_runs",
      severidade: "aviso",
      resumo: `${semDados.length} varredura(s) terminaram sem dados`,
      dados: semDados,
    });
  }

  return achados;
}

// Timestamp da última execução do radar-cron, em ms. null quando não dá pra
// saber (sem token, fora do runner, API fora do ar) — e aí a checagem 4 se cala
// em vez de chutar que está parado, que geraria alarme falso todo dia.
async function ultimoTickRadar(): Promise<number | null> {
  const runs = await listarRuns(200);
  if (!runs) return null;

  const ticks = runs
    .filter((r) => r.path?.endsWith("radar-cron.yml"))
    .map((r) => Date.parse(r.created_at));

  return ticks.length ? Math.max(...ticks) : null;
}

interface FalhaCI {
  workflow: string;
  conclusao: string;
  criado_em: string;
  url: string;
}

interface RunCI {
  name: string;
  path?: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
}

// Uma chamada só, reaproveitada pelas checagens 4 e 5. GITHUB_TOKEN é injetado
// pelo runner; fora dele (rodando na mão) simplesmente não há dado de CI.
// Devolve null pra "não sei" e [] pra "sei, e não tem nada" — a diferença é o
// que impede a checagem 4 de acusar cron morto quando na verdade faltou token.
let _runsCache: RunCI[] | null | undefined;

async function listarRuns(limite: number): Promise<RunCI[] | null> {
  if (_runsCache !== undefined) return _runsCache;

  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return (_runsCache = null);

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/runs?per_page=${limite}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    if (!res.ok) return (_runsCache = null);

    const json = (await res.json()) as { workflow_runs?: RunCI[] };
    return (_runsCache = json.workflow_runs ?? []);
  } catch {
    // A varredura não pode morrer porque a API do GitHub tossiu — o achado do
    // banco ainda vale e-mail. Falha aqui só custa a seção de CI do relatório.
    return (_runsCache = null);
  }
}

async function coletarFalhasCI(janelaHoras: number): Promise<FalhaCI[]> {
  const runs = await listarRuns(200);
  if (!runs) return [];

  const desdeMs = Date.now() - janelaHoras * 3600_000;

  return runs
    .filter(
      (r) =>
        (r.conclusion === "failure" || r.conclusion === "timed_out") &&
        Date.parse(r.created_at) >= desdeMs
    )
    .map((r) => ({
      workflow: r.name,
      conclusao: r.conclusion!,
      criado_em: r.created_at,
      url: r.html_url,
    }));
}

// ── diagnóstico ───────────────────────────────────────────

export async function diagnosticar(achados: Achado[]): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const prompt = `Você é o engenheiro de plantão do TrendReport (Next.js + Supabase + GitHub Actions).
A varredura automática de manutenção encontrou os problemas abaixo nas últimas horas.

Contexto da arquitetura:
- /api/generate cria a linha em "reports" com status "pending" e SÓ DEPOIS dispara
  um repository_dispatch no GitHub. Se o dispatch falhar, sobra linha órfã.
- O radar roda no workflow radar-cron a cada 15min e grava em "radar_runs".
- Secrets usados: GITHUB_DISPATCH_TOKEN, ANTHROPIC_API_KEY, APIFY_TOKEN,
  VOYAGE_API_KEY, SUPABASE_SERVICE_ROLE_KEY.

ACHADOS (JSON):
${JSON.stringify(achados, null, 2)}

Escreva um diagnóstico curto e direto, em português do Brasil, com:
1. O que quebrou, em uma frase.
2. Causa mais provável, com a evidência que sustenta.
3. A correção concreta (comando, secret a renovar, ou arquivo a mexer).
4. Se for seguro ignorar, diga isso claramente.

Não invente causas que os dados não sustentam — se não der pra saber, diga o que
precisa ser verificado manualmente. Responda em HTML simples (só <p>, <ul>, <li>,
<strong>, <code>), sem <html> ou <body>, sem markdown, sem preâmbulo.`;

  const res = await anthropic.messages.create({
    model: MODELO_DIAGNOSTICO,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const bloco = res.content.find((c) => c.type === "text");
  return bloco && bloco.type === "text"
    ? bloco.text
    : "<p>Não foi possível gerar o diagnóstico.</p>";
}

// ── e-mail ────────────────────────────────────────────────

function montarHtml(achados: Achado[], diagnostico: string): string {
  const erros = achados.filter((a) => a.severidade === "erro").length;
  const avisos = achados.length - erros;

  const lista = achados
    .map(
      (a) =>
        `<li><strong>${a.severidade === "erro" ? "🔴" : "🟡"} ${a.fonte}</strong> — ${a.resumo}</li>`
    )
    .join("");

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:640px;color:#1a1a1a;line-height:1.6">
  <h2 style="margin:0 0 4px">Manutenção TrendReport</h2>
  <p style="margin:0 0 20px;color:#666;font-size:14px">
    ${erros} erro(s)${avisos ? ` e ${avisos} aviso(s)` : ""} —
    ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
  </p>

  <h3 style="margin:0 0 8px;font-size:15px">O que foi encontrado</h3>
  <ul style="margin:0 0 24px;padding-left:20px">${lista}</ul>

  <h3 style="margin:0 0 8px;font-size:15px">Diagnóstico</h3>
  <div style="background:#f6f6f6;border-radius:8px;padding:16px">${diagnostico}</div>

  <p style="margin:24px 0 0;color:#999;font-size:12px">
    Enviado automaticamente por <code>manutencao.yml</code>. Nenhum e-mail é
    disparado quando a varredura não encontra nada.
  </p>
</div>`;
}

export async function rodarVarredura(janelaHoras: number, destinatario: string) {
  const achados = await coletarAchados(janelaHoras);

  if (!achados.length) {
    console.log("[MANUTENCAO] Nada encontrado. Nenhum e-mail enviado.");
    return { achados: 0, enviado: false };
  }

  console.log(`[MANUTENCAO] ${achados.length} achado(s):`);
  for (const a of achados) console.log(`  - [${a.severidade}] ${a.fonte}: ${a.resumo}`);

  const diagnostico = await diagnosticar(achados);
  const erros = achados.filter((a) => a.severidade === "erro").length;

  await sendEmail({
    to: destinatario,
    subject: `[TrendReport] ${erros ? `${erros} erro(s)` : "avisos"} na manutenção diária`,
    html: montarHtml(achados, diagnostico),
  });

  console.log(`[MANUTENCAO] Relatório enviado para ${destinatario}.`);
  return { achados: achados.length, enviado: true };
}

// Registro de CUSTO REAL (US$) por tenant — o que sai do cartão da ACID.
//
// Complementa o creditos_ledger, não substitui. O ledger conta unidades de
// trabalho (1 varredura = 1 crédito); isto aqui diz quanto aquela unidade
// custou de verdade. Enquanto o cliente pagava o próprio Apify os dois eram
// intercambiáveis; com o cartão corporativo bancando todo mundo, a diferença
// entre os dois É a margem.
//
// Escrita sempre por upsert com ignoreDuplicates sobre o unique (provedor, ref):
// o poll do radar revisita o mesmo job e o backfill roda de novo sobre a mesma
// janela. A idempotência é do banco, não da disciplina de quem chama.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

export type RegistroCusto = {
  tenantId?: string | null;
  marcaId?: string | null;
  origem: "radar" | "report" | "desconhecido";
  provedor: "apify" | "anthropic";
  /** fonte do scrape quando apify; modelo quando anthropic. */
  detalhe?: string | null;
  /** chave natural no fornecedor — run id da Apify, ou `radar_run:<uuid>`. */
  ref: string;
  custoUsd: number;
  tokensIn?: number;
  tokensOut?: number;
  /** quando o custo aconteceu no fornecedor (não quando registramos). */
  ocorridoEm?: string;
};

export async function registrarCustos(
  supabase: SupabaseLike,
  registros: RegistroCusto[]
): Promise<void> {
  if (!registros.length) return;
  const rows = registros.map((r) => ({
    tenant_id: r.tenantId ?? null,
    marca_id: r.marcaId ?? null,
    origem: r.origem,
    provedor: r.provedor,
    detalhe: r.detalhe ?? null,
    ref: r.ref,
    custo_usd: r.custoUsd,
    tokens_in: r.tokensIn ?? null,
    tokens_out: r.tokensOut ?? null,
    ocorrido_em: r.ocorridoEm ?? new Date().toISOString(),
  }));

  // Mesmo motivo do débito de crédito: supabase-js resolve com { error } em vez
  // de rejeitar. Sem ler o error, o custo simplesmente não seria contabilizado
  // e a tela de custo mentiria pra baixo — o pior tipo de erro num painel
  // financeiro, porque parece que está tudo barato.
  const { error } = await supabase
    .from("custos_uso")
    .upsert(rows, { onConflict: "provedor,ref", ignoreDuplicates: true });
  if (error) {
    console.error(
      `[CUSTO] FALHA AO REGISTRAR ${rows.length} evento(s) de custo — ` +
        `o painel vai subestimar o gasto: ${error.message}`
    );
  }
}

// ── Preço do Anthropic ────────────────────────────────────────────────────
// US$ por 1M de tokens. TABELA MANUAL: a API não devolve preço, só tokens.
// Se a Anthropic mexer no preço ou entrar um modelo novo, é aqui que atualiza.
// Modelo desconhecido NÃO é tratado como grátis — ver custoAnthropic.
const PRECO_POR_MTOK: Record<
  string,
  { in: number; out: number; cacheWrite: number; cacheRead: number }
> = {
  "claude-sonnet-4-6": { in: 3, out: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  "claude-haiku-4-5": { in: 1, out: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

export type UsoAnthropic = {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/**
 * Converte o `usage` de uma resposta do Anthropic em US$.
 * Modelo fora da tabela devolve null (e não 0): zero seria uma mentira barata
 * que some no total, null obriga quem chama a decidir o que fazer.
 */
export function custoAnthropic(
  modelo: string,
  uso: UsoAnthropic | undefined
): number | null {
  if (!uso) return null;
  // Prefixo: a API devolve o id datado ("claude-haiku-4-5-20251001") mas o
  // código chama pelo alias. Casar por prefixo cobre os dois.
  const chave = Object.keys(PRECO_POR_MTOK).find((k) => modelo.startsWith(k));
  if (!chave) return null;
  const p = PRECO_POR_MTOK[chave];
  const M = 1_000_000;
  return (
    ((uso.input_tokens ?? 0) * p.in +
      (uso.output_tokens ?? 0) * p.out +
      (uso.cache_creation_input_tokens ?? 0) * p.cacheWrite +
      (uso.cache_read_input_tokens ?? 0) * p.cacheRead) /
    M
  );
}

import { custoAnthropic } from "../lib/custos";

// custoAnthropic é a única parte do metering de custo com aritmética própria: a
// Apify devolve o dólar pronto, mas a Anthropic devolve só tokens e o preço mora
// numa tabela manual aqui no repo. Erro aqui não levanta exceção — só faz o
// painel financeiro mentir, que é o pior jeito de errar num painel financeiro.

let falhas = 0;
const check = (nome: string, ok: boolean, extra?: unknown) => {
  if (!ok) falhas++;
  console.log(`${ok ? "PASS" : "FALHA"}  ${nome}`);
  if (!ok) console.log("   ", JSON.stringify(extra));
};
const perto = (a: number | null, b: number) =>
  a !== null && Math.abs(a - b) < 1e-9;

// ── preço base ────────────────────────────────────────────
// Sonnet 4.6: $3/Mtok in, $15/Mtok out.
check(
  "sonnet cobra input e output no preco de tabela",
  perto(
    custoAnthropic("claude-sonnet-4-6", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    }),
    18
  ),
  custoAnthropic("claude-sonnet-4-6", {
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
  })
);

// Haiku 4.5: $1/Mtok in, $5/Mtok out. Modelo diferente, preço diferente — se os
// dois derem o mesmo valor, a tabela está sendo ignorada.
check(
  "haiku custa menos que sonnet no mesmo volume",
  custoAnthropic("claude-haiku-4-5", {
    input_tokens: 1_000_000,
    output_tokens: 1_000_000,
  })! <
    custoAnthropic("claude-sonnet-4-6", {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    })!
);

// ── id datado ─────────────────────────────────────────────
// O código chama pelo alias ("claude-haiku-4-5") mas a API responde com o id
// datado ("claude-haiku-4-5-20251001"). Se o match fosse exato, todo custo real
// cairia no ramo "modelo desconhecido" e sumiria do painel.
check(
  "id datado da API casa com a tabela",
  perto(
    custoAnthropic("claude-haiku-4-5-20251001", { input_tokens: 1_000_000 }),
    1
  ),
  custoAnthropic("claude-haiku-4-5-20251001", { input_tokens: 1_000_000 })
);

// ── cache ─────────────────────────────────────────────────
// Token de cache tem preço próprio e NÃO entra em input_tokens. Ignorá-lo
// subestimaria a conta silenciosamente.
check(
  "leitura de cache e cobrada (mais barata que input normal)",
  perto(
    custoAnthropic("claude-sonnet-4-6", { cache_read_input_tokens: 1_000_000 }),
    0.3
  )
);
check(
  "escrita de cache e cobrada (mais cara que input normal)",
  perto(
    custoAnthropic("claude-sonnet-4-6", {
      cache_creation_input_tokens: 1_000_000,
    }),
    3.75
  )
);

// ── desconhecido: null, nunca zero ────────────────────────
// Zero somaria no total e o painel diria "saiu de graça". null obriga quem
// chama a logar o buraco (é o que runRadar faz).
check(
  "modelo fora da tabela devolve null",
  custoAnthropic("gpt-hipotetico-9", { input_tokens: 1_000_000 }) === null
);
check("usage ausente devolve null", custoAnthropic("claude-sonnet-4-6", undefined) === null);

// ── campos ausentes ───────────────────────────────────────
check(
  "usage vazio custa zero, nao NaN",
  perto(custoAnthropic("claude-sonnet-4-6", {}), 0),
  custoAnthropic("claude-sonnet-4-6", {})
);
check(
  "cache nulo nao vira NaN",
  perto(
    custoAnthropic("claude-sonnet-4-6", {
      input_tokens: 1000,
      cache_read_input_tokens: null,
      cache_creation_input_tokens: null,
    }),
    0.003
  ),
  custoAnthropic("claude-sonnet-4-6", {
    input_tokens: 1000,
    cache_read_input_tokens: null,
    cache_creation_input_tokens: null,
  })
);

// ── ordem de grandeza ─────────────────────────────────────
// Uma varredura real de radar gira em ~40k in / ~3k out. Se isso der centavos de
// dólar a mais ou a menos, a projeção mensal do console fica irreconhecível.
const varredura = custoAnthropic("claude-sonnet-4-6", {
  input_tokens: 40_000,
  output_tokens: 3_000,
})!;
check(
  "varredura tipica fica na casa de centavos (0,10-0,20)",
  varredura > 0.1 && varredura < 0.2,
  varredura
);

console.log(
  falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falhou.`
);
process.exit(falhas === 0 ? 0 : 1);

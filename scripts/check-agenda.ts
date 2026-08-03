import {
  normalizarDominio,
  normalizarLinha,
  estadoDaLinha,
  PESO_MIN,
  PESO_MAX,
  type EntradaLinha,
} from "../lib/radar/agendaLinha";
import { selectAgenda } from "../lib/radar/planner";
import type { Marca, PulsoCultural } from "../lib/types";

// A CURADORIA da agenda cultural — a tela por onde um domínio novo entra no
// sistema.
//
// Todo erro possível aqui é o mesmo erro: uma linha que o Postgres aceita, que
// aparece na tela parecendo configurada, e que `selectAgenda` filtra a zero para
// sempre. Nenhum deles levanta exceção. O sintoma chega semanas depois como "o
// radar não viu o assunto", e a investigação começa do lado errado — no scraper,
// no modelo, no prompt — porque a config PARECE certa na tela.
//
// Por isso os asserts abaixo não param na validação: vários fecham o circuito
// com o `selectAgenda` de verdade. Validar que a função devolve `ok: false` prova
// que ela recusa; só o `selectAgenda` prova que o que ela ACEITA de fato casa.

let falhas = 0;
const check = (nome: string, ok: boolean, extra?: unknown) => {
  if (!ok) falhas++;
  console.log(`${ok ? "PASS" : "FALHA"}  ${nome}`);
  if (!ok) console.log("   ", JSON.stringify(extra));
};

const base: EntradaLinha = {
  dominio: "saude",
  titulo: "Outubro Rosa",
  termos: ["outubro rosa", "câncer de mama"],
  peso: 2,
  ativo: true,
  pais: "BR",
};

const ok = (e: EntradaLinha) => {
  const v = normalizarLinha(e);
  if (!v.ok) throw new Error(`esperava ok, veio: ${v.erro}`);
  return v.linha;
};
const erro = (e: EntradaLinha) => {
  const v = normalizarLinha(e);
  return v.ok ? null : v.erro;
};

// ── normalizarDominio ─────────────────────────────────────
// `dominio` é chave de junção por igualdade EXATA de string em
// `dominios.has(a.dominio)`. Toda diferença invisível aqui — acento, maiúscula,
// espaço no fim — é um domínio novo do ponto de vista do Set.
check("acento cai", normalizarDominio("saúde") === "saude");
check("maiuscula cai", normalizarDominio("Saúde") === "saude");
check("espaco vira underscore", normalizarDominio("saude publica") === "saude_publica");
check("espaco nas pontas nao vira underscore", normalizarDominio("  saude  ") === "saude");
check("simbolo vira underscore unico", normalizarDominio("agro/safra") === "agro_safra");
check("ja normalizado nao muda", normalizarDominio("economia") === "economia");
check("so simbolo vira vazio (recusado depois)", normalizarDominio("///") === "");
check(
  "duas grafias da mesma coisa colidem no MESMO dominio",
  normalizarDominio("Saúde") === normalizarDominio(" saude ")
);

// ── o que a linha recusa ──────────────────────────────────
check("dominio vazio recusado", erro({ ...base, dominio: "" }) !== null);
check("dominio so simbolo recusado", erro({ ...base, dominio: "!!!" }) !== null);
check("titulo vazio recusado", erro({ ...base, titulo: "  " }) !== null);
check("sem termos recusado", erro({ ...base, termos: [] }) !== null);
check("termo de 1 caractere nao conta", erro({ ...base, termos: ["a"] }) !== null);
check("termos so com espaco recusado", erro({ ...base, termos: ["  ", ""] }) !== null);

// Formato de data: o planner compara janela com `now.toISOString().slice(0,10)`
// como STRING. '2026-8-5' não quebra nada — só passa a ser MAIOR que '2026-08-03'
// na ordem lexicográfica, e a linha fica vigente no ano errado, calada.
check("data sem zero a esquerda recusada", erro({ ...base, janela_inicio: "2026-8-5" }) !== null);
check("data em formato BR recusada", erro({ ...base, janela_inicio: "05/08/2026" }) !== null);
check("data inexistente recusada (regex sozinha aceitaria)", erro({ ...base, janela_fim: "2026-02-31" }) !== null);
check("ano bissexto valido aceito", erro({ ...base, janela_fim: "2028-02-29" }) === null);
check(
  "janela invertida recusada (nunca seria vigente)",
  erro({ ...base, janela_inicio: "2026-12-01", janela_fim: "2026-01-01" }) !== null
);
check(
  "janela de um dia so aceita",
  erro({ ...base, janela_inicio: "2026-10-01", janela_fim: "2026-10-01" }) === null
);

check("peso abaixo do minimo recusado", erro({ ...base, peso: PESO_MIN - 1 }) !== null);
check("peso acima do maximo recusado", erro({ ...base, peso: PESO_MAX + 1 }) !== null);
check("peso NaN recusado", erro({ ...base, peso: Number.NaN }) !== null);
check("pais de 3 letras recusado", erro({ ...base, pais: "BRA" }) !== null);
check("pais com numero recusado", erro({ ...base, pais: "B1" }) !== null);

// ── o que a linha conserta ────────────────────────────────
check("dominio e normalizado na GRAVACAO, nao so na tela", ok({ ...base, dominio: "Saúde Pública" }).dominio === "saude_publica");
check("titulo e aparado", ok({ ...base, titulo: "  Outubro Rosa  " }).titulo === "Outubro Rosa");
check("termo repetido nao vira duas lanes", ok({ ...base, termos: ["mamografia", "mamografia"] }).termos.length === 1);
check("termo e aparado antes de deduplicar", ok({ ...base, termos: ["mamografia", " mamografia "] }).termos.length === 1);
check("termo vazio e descartado sem recusar a linha", ok({ ...base, termos: ["mamografia", ""] }).termos.length === 1);
check("pais vira maiusculo", ok({ ...base, pais: "br" }).pais === "BR");
// '' e null se comportam igual em `selectAgenda` (`!a.pais`), mas só null LÊ como
// "universal" e só null entra no índice parcial.
check("pais vazio vira null (universal), nao string vazia", ok({ ...base, pais: "" }).pais === null);
check("pais so-espaco vira null", ok({ ...base, pais: "   " }).pais === null);
check("tenant vazio vira null (global)", ok({ ...base, tenant_id: "" }).tenant_id === null);
check("janela vazia vira null, nao string vazia", ok({ ...base, janela_inicio: "", janela_fim: "" }).janela_inicio === null);
check("peso decimal e arredondado", ok({ ...base, peso: 2.4 }).peso === 2);
check("ativo ausente vira false, nao undefined", ok({ ...base, ativo: undefined as unknown as boolean }).ativo === false);

// ── estadoDaLinha ─────────────────────────────────────────
// `ativo` é intenção, isto é efeito. A tela precisa da diferença: uma lista de
// "25 linhas ativas" onde 6 estão fora de janela mente sobre quantas rodam.
const hoje = new Date("2026-08-03T12:00:00Z");
const linha = (p: Partial<PulsoCultural>): PulsoCultural =>
  ({ id: "x", tenant_id: null, dominio: "saude", titulo: "t", termos: ["a"],
     janela_inicio: null, janela_fim: null, peso: 2, ativo: true, origem: "c",
     created_at: "", pais: "BR", ...p }) as PulsoCultural;

check("perene ativa e vigente", estadoDaLinha(linha({}), hoje) === "vigente");
check("desligada e desligada mesmo dentro da janela", estadoDaLinha(linha({ ativo: false }), hoje) === "desligada");
check("janela no futuro e futura", estadoDaLinha(linha({ janela_inicio: "2026-10-01" }), hoje) === "futura");
check("janela no passado e encerrada", estadoDaLinha(linha({ janela_fim: "2026-07-31" }), hoje) === "encerrada");
// As bordas são o dia inteiro: o planner usa <= e >=. Um erro de um dia aqui
// apaga a estreia ou a véspera — exatamente os dias que importam.
check("primeiro dia da janela ja e vigente", estadoDaLinha(linha({ janela_inicio: "2026-08-03" }), hoje) === "vigente");
check("ultimo dia da janela ainda e vigente", estadoDaLinha(linha({ janela_fim: "2026-08-03" }), hoje) === "vigente");
check("desligada vence encerrada (intencao antes do efeito)", estadoDaLinha(linha({ ativo: false, janela_fim: "2020-01-01" }), hoje) === "desligada");

// ── o circuito fechado com o planner ──────────────────────
// Aqui é onde os asserts deixam de ser sobre a função e passam a ser sobre o
// PRODUTO: a linha que a tela aceitou de fato chega na varredura da marca.
const marca = (dominios: string[], pais = "BR"): Marca =>
  ({ id: "m", nome: "Teste", tenant_id: null, status_varredura: true,
     intervalo_horas: 24, ultima_varredura: null, created_at: "",
     yaml_conhecimento: { marca: "Teste", dominios_culturais: dominios, peso_cultural: 0.5, pais } }) as Marca;

const salva = ok({ ...base, dominio: "Saúde Pública" });
const comoNoBanco = linha({ ...salva });

check(
  "linha salva CASA com a marca que assina o dominio normalizado",
  selectAgenda(marca(["saude_publica"]), [comoNoBanco], hoje).length === 1
);
// O outro lado da mesma moeda — e a razão de a normalização ser obrigatória na
// escrita e não uma sugestão da tela.
check(
  "a grafia crua NAO casaria (por isso normalizar e obrigatorio)",
  selectAgenda(marca(["Saúde Pública"]), [comoNoBanco], hoje).length === 0
);
check(
  "linha BR nao casa com marca AU",
  selectAgenda(marca(["saude_publica"], "AU"), [comoNoBanco], hoje).length === 0
);
check(
  "linha universal (pais null) casa com marca AU",
  selectAgenda(marca(["saude_publica"], "AU"), [linha({ ...salva, pais: null })], hoje).length === 1
);

// A tela e o planner precisam concordar sobre o que está no ar. Se divergirem, a
// lista mostra "no ar" para linha que não roda (ou o contrário) e a curadoria
// passa a ser feita contra uma tela que mente.
const casos: Partial<PulsoCultural>[] = [
  {},
  { ativo: false },
  { janela_inicio: "2026-10-01" },
  { janela_fim: "2026-07-31" },
  { janela_inicio: "2026-08-03" },
  { janela_fim: "2026-08-03" },
  { janela_inicio: "2026-01-01", janela_fim: "2026-12-31" },
];
const divergentes = casos.filter((p) => {
  const l = linha({ ...p, dominio: "saude" });
  const naTela = estadoDaLinha(l, hoje) === "vigente";
  const noPlanner = selectAgenda(marca(["saude"]), [l], hoje).length === 1;
  return naTela !== noPlanner;
});
check(`tela e planner concordam em "no ar" nos ${casos.length} casos`, divergentes.length === 0, divergentes);

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO OK");
process.exit(falhas ? 1 : 0);

import { selectAgenda, distribuirVagas, ehDatada, planLanes } from "../lib/radar/planner";
import type { PulsoCultural, Marca } from "../lib/types";

// Quem ganha as vagas da agenda cultural.
//
// Errar aqui não quebra nada: a varredura roda, gasta o mesmo, e entrega drops
// sobre o tema errado. O sintoma chega semanas depois pela gerente de social
// media ("o radar não viu o assunto da semana") — foi assim que se descobriu
// que o "Dia dos Pais" ficava de fora DURANTE o Dia dos Pais, enquanto três
// linhas perenes ocupavam as três vagas da Vivo todo santo dia.

let falhas = 0;
const check = (nome: string, ok: boolean, extra?: unknown) => {
  if (!ok) falhas++;
  console.log(`${ok ? "PASS" : "FALHA"}  ${nome}`);
  if (!ok) console.log("   ", JSON.stringify(extra));
};

let seq = 0;
const linha = (
  titulo: string,
  dominio: string,
  peso: number,
  janela?: [string | null, string | null]
): PulsoCultural => ({
  id: `id-${seq++}`,
  tenant_id: null,
  dominio,
  titulo,
  termos: [`${titulo} a`, `${titulo} b`, `${titulo} c`],
  janela_inicio: janela?.[0] ?? null,
  janela_fim: janela?.[1] ?? null,
  peso,
  ativo: true,
  origem: "global",
  created_at: "2026-01-01T00:00:00.000Z"
});

const nomes = (xs: PulsoCultural[]) => xs.map((a) => a.titulo).join(",");

// ── datada vs perene ──────────────────────────────────────
check("linha sem janela e perene", !ehDatada(linha("Brasileirao", "esporte", 3)));
check(
  "linha com inicio e fim e datada",
  ehDatada(linha("Rock in Rio", "musica", 3, ["2026-08-25", "2026-09-14"]))
);
// Janela pela metade ainda é compromisso com uma data — tratar como perene
// devolveria a linha ao pote dos posseiros.
check("so janela_inicio ja e datada", ehDatada(linha("X", "massa", 2, ["2026-08-01", null])));
check("so janela_fim ja e datada", ehDatada(linha("Y", "massa", 2, [null, "2026-08-09"])));

// ── o caso real da Vivo, 01/08/2026 ───────────────────────
const perenes3 = [
  linha("Lancamentos de streaming", "entretenimento", 3),
  linha("Brasileirao", "esporte", 3),
  linha("Comportamento nas redes", "massa", 3)
];
const diaDosPais = linha("Dia dos Pais", "massa", 2, ["2026-07-27", "2026-08-09"]);
const vivoHoje = [...perenes3, linha("Final de novela", "entretenimento", 2), diaDosPais];

// Regressão: com o peso puro, as três perenes 3 varriam a mesa.
const pesoPuro = [...vivoHoje].sort((x, y) => y.peso - x.peso).slice(0, 3);
check(
  "REGRESSAO: ordenar so por peso deixava o Dia dos Pais de fora",
  !pesoPuro.includes(diaDosPais),
  nomes(pesoPuro)
);

const com3 = distribuirVagas(vivoHoje, 3);
check("com 3 vagas a data vigente entra", com3.includes(diaDosPais), nomes(com3));
check("com 3 vagas ainda entram 2 perenes", com3.filter((a) => !ehDatada(a)).length === 2, nomes(com3));
check("nao estoura o numero de vagas", com3.length === 3, nomes(com3));

// Com 4 vagas (o peso_cultural 0,67 combinado com o usuário) o pescador
// genérico de trend sobrevive junto com a data.
const com4 = distribuirVagas(vivoHoje, 4);
check("com 4 vagas a data entra E as 3 perenes peso 3 ficam", com4.length === 4, nomes(com4));
check(
  "com 4 vagas o pescador de trend sobrevive",
  com4.some((a) => a.titulo === "Comportamento nas redes"),
  nomes(com4)
);

// ── teto das datadas ──────────────────────────────────────
// Novembro real: GP de SP e Black Friday vigentes ao mesmo tempo, ambas peso 3.
const novembro = [
  ...perenes3,
  linha("GP de Sao Paulo F1", "esporte", 3, ["2026-10-30", "2026-11-08"]),
  linha("Black Friday", "massa", 3, ["2026-11-15", "2026-11-30"]),
  linha("Natal e Reveillon", "massa", 3, ["2026-12-10", "2027-01-02"])
];
const nov4 = distribuirVagas(novembro, 4);
check(
  "datadas nao tomam mais que metade das vagas",
  nov4.filter(ehDatada).length === 2,
  nomes(nov4)
);
check("a outra metade fica com as perenes", nov4.filter((a) => !ehDatada(a)).length === 2, nomes(nov4));
// Metade de 3 arredonda PRA BAIXO. Com 3 vagas e duas datas concorrentes, uma
// entra e as perenes ficam com duas — arredondar pra cima daria a maioria da
// mesa às datas comemorativas, que é o cego oposto ao que se está corrigindo.
const nov3 = distribuirVagas(novembro, 3);
check("com 3 vagas e 3 datadas, so UMA datada entra", nov3.filter(ehDatada).length === 1, nomes(nov3));
check("com 3 vagas as perenes ficam com duas", nov3.filter((a) => !ehDatada(a)).length === 2, nomes(nov3));
// Uma vaga só: a data vigente vale mais que o tema de sempre.
check(
  "com 1 vaga a data vigente ganha (teto minimo 1)",
  distribuirVagas(vivoHoje, 1)[0] === diaDosPais,
  nomes(distribuirVagas(vivoHoje, 1))
);

// ── vaga nunca fica vazia ─────────────────────────────────
// O teto protege a perene; não pode virar desperdício quando não há perene.
const soDatadas = [
  linha("A", "massa", 3, ["2026-01-01", "2026-12-31"]),
  linha("B", "massa", 2, ["2026-01-01", "2026-12-31"]),
  linha("C", "massa", 1, ["2026-01-01", "2026-12-31"])
];
check("sem perene, as datadas preenchem tudo", distribuirVagas(soDatadas, 3).length === 3);
check(
  "sem perene, a datada extra entra por peso (nao por acaso)",
  nomes(distribuirVagas(soDatadas, 3)) === "A,B,C",
  nomes(distribuirVagas(soDatadas, 3))
);
check("sem datada, as perenes preenchem tudo", distribuirVagas(perenes3, 3).length === 3);
check("menos linhas que vagas devolve o que ha", distribuirVagas(perenes3, 10).length === 3);
check("zero vaga devolve vazio", distribuirVagas(vivoHoje, 0).length === 0);
check("vaga negativa nao quebra", distribuirVagas(vivoHoje, -1).length === 0);
check("agenda vazia nao quebra", distribuirVagas([], 3).length === 0);
check("nenhuma linha aparece duas vezes", new Set(com4.map((a) => a.id)).size === com4.length);

// ── desempate estável ─────────────────────────────────────
// A query que carrega a agenda não tem ORDER BY: antes, quatro linhas peso 3
// disputando três vagas davam resultado diferente a cada varredura.
const embaralhado = [...perenes3].reverse();
check(
  "mesma agenda em outra ordem devolve a mesma escolha",
  nomes(distribuirVagas(perenes3, 2)) === nomes(distribuirVagas(embaralhado, 2)),
  [nomes(distribuirVagas(perenes3, 2)), nomes(distribuirVagas(embaralhado, 2))]
);
check(
  "NAO reordena o array recebido",
  nomes(embaralhado) === "Comportamento nas redes,Brasileirao,Lancamentos de streaming",
  nomes(embaralhado)
);

// ── selectAgenda: vigência e escopo ───────────────────────
const marca = {
  id: "m1",
  tenant_id: "t1",
  nome: "Vivo",
  yaml_conhecimento: {
    marca: "Vivo",
    produto: "telecom",
    termos_culturais: ["conexao", "familia", "casa"],
    dominios_culturais: ["esporte", "entretenimento", "massa"],
    peso_cultural: 0.67
  }
} as unknown as Marca;

const hoje = new Date("2026-08-02T12:00:00Z");
const universo = [
  ...vivoHoje,
  // Domínio não assinado E SEM JANELA: nada além do filtro de domínio pode
  // cortá-la. A primeira versão deste caso usava o Rock in Rio, que é de
  // `musica` MAS começa em 25/08 — o filtro de janela já o derrubava, então a
  // asserção passava mesmo com o filtro de domínio removido. Fixture confundida
  // é assert que não existe.
  linha("Sertanejo universitario", "musica", 3),
  linha("Rock in Rio", "musica", 3, ["2026-08-25", "2026-09-14"]), // dominio nao assinado
  linha("Black Friday", "massa", 3, ["2026-11-15", "2026-11-30"]), // fora da janela
  linha("Volta as aulas", "massa", 2, ["2026-01-15", "2026-02-15"]), // janela ja passou
  { ...linha("Desativada", "massa", 3), ativo: false },
  { ...linha("De outro tenant", "massa", 3), tenant_id: "t2" }
];
const vigentes = selectAgenda(marca, universo, hoje);
check(
  "corta dominio nao assinado (mesmo perene, sem janela pra ajudar)",
  !vigentes.some((a) => a.titulo === "Sertanejo universitario"),
  nomes(vigentes)
);
check("corta dominio nao assinado", !vigentes.some((a) => a.titulo === "Rock in Rio"), nomes(vigentes));
check("corta janela futura", !vigentes.some((a) => a.titulo === "Black Friday"), nomes(vigentes));
check("corta janela vencida", !vigentes.some((a) => a.titulo === "Volta as aulas"), nomes(vigentes));
check("corta linha inativa", !vigentes.some((a) => a.titulo === "Desativada"), nomes(vigentes));
check("corta linha de outro tenant", !vigentes.some((a) => a.titulo === "De outro tenant"), nomes(vigentes));
check("mantem a data vigente hoje", vigentes.some((a) => a.titulo === "Dia dos Pais"), nomes(vigentes));
// Limite da janela é inclusivo dos DOIS lados. O primeiro dia importa tanto
// quanto o último: uma data comemorativa é assunto justamente no dia em que
// abre, e perder a abertura é perder a única janela que ela tem.
check(
  "primeiro dia da janela JA e vigente",
  selectAgenda(marca, [diaDosPais], new Date("2026-07-27T01:00:00Z")).length === 1
);
check(
  "vespera da abertura ainda NAO e vigente",
  selectAgenda(marca, [diaDosPais], new Date("2026-07-26T23:00:00Z")).length === 0
);
check(
  "ultimo dia da janela ainda e vigente",
  selectAgenda(marca, [diaDosPais], new Date("2026-08-09T23:00:00Z")).length === 1
);
check(
  "dia seguinte ao fim ja NAO e vigente",
  selectAgenda(marca, [diaDosPais], new Date("2026-08-10T00:00:00Z")).length === 0
);
check(
  "marca sem dominios_culturais nao recebe agenda",
  selectAgenda(
    { ...marca, yaml_conhecimento: { ...marca.yaml_conhecimento, dominios_culturais: [] } } as Marca,
    universo,
    hoje
  ).length === 0
);

// ── planLanes ponta a ponta ───────────────────────────────
// peso_cultural 0.67 → round(0.67 * 6) = 4 vagas de agenda.
const lanes = planLanes(marca, universo, hoje);
const termosDasLanes = lanes.map((l) => l.keywords.join("|"));
check(
  "a data vigente vira lane de verdade",
  termosDasLanes.some((t) => t.includes("Dia dos Pais")),
  termosDasLanes
);
check(
  "cada cluster de agenda vira um trio reddit/tiktok/twitter",
  termosDasLanes.filter((t) => t.includes("Dia dos Pais")).length === 3
);
// Twitter só existe nos trios culturais; as âncoras (news/linkedin/reddit de
// marca) não usam essa fonte — é o que segura o risco do piso de engajamento.
check(
  "lane de marca nao usa twitter (o piso de faves nao afeta a ancora)",
  lanes.filter((l) => l.fonte === "twitter").every((l) => !l.keywords.includes("Vivo")),
  lanes.filter((l) => l.fonte === "twitter").map((l) => l.keywords)
);

console.log(
  falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falhou.`
);
process.exit(falhas === 0 ? 0 : 1);

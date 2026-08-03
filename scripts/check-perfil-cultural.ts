import {
  SEM_AGENDA,
  normalizarPerfil,
  buildPerfilTool,
  descreverMarca,
  vagasDoPeso
} from "../lib/radar/perfilCultural";
import { mesclarDNA, precisaDerivar } from "../lib/marcaDNA";
import { selectAgenda, paisDaMarca, diagnosticarAgenda, CAP_AGENDA_CLUSTERS } from "../lib/radar/planner";
import type { MarcaKnowledge, Marca, PulsoCultural } from "../lib/types";
import { readFileSync } from "node:fs";

// A CONFIGURAÇÃO que decide se uma marca recebe agenda cultural — e quanto paga
// por ela.
//
// Tudo aqui falha em silêncio por natureza. Um domínio que não casa, um peso que
// some num save, um filtro de país que não filtra: nada levanta exceção, nada
// aparece no run, e o sintoma chega semanas depois como "o radar não viu o
// assunto" ou como uma fatura de Apify maior sem explicação. Foi exatamente
// assim que se descobriu que marca criada pela tela nunca recebia agenda: não
// por erro, por omissão — os dois campos só existiam via SQL direto.

let falhas = 0;
const check = (nome: string, ok: boolean, extra?: unknown) => {
  if (!ok) falhas++;
  console.log(`${ok ? "PASS" : "FALHA"}  ${nome}`);
  if (!ok) console.log("   ", JSON.stringify(extra));
};

const DOMINIOS = ["economia", "entretenimento", "esporte", "massa", "musica", "tech"];

// ── normalizarPerfil: o que volta do modelo ───────────────
// O enum da tool já barra domínio inventado, mas isto NÃO é redundante: schema é
// instrução ao modelo, não garantia de runtime — e esta função é também por onde
// passa o que um humano digitou na tela, que não tem enum nenhum.
check(
  "dominio inventado e descartado",
  normalizarPerfil({ dominios: ["massa", "lifestyle"], vagas: 3, justificativa: "x" }, DOMINIOS)
    .dominios_culturais.join(",") === "massa"
);
check(
  "dominio duplicado nao ocupa duas vagas",
  normalizarPerfil({ dominios: ["massa", "massa"], vagas: 2, justificativa: "x" }, DOMINIOS)
    .dominios_culturais.length === 1
);
check(
  "dominios saem ordenados (config previsivel, nao ordem do modelo)",
  normalizarPerfil({ dominios: ["tech", "esporte", "massa"], vagas: 3, justificativa: "x" }, DOMINIOS)
    .dominios_culturais.join(",") === "esporte,massa,tech"
);
check(
  "dominios nao-array vira vazio (nao quebra o save)",
  normalizarPerfil({ dominios: "massa", vagas: 3, justificativa: "x" }, DOMINIOS)
    .dominios_culturais.length === 0
);
check(
  "item nao-string dentro do array e ignorado",
  normalizarPerfil({ dominios: [null, "massa", 7], vagas: 2, justificativa: "x" }, DOMINIOS)
    .dominios_culturais.join(",") === "massa"
);

// ── as duas metades têm que concordar ─────────────────────
// Domínio assinado com zero vaga é config que PARECE ligada e não roda; vaga sem
// domínio é custo reservado para uma agenda vazia. Nos dois casos o resultado
// correto é SEM_AGENDA, e explícito — não um dos dois campos sobrevivendo sozinho.
const soDominio = normalizarPerfil({ dominios: ["massa"], vagas: 0, justificativa: "B2B" }, DOMINIOS);
check("dominio com 0 vaga vira SEM_AGENDA", soDominio.dominios_culturais.length === 0 && soDominio.peso_cultural === 0, soDominio);
check("mas a justificativa do modelo SOBREVIVE", soDominio.justificativa === "B2B", soDominio);
const soVaga = normalizarPerfil({ dominios: [], vagas: 4, justificativa: "y" }, DOMINIOS);
check("vaga sem dominio vira SEM_AGENDA", soVaga.peso_cultural === 0 && soVaga.dominios_culturais.length === 0, soVaga);

// ── vagas → peso → vagas, sem perda ───────────────────────
// O modelo devolve um INTEIRO de vagas; o planner lê um float 0..1. A ida e a
// volta precisam fechar exatamente, senão "4 de 6" na tela vira 3 na varredura —
// e ninguém consegue olhar 0,67 e perceber.
for (let v = 1; v <= CAP_AGENDA_CLUSTERS; v++) {
  const p = normalizarPerfil({ dominios: ["massa"], vagas: v, justificativa: "x" }, DOMINIOS);
  check(`${v} vaga(s) sobrevive(m) a ida e volta pelo peso`, vagasDoPeso(p.peso_cultural) === v, {
    v,
    peso: p.peso_cultural,
    volta: vagasDoPeso(p.peso_cultural)
  });
}
// Medir isto pelo `vagasDoPeso` NÃO basta: ele tem o próprio clamp e devolveria 6
// mesmo com um peso 16,5 gravado. O que precisa ser verdade é que o número que vai
// pro BANCO já está no domínio 0..1 — a mutação que removeu o teto do
// normalizarPerfil sobreviveu exatamente por causa dessa medição indireta.
const estourado = normalizarPerfil({ dominios: ["massa"], vagas: 99, justificativa: "x" }, DOMINIOS);
check("peso gravado nunca passa de 1", estourado.peso_cultural <= 1, estourado);
check("vagas acima do teto sao aparadas, nao explodem o custo",
  vagasDoPeso(estourado.peso_cultural) === CAP_AGENDA_CLUSTERS);
// E o clamp do vagasDoPeso é a segunda linha de defesa, para peso que já esteja
// corrompido no banco (foi gravado por SQL à mão antes de tudo isto existir).
check("peso corrompido acima de 1 nao vira vaga fantasma", vagasDoPeso(4.2) === CAP_AGENDA_CLUSTERS);
check("peso negativo nao vira vaga negativa", vagasDoPeso(-1) === 0);
check("peso NaN/ausente vale 0 vaga", vagasDoPeso(NaN) === 0 && vagasDoPeso(undefined) === 0);
check("vaga negativa vira SEM_AGENDA",
  normalizarPerfil({ dominios: ["massa"], vagas: -3, justificativa: "x" }, DOMINIOS).peso_cultural === 0);
check("vaga fracionaria e arredondada",
  vagasDoPeso(normalizarPerfil({ dominios: ["massa"], vagas: 3.7, justificativa: "x" }, DOMINIOS).peso_cultural) === 4);
// NaN num campo de custo é o pior caso: passa por `typeof === 'number'`, e
// round(NaN) é NaN, que gravado no JSONB vira null e some.
check("vagas NaN nao vira peso NaN",
  normalizarPerfil({ dominios: ["massa"], vagas: NaN, justificativa: "x" }, DOMINIOS).peso_cultural === 0);
check("vagas string nao e aceita como numero",
  normalizarPerfil({ dominios: ["massa"], vagas: "4", justificativa: "x" }, DOMINIOS).peso_cultural === 0);
check("justificativa vazia cai no texto padrao (campo nunca fica mudo)",
  normalizarPerfil({ dominios: ["massa"], vagas: 2, justificativa: "   " }, DOMINIOS).justificativa === SEM_AGENDA.justificativa);
check("SEM_AGENDA nao gasta nada", SEM_AGENDA.peso_cultural === 0 && SEM_AGENDA.dominios_culturais.length === 0);

// ── a tool ────────────────────────────────────────────────
// Sem o enum o modelo produz nomes plausíveis ("lifestyle", "negocios") que
// passariam no JSONB e seriam filtrados a zero no selectAgenda: a tela mostraria
// um domínio assinado que nunca casa com linha nenhuma.
const tool = buildPerfilTool(DOMINIOS);
const props = tool.input_schema.properties as Record<string, Record<string, unknown>>;
check("tool trava os dominios num enum do vocabulario real",
  JSON.stringify((props.dominios.items as Record<string, unknown>).enum) === JSON.stringify(DOMINIOS));
check("tool trava as vagas no teto real do planner", props.vagas.maximum === CAP_AGENDA_CLUSTERS);
check("tool permite zero vaga (nao assinar e resposta valida)", props.vagas.minimum === 0);
check("tool exige justificativa",
  JSON.stringify(tool.input_schema.required) === JSON.stringify(["dominios", "vagas", "justificativa"]));

// ── descreverMarca ────────────────────────────────────────
const bradesco = {
  marca: "Bradesco Seguros",
  produto: "seguros para corretores",
  perfil_comportamental: "corretores independentes",
  universos_culturais: ["mercado segurador"],
  ambicao_de_marca: "ser o parceiro do corretor",
  o_que_evitar: ["tom alarmista"],
  pais: "BR"
} as unknown as MarcaKnowledge;
const desc = descreverMarca(bradesco);
check("descricao leva o produto e o publico", desc.includes("seguros para corretores") && desc.includes("corretores independentes"));
check("descricao leva o que evitar", desc.includes("tom alarmista"));
// termos_busca são operacionais e não dizem nada sobre território cultural;
// vazariam ruído de palavra-chave numa decisão que é sobre a marca.
check("descricao NAO leva termos de busca",
  !descreverMarca({ ...bradesco, termos_busca: ["seguro auto barato"] } as MarcaKnowledge).includes("seguro auto barato"));
check("campo ausente aparece como '(nao declarado)', nao como undefined",
  !descreverMarca({ ...bradesco, universos_culturais: undefined } as unknown as MarcaKnowledge).includes("undefined"));

// ── mesclarDNA: o apagão silencioso ───────────────────────
// O updateMarca montava o yaml_conhecimento DO ZERO a cada save. Todo campo que
// existe no DNA mas não está na tela — dominios_culturais, peso_cultural,
// termos_linkedin, idioma — era apagado por quem só quis corrigir uma vírgula.
const dnaVivo = {
  marca: "Vivo",
  produto: "telecom",
  tom: "proximo",
  perfil_comportamental: "conectado",
  universos_culturais: ["cultura pop"],
  o_que_evitar: [],
  ambicao_de_marca: "conectar",
  termos_busca: ["vivo fibra"],
  termos_linkedin: ["transformacao digital"],
  idioma: "pt",
  dominios_culturais: ["entretenimento", "esporte", "massa"],
  peso_cultural: 0.67,
  justificativa_cultural: "marca de massa puxada por cultura pop"
} as MarcaKnowledge;

const soTom = mesclarDNA(dnaVivo, { tom: "irreverente" });
check("save que so mexe no tom NAO apaga o peso_cultural", soTom.peso_cultural === 0.67, soTom);
check("save que so mexe no tom NAO apaga os dominios", soTom.dominios_culturais?.length === 3, soTom);
check("save que so mexe no tom NAO apaga termos_linkedin", soTom.termos_linkedin?.length === 1, soTom);
check("save que so mexe no tom NAO apaga o idioma", soTom.idioma === "pt", soTom);
check("e o tom REALMENTE muda", soTom.tom === "irreverente", soTom);
// `undefined` = "a tela não falou disto". Distinto de `[]`, que é "o usuário
// limpou o campo" — confundir os dois é o que transforma um form em destruidor.
check("undefined no patch preserva; nao zera", mesclarDNA(dnaVivo, { termos_busca: undefined }).termos_busca?.length === 1);
check("array vazio EXPLICITO limpa o campo", mesclarDNA(dnaVivo, { termos_busca: [] }).termos_busca?.length === 0);
check("peso_cultural 0 explicito e gravado (nao confundido com ausente)",
  mesclarDNA(dnaVivo, { peso_cultural: 0 }).peso_cultural === 0);
check("false explicito e gravado", mesclarDNA({ ...dnaVivo, linkedin_ativo: true }, { linkedin_ativo: false }).linkedin_ativo === false);
check("DNA inexistente nao quebra a criacao", mesclarDNA(null, { marca: "Nova" }).marca === "Nova");
// Se mesclarDNA mutasse a base, o `atual` lido do banco sairia corrompido no
// mesmo request e o log diria uma coisa enquanto o banco recebe outra.
const antes = JSON.stringify(dnaVivo);
mesclarDNA(dnaVivo, { tom: "outro", peso_cultural: 1 });
check("NAO muta o DNA recebido", JSON.stringify(dnaVivo) === antes);

// ── precisaDerivar: quando pagar Haiku ────────────────────
check("marca nova sem perfil: deriva", precisaDerivar(null, { marca: "Harts" }));
// O caso que a mutação revelou: marca que JÁ EXISTE, nunca passou pela derivação,
// e cujo save não toca em nenhuma entrada da decisão. É literalmente o buraco
// original — todas as marcas criadas pela tela estão nesse estado hoje. Sem esta
// asserção, "marca nova deriva" passava só porque o `marca` do patch diferia do
// base vazio, e a guarda de virgindade podia ser removida sem ninguém notar.
check(
  "marca existente NUNCA derivada deriva mesmo que so o tom mude",
  precisaDerivar({ marca: "Antiga", produto: "x", tom: "velho" } as MarcaKnowledge, { tom: "novo" })
);
check("marca com dominios mas peso null: NAO e virgem", !precisaDerivar({ dominios_culturais: ["massa"] } as MarcaKnowledge, { tom: "x" }));
check("marca ja derivada com peso 0 (B2B) NAO re-deriva a cada save",
  !precisaDerivar({ peso_cultural: 0, dominios_culturais: [] } as unknown as MarcaKnowledge, { tom: "x" }));
check("mudou o produto: re-deriva", precisaDerivar(dnaVivo, { produto: "seguros" }));
check("mudou o pais: re-deriva", precisaDerivar(dnaVivo, { pais: "AU" }));
check("mudou universos_culturais: re-deriva", precisaDerivar(dnaVivo, { universos_culturais: ["esporte"] }));
// Sem esta comparação, todo save re-chamaria o modelo: custo por clique e, pior,
// um override manual sendo desfeito por quem só abriu e fechou a tela.
check("salvou o MESMO produto: nao re-deriva", !precisaDerivar(dnaVivo, { produto: "telecom" }));
check("array igual item a item: nao re-deriva", !precisaDerivar(dnaVivo, { universos_culturais: ["cultura pop"] }));
check("array com a mesma coisa em ordem diferente: re-deriva (conservador)",
  precisaDerivar({ ...dnaVivo, universos_culturais: ["a", "b"] }, { universos_culturais: ["b", "a"] }));
check("campo que a derivacao NAO le (tom) nao re-deriva", !precisaDerivar(dnaVivo, { tom: "novissimo" }));
check("termos_busca nao re-deriva", !precisaDerivar(dnaVivo, { termos_busca: ["outra coisa"] }));
// O humano tem a palavra final: derivação é chute bom, não autoridade.
check("dominios explicitos no patch: NAO deriva (o humano decidiu)",
  !precisaDerivar(null, { marca: "X", dominios_culturais: ["massa"], produto: "novo" }));
check("peso explicito no patch: NAO deriva", !precisaDerivar(null, { marca: "X", peso_cultural: 0 }));

// ── país: a agenda errada é pior que agenda nenhuma ───────
const agendaBR: PulsoCultural[] = [
  {
    id: "1", tenant_id: null, dominio: "massa", titulo: "Dia dos Pais",
    termos: ["dia dos pais"], janela_inicio: "2026-07-27", janela_fim: "2026-08-09",
    peso: 2, ativo: true, origem: "curadoria", created_at: "", pais: "BR"
  },
  {
    id: "2", tenant_id: null, dominio: "massa", titulo: "Comportamento nas redes",
    termos: ["viralizou"], janela_inicio: null, janela_fim: null,
    peso: 3, ativo: true, origem: "curadoria", created_at: "", pais: "BR"
  },
  {
    id: "3", tenant_id: null, dominio: "massa", titulo: "Tendencia global",
    termos: ["trending"], janela_inicio: null, janela_fim: null,
    peso: 1, ativo: true, origem: "curadoria", created_at: "", pais: null
  }
];

const marcaDe = (k: Partial<MarcaKnowledge>): Marca => ({
  id: "m", nome: String(k.marca ?? "M"), tenant_id: null, status_varredura: true,
  intervalo_horas: 24, ultima_varredura: null, created_at: "",
  yaml_conhecimento: { dominios_culturais: ["massa"], peso_cultural: 0.5, ...k } as MarcaKnowledge
});

const HOJE = new Date("2026-08-02T12:00:00Z");

check("marca BR ve as linhas BR", selectAgenda(marcaDe({ marca: "Vivo", pais: "BR" }), agendaBR, HOJE).length === 3);
// Harts é australiana. Sem o filtro, ela NÃO fica sem agenda por engano — ela
// cai no Dia dos Pais brasileiro (agosto; o dela é setembro), que passa por
// todos os outros filtros e vira briefing convincente e errado.
const harts = selectAgenda(marcaDe({ marca: "Harts", pais: "AU" }), agendaBR, HOJE);
check("marca AU NAO recebe o Dia dos Pais brasileiro", !harts.some(a => a.titulo === "Dia dos Pais"), harts.map(a => a.titulo));
check("marca AU NAO recebe nenhuma linha BR", !harts.some(a => a.pais === "BR"), harts.map(a => a.titulo));
check("marca AU ainda recebe a linha universal", harts.length === 1 && harts[0].titulo === "Tendencia global", harts.map(a => a.titulo));
// Default BR porque todo tenant nasceu BR e toda linha do acervo é brasileira:
// mudar o default silenciaria a agenda de quem já roda hoje.
check("pais ausente vale BR (nao silencia quem ja roda)", paisDaMarca(marcaDe({ marca: "Vivo" })) === "BR");
check("pais minusculo e normalizado", paisDaMarca(marcaDe({ marca: "X", pais: "au" })) === "AU");
check("pais em branco vale BR", paisDaMarca(marcaDe({ marca: "X", pais: "  " })) === "BR");
// A normalização vale nos DOIS lados. A linha vem de SQL escrito à mão, onde
// 'au' minúsculo é o erro de digitação mais provável do mundo — e sem normalizar
// aqui ele não daria erro, só faria a linha nunca casar com marca nenhuma.
check("linha com pais minusculo casa com marca AU",
  selectAgenda(marcaDe({ marca: "X", pais: "AU" }), [{ ...agendaBR[0], pais: "au" }], HOJE).length === 1);
check("e continua NAO casando com marca BR",
  selectAgenda(marcaDe({ marca: "X", pais: "BR" }), [{ ...agendaBR[0], pais: "au" }], HOJE).length === 0);

// ── diagnosticarAgenda: os quatro silêncios ───────────────
// As quatro situações abaixo produziam EXATAMENTE o mesmo observável — zero
// lanes culturais, zero log — e têm causas e correções completamente diferentes.
const legado = diagnosticarAgenda(
  { ...marcaDe({ marca: "Antiga" }), yaml_conhecimento: { marca: "Antiga" } as MarcaKnowledge },
  agendaBR, HOJE
);
check("marca nunca derivada e 'legado', nao 'sem agenda'", legado.estado === "legado", legado);
check("e o log DIZ que o perfil nunca foi calculado", legado.resumo.includes("NÃO derivada"), legado.resumo);

const b2b = diagnosticarAgenda(
  marcaDe({ marca: "VOLL", dominios_culturais: [], peso_cultural: 0, justificativa_cultural: "publico decide por criterio tecnico" }),
  agendaBR, HOJE
);
check("marca B2B derivada e 'nao_assina' (decisao, nao omissao)", b2b.estado === "nao_assina", b2b);
check("e o log carrega a justificativa da decisao", b2b.resumo.includes("criterio tecnico"), b2b.resumo);

const contraditoria = diagnosticarAgenda(marcaDe({ marca: "X", dominios_culturais: ["massa"], peso_cultural: 0 }), agendaBR, HOJE);
check("dominio assinado com peso 0 e flagrado como contraditorio", contraditoria.estado === "sem_vagas", contraditoria);

const semLinha = diagnosticarAgenda(marcaDe({ marca: "Harts", pais: "AU", dominios_culturais: ["esporte"], peso_cultural: 0.5 }), agendaBR, HOJE);
check("assina dominio sem acervo: 'sem_linha'", semLinha.estado === "sem_linha", semLinha);
// "0 linha para BR" e "0 linha para AU" são o mesmo sintoma com causas opostas;
// só os números separam as duas.
check("e o log mede o acervo (dominio/pais/janela)", semLinha.resumo.includes("0 no domínio"), semLinha.resumo);

const ativa = diagnosticarAgenda(marcaDe({ marca: "Vivo", pais: "BR", peso_cultural: 0.67 }), agendaBR, HOJE);
check("marca com agenda viva e 'ativa'", ativa.estado === "ativa", ativa);
check("com 4 vagas e 3 linhas vigentes, leva as 3", ativa.escolhidas.length === 3, ativa.resumo);
check("o log nomeia as linhas escolhidas", ativa.resumo.includes("Dia dos Pais"), ativa.resumo);
// A datada vigente é marcada no log: sem isso, "Dia dos Pais" e "Brasileirão"
// parecem a mesma coisa e o efeito da correção da fase 2 fica invisível.
check("datada vigente e marcada com * no log", ativa.resumo.includes("Dia dos Pais*"), ativa.resumo);
check("o diagnostico reporta as vagas contratadas", ativa.vagas === 4, ativa);

// O planLanes usa as MESMAS escolhidas do diagnóstico. Se a seleção morasse em
// dois lugares, divergiriam na primeira mudança e o log passaria a mentir — que
// é pior do que não ter log.
check("estado 'ativa' e o unico que devolve linhas",
  [legado, b2b, contraditoria, semLinha].every(d => d.escolhidas.length === 0 && d.vagas === 0));

// ── o teto duplicado na tela ──────────────────────────────
// O MarcaDialog não pode importar o planner (arrastaria o SDK da Anthropic pro
// bundle do cliente), então repete o CAP como literal. Duplicata sem guarda é
// duplicata que diverge: a tela ofereceria "6 de 6" e a varredura rodaria 8, ou
// pior, o inverso — e o único sintoma seria a fatura.
const dialog = readFileSync(
  new URL("../app/dashboard/admin/clientes/MarcaDialog.tsx", import.meta.url),
  "utf8"
);
const capNaTela = dialog.match(/const CAP_VAGAS = (\d+)/)?.[1];
check(
  "o CAP da tela e o mesmo do planner",
  Number(capNaTela) === CAP_AGENDA_CLUSTERS,
  { capNaTela, CAP_AGENDA_CLUSTERS }
);
// A tela grava vagas/CAP como peso. Se ela mandasse o número de vagas cru, o
// planner leria "4" como peso, faria clamp01 → 1, e a marca sairia com o teto de
// vagas em vez das 4 pedidas: 12 lanes a mais por varredura, silenciosamente.
check(
  "a tela converte vagas em peso 0..1 antes de gravar",
  dialog.includes("vagas / CAP_VAGAS"),
  null
);

console.log(
  falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falhou.`
);
process.exit(falhas === 0 ? 0 : 1);

import { escolherLegenda, vttParaTexto, type SubtitleLink } from "../lib/legendas";

// Item 3 do feedback (relevância da raspagem): a transcrição passou a ser o
// campo que decide se um vídeo entra no report. Como a conta da Apify está sem
// saldo, nada disso pôde ser validado contra um arquivo de legenda real — o
// que dá pra travar aqui são as duas decisões puras:
//
//   escolherLegenda: pegar a legenda errada (tradução automática quando existe
//   a original em português) não quebra nada, só entrega ao modelo um texto
//   mais pobre, em silêncio.
//
//   vttParaTexto: deixar timestamp passar enche o payload de "00:00:03.500"; e
//   NÃO deduplicar legenda rolante faz a mesma frase aparecer cinco vezes, o
//   que o modelo lê como ênfase e vira "bordão repetido" num vídeo que disse
//   a frase uma única vez. Erro que inventa trend.

let falhas = 0;
const check = (nome: string, ok: boolean, extra?: unknown) => {
  if (!ok) falhas++;
  console.log(`${ok ? "PASS" : "FALHA"}  ${nome}`);
  if (!ok) console.log("   ", JSON.stringify(extra));
};

// ── escolha da legenda ────────────────────────────────────
const pt: SubtitleLink = { language: "por-PT", downloadLink: "PT_ORIG", source: "ASR" };
const ptMT: SubtitleLink = { language: "por-PT", downloadLink: "PT_MT", source: "MT" };
const en: SubtitleLink = { language: "eng-US", downloadLink: "EN_ORIG", source: "ASR" };
const enMT: SubtitleLink = { language: "eng-US", downloadLink: "EN_MT", source: "MT" };

check("sem legendas devolve null", escolherLegenda([]) === null);
check("null/undefined nao quebra", escolherLegenda(null) === null && escolherLegenda(undefined) === null);
// O report é BR: tradução automática achata gíria e trocadilho, que é
// justamente o que faz a trend ser trend.
check(
  "portugues original ganha de tudo",
  escolherLegenda([enMT, en, ptMT, pt]) === "PT_ORIG",
  escolherLegenda([enMT, en, ptMT, pt])
);
check(
  "portugues traduzido ganha de ingles original",
  escolherLegenda([en, ptMT]) === "PT_MT"
);
check(
  "sem portugues, prefere o audio original ao traduzido",
  escolherLegenda([enMT, en]) === "EN_ORIG"
);
check("com uma opcao so, usa ela", escolherLegenda([enMT]) === "EN_MT");
// Link sem downloadLink é inútil: tiktokLink é a página do vídeo, não o arquivo.
check(
  "entrada sem downloadLink e ignorada",
  escolherLegenda([{ language: "por-PT", tiktokLink: "https://tiktok.com/x", source: "ASR" }, enMT]) ===
    "EN_MT"
);
check(
  "so entradas sem downloadLink devolve null",
  escolherLegenda([{ language: "por-PT", source: "ASR" }]) === null
);
// "pt-BR" e "por-BR" aparecem conforme a rota do TikTok; as duas são português.
check('prefixo "pt" tambem conta como portugues', escolherLegenda([en, { language: "pt-BR", downloadLink: "PT_BR", source: "MT" }]) === "PT_BR");
check("language ausente nao quebra", escolherLegenda([{ downloadLink: "X" }]) === "X");
// Empate acontece de verdade: o TikTok às vezes devolve duas faixas da mesma
// língua (versões diferentes da mesma ASR). Fica a PRIMEIRA, que é a ordem que
// ele mandou — assim o mesmo vídeo rende a mesma transcrição em duas gerações,
// em vez de alternar sem motivo entre relatórios.
check(
  "empate fica com a primeira da lista (resultado estavel)",
  escolherLegenda([
    { language: "por-PT", downloadLink: "PRIMEIRA", source: "ASR", version: "4" },
    { language: "por-PT", downloadLink: "SEGUNDA", source: "ASR", version: "5" },
  ]) === "PRIMEIRA"
);
check(
  "source minusculo tambem e reconhecido como traducao",
  escolherLegenda([{ language: "por-PT", downloadLink: "A", source: "mt" },
                   { language: "por-PT", downloadLink: "B", source: "ASR" }]) === "B"
);

// ── VTT → texto ───────────────────────────────────────────
const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:02.000
gente eu preciso contar

2
00:00:02.000 --> 00:00:04.000
<c.colorE5E5E5>o que aconteceu no mercado</c>

3
00:00:04.000 --> 00:00:06.000
o que aconteceu no mercado

4
00:00:06.000 --> 00:00:08.000
foi surreal`;

const texto = vttParaTexto(vtt);
check("cabecalho WEBVTT nao entra", !texto.includes("WEBVTT"), texto);
check("timestamp nao entra", !texto.includes("-->") && !texto.includes("00:00"), texto);
check("numeracao de cue nao entra", !/\b1\b/.test(texto), texto);
check("tag de estilo <c> e removida", !texto.includes("<c") && !texto.includes("</c>"), texto);
check("a fala sobrevive inteira", texto.includes("gente eu preciso contar") && texto.includes("foi surreal"), texto);
// Repetição literal viraria "bordão" aos olhos do modelo.
check(
  "cue repetido aparece uma vez so",
  texto.split("o que aconteceu no mercado").length - 1 === 1,
  texto
);

// Legenda rolante: o TikTok reemite a frase crescendo palavra a palavra.
const rolante = `WEBVTT

00:00:00.000 --> 00:00:01.000
eu

00:00:01.000 --> 00:00:02.000
eu vou

00:00:02.000 --> 00:00:03.000
eu vou contar tudo`;
check(
  "legenda rolante colapsa na frase completa",
  vttParaTexto(rolante) === "eu vou contar tudo",
  vttParaTexto(rolante)
);

// SRT tem o mesmo miolo, só muda a vírgula do timestamp. O formato real não
// pôde ser conferido no CDN, então os dois precisam funcionar.
const srt = `1
00:00:00,000 --> 00:00:02,000
primeira fala

2
00:00:02,000 --> 00:00:04,000
segunda fala`;
check("SRT tambem e limpo", vttParaTexto(srt) === "primeira fala segunda fala", vttParaTexto(srt));

check("string vazia devolve vazio", vttParaTexto("") === "");
check("arquivo so com cabecalho devolve vazio", vttParaTexto("WEBVTT\n\n") === "");
// Uma fala que É um número não pode ser confundida com numeração de cue.
const soNumeroNaFala = `WEBVTT

00:00:00.000 --> 00:00:02.000
2026 vai ser o ano

00:00:02.000 --> 00:00:03.000
7`;
check(
  "numero dentro de frase sobrevive",
  vttParaTexto(soNumeroNaFala).includes("2026 vai ser o ano"),
  vttParaTexto(soNumeroNaFala)
);

// Truncagem: sem as reticências o modelo lê a metade como frase terminada.
const longo = `WEBVTT\n\n00:00:00.000 --> 00:01:00.000\n${"palavra ".repeat(300)}`;
const cortado = vttParaTexto(longo);
check("texto longo e truncado", cortado.length <= 601, cortado.length);
check("truncagem e marcada com reticencias", cortado.endsWith("…"), cortado.slice(-20));
check("truncagem nao parte palavra ao meio", !/palav…$|palavr…$/.test(cortado), cortado.slice(-20));
// Texto curto não pode ganhar reticências (sinalizaria corte inexistente).
check("texto curto nao ganha reticencias", !vttParaTexto(srt).endsWith("…"));

console.log(
  falhas === 0 ? "\nTodos os casos passaram." : `\n${falhas} caso(s) falhou.`
);
process.exit(falhas === 0 ? 0 : 1);

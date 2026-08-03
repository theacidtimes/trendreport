import type { TikTokItem } from "./types";

// ── Legendas do TikTok: o que foi DITO, não o que foi escrito ──────────────
//
// Causa estrutural do "tema certo, conteúdo irrelevante" apontado pelo social
// media: até aqui a relevância de um vídeo era julgada só pela caption. Em
// TikTok a caption é "kkkkk 😭 #fyp" — o conteúdo está na FALA. O modelo
// recebia o invólucro e não a peça.
//
// A alavanca é o `downloadSubtitlesOptions` do actor (default
// NEVER_DOWNLOAD_SUBTITLES). Conferido via fetch-actor-details:
//   - DOWNLOAD_SUBTITLES pega a legenda que o próprio TikTok já gerou e NÃO
//     tem evento de cobrança na tabela de preços do actor.
//   - TRANSCRIBE_ALL_VIDEOS roda speech-to-text e é cobrado por minuto por
//     vídeo ($0,034/min no nosso tier SILVER) — em ~200 vídeos passa de $6 por
//     report, mais que o custo atual da coleta inteira. Está fora.
//
// Pegadinha de implementação: `subtitleLinks` vem como URL, não como texto.
//
// MEDIDO contra a Apify real (run vg1Xgg71RYrvfVg5i, 20 vídeos): 15 traziam
// legenda, e o `downloadLink` NÃO é o CDN do TikTok — é um record no
// key-value store da Apify:
//   https://api.apify.com/v2/key-value-stores/<id>/records/subtitle-...pt.vtt
// Devolve HTTP 200 sem token, content-type text/vtt. Duas consequências:
//   - store sem nome é apagado em 7 dias, então a legenda tem que ser baixada
//     na mesma geração. Não serve como arquivo de longo prazo.
//   - `tiktokLink` (esse sim CDN) existe no mesmo objeto e é uma URL assinada
//     com expiração; não usamos.
//
// O download é feito só para os vídeos que sobrevivem ao trimForModel —
// buscar os ~200 da coleta seria trabalho jogado fora, já que o modelo nunca
// vê a maioria deles.

/** Item de `videoMeta.subtitleLinks` no output do clockworks/tiktok-scraper. */
export type SubtitleLink = {
  language?: string;
  downloadLink?: string;
  tiktokLink?: string;
  source?: string;
  sourceUnabbreviated?: string;
  version?: string;
};

const TIMEOUT_LEGENDA_MS = 8_000;

// O CDN do TikTok aguenta bem mais, mas o gargalo aqui não é ele: são até 51
// downloads no meio da geração de um report que já leva minutos. 6 de cada vez
// resolve o lote em ~2s sem abrir 51 sockets de uma vez.
const CONCORRENCIA = 6;

// Teto por vídeo. Um TikTok de 3 minutos falado passa de 3000 caracteres e, em
// 51 vídeos, isso sozinho encheria o contexto do modelo com transcrição — que
// é insumo de apoio, não a matéria-prima. ~600 caracteres cobrem inteiro o
// vídeo curto (que é o formato onde a trend mora) e dão o assunto do vídeo
// longo.
const MAX_CHARS_LEGENDA = 600;

/**
 * Escolhe UMA legenda entre as ofertadas.
 *
 * O TikTok costuma devolver várias: a do áudio original e traduções
 * automáticas dela. `source: "MT"` = machine translation, ou seja, texto que
 * passou por mais uma camada de máquina e chegou mais longe do que foi dito.
 *
 * Na medição real o vídeo BR veio com uma faixa só, `language: "pt"` (código
 * curto, não "por-PT") e `source: "ASR"` / version "1:whisper_lid" — daí a
 * checagem aceitar tanto o prefixo "pt" quanto "por": os dois aparecem
 * conforme a rota, e casar só um deixaria a legenda certa de fora.
 *
 * Ordem de preferência (pontuação):
 *   português + original  (3) → o caso que queremos: a fala, na língua da fala
 *   português traduzido   (2) → conteúdo gringo, mas legível pelo modelo
 *   outra língua original (1) → é o áudio real, só que em outro idioma
 *   outra língua traduzida(0)
 *
 * Preferir português importa porque o report é BR: a tradução automática
 * achata gíria e trocadilho, que é exatamente o que faz uma trend ser trend.
 */
export function escolherLegenda(
  links: SubtitleLink[] | null | undefined
): string | null {
  if (!Array.isArray(links)) return null;

  let melhor: SubtitleLink | null = null;
  let melhorPonto = -1;

  for (const link of links) {
    // Sem URL não há o que baixar; `tiktokLink` não serve de substituto (é a
    // página do vídeo, não o arquivo de legenda).
    if (!link?.downloadLink) continue;

    const lingua = String(link.language ?? "").toLowerCase();
    const ehPortugues = lingua.startsWith("por") || lingua.startsWith("pt");
    const ehTraducao = String(link.source ?? "").toUpperCase() === "MT";

    const ponto = (ehPortugues ? 2 : 0) + (ehTraducao ? 0 : 1);
    // `>` e não `>=`: em empate fica o primeiro, que é a ordem que o TikTok
    // devolveu (a legenda original costuma vir na frente).
    if (ponto > melhorPonto) {
      melhorPonto = ponto;
      melhor = link;
    }
  }

  return melhor?.downloadLink ?? null;
}

const RE_TEMPO = /-->/;
const RE_SO_NUMERO = /^\d+$/;
const RE_TAGS = /<[^>]*>/g;

/**
 * WebVTT/SRT → texto corrido.
 *
 * Escrito tolerante aos dois formatos de propósito: não deu pra confirmar
 * contra o CDN real (a conta da Apify está sem saldo), e a diferença entre
 * eles é só o cabeçalho e o formato do timestamp — ambos caem nas mesmas
 * regras de descarte abaixo.
 */
export function vttParaTexto(raw: string): string {
  const linhas = String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");

  const falas: string[] = [];

  for (const bruta of linhas) {
    const linha = bruta
      // <c.colorE5E5E5>...</c> e afins: marcação de estilo do VTT, vira ruído
      // no meio da frase se não sair aqui.
      .replace(RE_TAGS, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!linha) continue;
    if (linha === "WEBVTT" || linha.startsWith("WEBVTT")) continue;
    if (linha.startsWith("NOTE") || linha.startsWith("STYLE")) continue;
    // "00:00:01.000 --> 00:00:03.500"
    if (RE_TEMPO.test(linha)) continue;
    // Numeração de cue do SRT. Só descartamos se a linha for SÓ o número —
    // uma fala que é literalmente "2024" tem outro contexto e sobrevive.
    if (RE_SO_NUMERO.test(linha)) continue;

    const anterior = falas[falas.length - 1];
    if (anterior) {
      // Legenda rolante: o TikTok reemite a frase crescendo palavra a palavra
      // ("eu", "eu vou", "eu vou contar"). Sem isto a transcrição sai com a
      // mesma frase repetida cinco vezes e o modelo lê ênfase onde não há.
      if (anterior === linha) continue;
      if (linha.startsWith(anterior)) {
        falas[falas.length - 1] = linha;
        continue;
      }
      if (anterior.endsWith(linha)) continue;
    }

    falas.push(linha);
  }

  const texto = falas.join(" ").replace(/\s+/g, " ").trim();
  if (texto.length <= MAX_CHARS_LEGENDA) return texto;

  // Corta na palavra, não no meio dela, e marca o corte: transcrição truncada
  // sem reticências parece frase terminada e o modelo conclui em cima de uma
  // metade.
  const cortado = texto.slice(0, MAX_CHARS_LEGENDA);
  const ultimoEspaco = cortado.lastIndexOf(" ");
  return (ultimoEspaco > 0 ? cortado.slice(0, ultimoEspaco) : cortado) + "…";
}

export type DiagnosticoLegendas = {
  videos: number;
  comLink: number;
  baixadas: number;
  vazias: number;
  falhas: number;
  resumo: string;
};

async function baixarUma(url: string): Promise<string | null> {
  const controle = new AbortController();
  const alarme = setTimeout(() => controle.abort(), TIMEOUT_LEGENDA_MS);
  try {
    const res = await fetch(url, {
      signal: controle.signal,
      // Identificação nossa. Na medição a API da Apify devolveu 200 sem
      // header nenhum, então isto é cortesia, não requisito — se um dia
      // sumir, não é aqui que a legenda quebra.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TrendsAgent/1.0)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    // Silêncio AQUI é proposital e não repete o bug do `catch { return [] }`:
    // quem chama conta as falhas e loga o total. Uma linha de log por legenda
    // perdida afogaria o log do report, mas o agregado sempre aparece.
    return null;
  } finally {
    clearTimeout(alarme);
  }
}

/**
 * Baixa e anexa a transcrição aos vídeos passados. MUTA os itens: são as
 * mesmas referências de `rawData.tiktok`, e a alternativa (clonar) faria o
 * payload divergir do que o clustering já tinha visto.
 *
 * Nunca lança. Legenda é enriquecimento: report sem transcrição é pior, mas
 * report nenhum é bem pior. O que ela faz é ficar RUIDOSA quando falha.
 */
export async function enriquecerComLegendas(
  items: TikTokItem[]
): Promise<DiagnosticoLegendas> {
  const alvos = items.filter((i) => i.subtitleUrl);

  let baixadas = 0;
  let vazias = 0;
  let falhas = 0;

  let cursor = 0;
  const trabalhador = async () => {
    while (cursor < alvos.length) {
      const item = alvos[cursor++];
      const bruto = await baixarUma(item.subtitleUrl!);
      if (bruto === null) {
        falhas++;
        continue;
      }
      const texto = vttParaTexto(bruto);
      if (!texto) {
        // Arquivo veio, mas sem fala aproveitável (legenda só de música, por
        // exemplo). Não é falha de rede e não deve ser contada como tal.
        vazias++;
        continue;
      }
      item.transcricao = texto;
      baixadas++;
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCORRENCIA, alvos.length) }, trabalhador)
  );

  // A URL era meio, não fim: mandá-la ao modelo gastaria token num link que
  // ele não pode abrir e ainda vazaria assinatura de CDN no payload.
  for (const item of items) delete item.subtitleUrl;

  const resumo =
    `${items.length} video(s) no payload, ${alvos.length} com legenda ofertada, ` +
    `${baixadas} transcrito(s)` +
    (vazias ? `, ${vazias} sem fala` : "") +
    (falhas ? `, ${falhas} falha(s) de download` : "");

  return {
    videos: items.length,
    comLink: alvos.length,
    baixadas,
    vazias,
    falhas,
    resumo,
  };
}

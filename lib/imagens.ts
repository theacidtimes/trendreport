import { createClient } from "@supabase/supabase-js";
import type { TrendReport } from "./types";

// POR QUE ESTE ARQUIVO EXISTE
//
// As URLs de imagem que Instagram e TikTok devolvem são ASSINADAS e expiram.
// Medido nas URLs realmente salvas no banco: o TikTok assina por horas (cover de
// report gerado em 31/07 já respondia 403 no mesmo dia) e o Instagram por ~4-5
// dias. Como o report guardava a URL do CDN e o <img> fazia hotlink, o report
// esvaziava sozinho com o tempo — de 33 cards com imagem no acervo, só ~10
// ainda carregavam. O SmartImage troca a imagem morta por um ícone, então o
// sintoma na tela é "report sem imagem", não erro.
//
// A única correção que dura é parar de depender do CDN: baixar a imagem no
// momento da geração e servir do nosso storage. Precisa ser na geração porque
// no TikTok a assinatura já venceu quando o report esfria algumas horas.
//
// O bucket é o MESMO que a curadoria manual já usa (migration 0004): lá o
// analista sobe a imagem à mão justamente porque a original morreu. Isto aqui
// automatiza o mesmo remédio na origem — e continua compatível, porque uma
// troca manual depois sobrescreve a imagem_url do mesmo jeito.

const BUCKET = "report-images";

// Teto por imagem. Cover de TikTok e post de Instagram vivem na casa das
// centenas de KB; o que passar disso é quase certamente vídeo ou página de erro
// disfarçada, e não vale ocupar storage nem segurar a geração.
const MAX_BYTES = 5 * 1024 * 1024;

const TIMEOUT_MS = 15_000;

// Sem isto o fbcdn devolve 403 mesmo com a assinatura válida.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

const EXT_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// A geração de verdade roda no GitHub Actions, e lá o secret se chama
// SUPABASE_URL — não NEXT_PUBLIC_SUPABASE_URL, que só existe no ambiente do
// Vercel. Ler só o nome do Vercel deixaria a URL undefined justamente no único
// lugar onde este código roda, e todo upload falharia calado.
function admin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Pasta separada da curadoria manual, que grava em `${slug}/…` (ReportEditor).
// Aqui o nome é o hash da URL de origem, sem slug no caminho, e isso é de
// propósito: o mesmo post costuma aparecer em reports de clientes diferentes na
// mesma semana, e com chave global ele ocupa um arquivo só. Também cobre o caso
// de uma tendência que vira meme e aparece duas vezes no mesmo report.
async function nomeDoArquivo(url: string, tipo: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(url)
  );
  const hash = Array.from(new Uint8Array(buf))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `auto/${hash}.${EXT_POR_TIPO[tipo] ?? "jpg"}`;
}

/**
 * Baixa uma imagem e devolve a URL pública no nosso storage.
 * Devolve null quando não dá pra salvar — quem chama decide o que fazer.
 */
async function persistirUma(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const tipo = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!tipo.startsWith("image/")) return null;

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) return null;

    const supabase = admin();
    if (!supabase) return null;
    const nome = await nomeDoArquivo(url, tipo);

    const { error } = await supabase.storage.from(BUCKET).upload(nome, bytes, {
      contentType: tipo,
      // Reaproveita o arquivo já existente em vez de falhar: o nome vem do hash
      // da origem, então colisão significa mesma imagem.
      upsert: true,
    });
    if (error) {
      console.error("Falha ao subir imagem:", error.message);
      return null;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(nome);
    return data.publicUrl ?? null;
  } catch {
    // Timeout, DNS, assinatura já vencida na origem — todos caem aqui e o card
    // simplesmente mantém a URL antiga.
    return null;
  }
}

/**
 * Troca as `imagem_url` do report por cópias no nosso storage. Muta o report
 * recebido e o devolve.
 *
 * Falha de uma imagem nunca derruba a geração: o report já custou scrape e
 * tokens, e entregar com uma imagem a menos é muito melhor do que não entregar.
 * O card que não subir mantém a URL original do CDN — que funciona no primeiro
 * dia e depois degrada para o ícone, exatamente o comportamento de antes.
 */
export async function persistirImagensDoReport(
  report: TrendReport
): Promise<TrendReport> {
  // Checado uma vez, antes de baixar qualquer coisa: sem credencial o upload
  // falharia em todas, e o log de "não persistidas" pareceria problema de rede
  // quando na verdade é secret faltando no ambiente.
  if (!admin()) {
    console.warn(
      "Imagens não persistidas: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes. " +
        "O report mantém as URLs do CDN, que expiram em horas (TikTok) ou dias (Instagram)."
    );
    return report;
  }

  const cards = [...(report.tendencias ?? []), ...(report.memes ?? [])].filter(
    (c) => c.imagem_url
  );
  if (cards.length === 0) return report;

  // Uma imagem por URL distinta, mesmo que dois cards citem o mesmo post.
  const originais = Array.from(new Set(cards.map((c) => c.imagem_url as string)));

  const resolvidas = new Map<string, string>();
  await Promise.all(
    originais.map(async (url) => {
      const nova = await persistirUma(url);
      if (nova) resolvidas.set(url, nova);
    })
  );

  for (const card of cards) {
    const nova = resolvidas.get(card.imagem_url as string);
    if (nova) card.imagem_url = nova;
  }

  const falhas = originais.length - resolvidas.size;
  if (falhas > 0) {
    console.warn(
      `Imagens não persistidas: ${falhas} de ${originais.length} (cards mantêm a URL do CDN).`
    );
  }

  return report;
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { palavrao } from "./brandSafety";
import { ehImagemNossa, persistirUrls } from "./imagens";
import type { ColetaItem, RawData } from "./types";

// ACERVO DA COLETA
//
// Transforma o que o report raspou em linhas de `coleta_item` (migration 0049),
// que é de onde o editor tira material no "Trocar pela coleta". Todas as redes
// viram o mesmo formato: plataforma, url, autor, texto, imagem e métricas.

export type ColetaNova = Omit<ColetaItem, "id" | "coletado_em" | "origem">;

function data(valor: string | undefined): string | null {
  if (!valor) return null;
  const t = Date.parse(valor);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function juntar(...partes: (string | undefined | null)[]): string | null {
  const t = partes.filter(Boolean).join(" — ").trim();
  return t || null;
}

/**
 * Normaliza a coleta inteira (já filtrada por brand safety) para o acervo.
 *
 * `tiktokTranscritos` são os vídeos que passaram pela transcrição: a fala deles
 * entra na checagem de palavrão. `tiktokRemovidos` são os que a segunda passada
 * de brand safety cortou pela fala: esses ficam fora do acervo pelo mesmo
 * motivo que ficaram fora do report.
 */
export function montarColeta(
  dados: RawData,
  tiktokTranscritos: { webVideoUrl?: string; transcricao?: string }[],
  tiktokRemovidos: Set<string>
): ColetaNova[] {
  const fala = new Map(
    tiktokTranscritos
      .filter((t) => t.webVideoUrl && t.transcricao)
      .map((t) => [t.webVideoUrl as string, t.transcricao as string])
  );
  const itens: ColetaNova[] = [];

  for (const i of dados.instagram) {
    if (!i.url) continue;
    itens.push({
      plataforma: "instagram",
      url: i.url,
      autor: i.ownerUsername ? `@${i.ownerUsername}` : null,
      texto: i.caption ?? null,
      imagem_url: i.displayUrl ?? null,
      imagem_estavel: false,
      linguagem_explicita: palavrao(i.caption),
      metricas: { curtidas: i.likesCount ?? null },
      engajamento: i.likesCount ?? 0,
      publicado_em: null,
    });
  }

  for (const i of dados.tiktok) {
    if (!i.webVideoUrl || tiktokRemovidos.has(i.webVideoUrl)) continue;
    const transcricao = fala.get(i.webVideoUrl);
    itens.push({
      plataforma: "tiktok",
      url: i.webVideoUrl,
      autor: i.authorNickName ? `@${i.authorNickName}` : null,
      texto: i.text ?? null,
      imagem_url: i.coverUrl ?? null,
      imagem_estavel: false,
      linguagem_explicita: palavrao([i.text, transcricao].filter(Boolean).join(" ")),
      metricas: { curtidas: i.diggCount ?? null, views: i.playCount ?? null },
      engajamento: i.diggCount ?? 0,
      publicado_em: data(i.createTimeISO),
    });
  }

  for (const i of dados.twitter) {
    if (!i.url) continue;
    itens.push({
      plataforma: "twitter",
      url: i.url,
      autor: i.author ? `@${i.author.replace(/^@/, "")}` : null,
      texto: i.text ?? null,
      imagem_url: null,
      imagem_estavel: true,
      linguagem_explicita: palavrao(i.text),
      metricas: { curtidas: i.likeCount ?? null, respostas: i.replyCount ?? null },
      engajamento: (i.likeCount ?? 0) + (i.replyCount ?? 0),
      publicado_em: null,
    });
  }

  for (const i of dados.news) {
    if (!i.link) continue;
    const texto = juntar(i.title, i.snippet);
    itens.push({
      plataforma: "news",
      url: i.link,
      autor: i.source ?? null,
      texto,
      imagem_url: i.imagem ?? null,
      // og:image de matéria é URL pública e fixa.
      imagem_estavel: true,
      linguagem_explicita: palavrao(texto),
      metricas: {},
      engajamento: 0,
      publicado_em: data(i.date),
    });
  }

  for (const i of dados.reddit) {
    if (!i.url) continue;
    itens.push({
      plataforma: "reddit",
      url: i.url,
      autor: i.communityName ? `r/${i.communityName.replace(/^r\//, "")}` : null,
      texto: i.title ?? null,
      imagem_url: i.imageUrl ?? null,
      imagem_estavel: true,
      linguagem_explicita: palavrao(i.title),
      metricas: { upvotes: i.upVotes ?? null, comentarios: i.numberOfComments ?? null },
      engajamento: (i.upVotes ?? 0) + (i.numberOfComments ?? 0),
      publicado_em: data(i.createdAt),
    });
  }

  // A mesma URL pode vir de duas lanes da coleta (ex.: Reddit meme e tema).
  const porUrl = new Map<string, ColetaNova>();
  for (const it of itens) if (!porUrl.has(it.url)) porUrl.set(it.url, it);
  return Array.from(porUrl.values());
}

/**
 * Sobe pro nosso storage as imagens de Instagram e TikTok dos itens em
 * `prioritarios` (os que foram ao modelo, que são os mais fortes da coleta).
 * O resto mantém a URL do CDN e fica com imagem_estavel=false: funciona por
 * horas (TikTok) ou dias (Instagram). Persistir a coleta inteira seria baixar
 * centenas de imagens por report, a maioria que ninguém vai escolher.
 *
 * `jaPersistidas` são as que o report acabou de subir, pra não baixar de novo.
 */
export async function persistirImagensDaColeta(
  itens: ColetaNova[],
  prioritarios: Set<string>,
  jaPersistidas: Map<string, string>
): Promise<void> {
  const alvo = itens.filter(
    (i) =>
      i.imagem_url &&
      !i.imagem_estavel &&
      prioritarios.has(i.url) &&
      !jaPersistidas.has(i.imagem_url)
  );
  const novas = await persistirUrls(alvo.map((i) => i.imagem_url as string));

  for (const it of itens) {
    if (!it.imagem_url) continue;
    const nossa = jaPersistidas.get(it.imagem_url) ?? novas.get(it.imagem_url);
    if (nossa) it.imagem_url = nossa;
    if (ehImagemNossa(it.imagem_url)) it.imagem_estavel = true;
  }
  console.log(
    `[REPORT][COLETA] ${itens.length} item(ns) no acervo, ` +
      `${itens.filter((i) => i.imagem_estavel && i.imagem_url).length} com imagem estável`
  );
}

/**
 * Grava o acervo. Nunca lança: o report já está pronto e vale mais entregá-lo
 * sem acervo do que derrubar a geração por isso.
 */
export async function gravarColeta(
  supabase: SupabaseClient,
  itens: ColetaNova[],
  ctx: { tenantId: string | null; marcaId: string | null; reportId: string | null }
): Promise<void> {
  if (itens.length === 0) return;
  const agora = new Date().toISOString();
  const linhas = itens.map((i) => ({
    ...i,
    tenant_id: ctx.tenantId,
    marca_id: ctx.marcaId,
    report_id: ctx.reportId,
    coletado_em: agora,
  }));

  let gravados = 0;
  for (let i = 0; i < linhas.length; i += 500) {
    const lote = linhas.slice(i, i + 500);
    const { error } = await supabase
      .from("coleta_item")
      .upsert(lote, { onConflict: "tenant_id,marca_id,url" });
    if (error) {
      console.error(`[REPORT][COLETA] falha ao gravar lote do acervo: ${error.message}`);
    } else {
      gravados += lote.length;
    }
  }
  console.log(`[REPORT][COLETA] ${gravados}/${linhas.length} item(ns) gravado(s) no acervo`);
}

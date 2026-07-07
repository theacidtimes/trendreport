import type {
  InstagramItem,
  NewsItem,
  RawData,
  RedditItem,
  TikTokItem,
  TwitterItem,
} from "./types";

const APIFY_BASE = "https://api.apify.com/v2";

async function runActor<T>(
  actorId: string,
  input: Record<string, unknown>
): Promise<T[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN não configurado");
  }

  const runRes = await fetch(
    `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }
  );

  if (!runRes.ok) {
    throw new Error(
      `Apify actor ${actorId} falhou: ${runRes.status} ${await runRes.text()}`
    );
  }

  return (await runRes.json()) as T[];
}

// Perfis validados manualmente (contas públicas, ativas, alto volume de posts)
// cobrindo esporte, humor/entretenimento e notícias/cultura pop. Instagram não
// permite busca confiável por hashtag/palavra-chave via scraper, então usamos
// esta lista fixa como sinal de tendência visual; a busca dinâmica por
// briefing acontece no TikTok (ver fetchTikTok).
const INSTAGRAM_BASE_PROFILES = [
  "g1",
  "netflixbrasil",
  "portadosfundos",
  "flamengo",
  "buzzfeedbrasil",
  "sportv",
  "espnbrasil",
  // memes
  "saquinhodelixo",
  "meltedvideos",
  "pleasecome2br",
  "brazilianversion",
  "divadepressao",
  // cinema/séries/games/música/cultura pop
  "omelete",
  "jovemnerd",
  "ignbrasil",
  "rollingstonebrasil",
  "adrenaline_oficial",
  "voxeloficial",
  "papelpop",
];

interface RawInstagramItem {
  error?: string;
  caption?: string;
  likesCount?: number;
  url?: string;
  displayUrl?: string;
  hashtags?: string[];
  ownerUsername?: string;
  type?: string;
}

export async function fetchInstagram(): Promise<InstagramItem[]> {
  try {
    const raw = await runActor<RawInstagramItem>("apify~instagram-scraper", {
      directUrls: INSTAGRAM_BASE_PROFILES.map(
        (username) => `https://www.instagram.com/${username}/`
      ),
      resultsType: "posts",
      resultsLimit: 3,
    });

    return raw
      .filter((item) => !item.error && item.displayUrl)
      .map((item) => ({
        caption: item.caption,
        likesCount: item.likesCount,
        url: item.url,
        displayUrl: item.displayUrl,
        hashtags: item.hashtags,
        ownerUsername: item.ownerUsername,
        type: item.type,
      }));
  } catch {
    return [];
  }
}

interface RawTikTokItem {
  text?: string;
  webVideoUrl?: string;
  diggCount?: number;
  playCount?: number;
  authorMeta?: { nickName?: string };
  videoMeta?: { coverUrl?: string };
  hashtags?: { name?: string }[];
}

export async function fetchTikTok(keywords: string[]): Promise<TikTokItem[]> {
  try {
    const raw = await runActor<RawTikTokItem>("clockworks~tiktok-scraper", {
      searchQueries: keywords,
      searchSection: "/video",
      resultsPerPage: 5,
    });

    return raw
      .filter((item) => item.webVideoUrl && item.videoMeta?.coverUrl)
      .map((item) => ({
        text: item.text,
        webVideoUrl: item.webVideoUrl,
        coverUrl: item.videoMeta?.coverUrl,
        authorNickName: item.authorMeta?.nickName,
        diggCount: item.diggCount,
        playCount: item.playCount,
        hashtags: (item.hashtags ?? [])
          .map((h) => h.name)
          .filter((name): name is string => Boolean(name)),
      }));
  } catch {
    return [];
  }
}

export async function fetchTwitter(
  keywords: string[]
): Promise<TwitterItem[]> {
  try {
    return await runActor<TwitterItem>(
      "data-slayer~twitter-trends-by-location",
      {
        keywords,
        country: "Brazil",
      }
    );
  } catch {
    return [];
  }
}

interface RawNewsResult {
  title?: string;
  link?: string;
  source?: string;
  snippet?: string;
  date?: string;
}

// Cada item do dataset representa uma página de busca, com os resultados de
// notícia de verdade aninhados em news_results[] (não um item plano por notícia).
interface RawNewsPage {
  error?: boolean;
  news_results?: RawNewsResult[];
}

// Uma query só com todos os keywords juntos costuma ficar longa demais e não
// bate com nada no Google News. Buscamos por keyword separadamente e juntamos
// os resultados (dedupe por link) pra cobrir mais terreno.
export async function fetchNews(keywords: string[]): Promise<NewsItem[]> {
  const queries = keywords.slice(0, 3);

  const results = await Promise.all(
    queries.map((q) =>
      runActor<RawNewsPage>("johnvc~GoogleNewsAPI", {
        q,
        gl: "BR",
        max_pages: 1,
      }).catch(() => [] as RawNewsPage[])
    )
  );

  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const page of results.flat()) {
    if (page.error) continue;
    for (const item of page.news_results ?? []) {
      if (!item.title || !item.link || seen.has(item.link)) continue;
      seen.add(item.link);
      merged.push({
        title: item.title,
        link: item.link,
        source: item.source,
        snippet: item.snippet,
        date: item.date,
      });
    }
  }
  return merged;
}

// Reddit é nossa fonte "under the radar" pra sinal fraco: em vez de busca
// global cega por palavra-chave (pouco sinal útil), monitoramos megacomunidades
// BR fixas, cada uma cobrindo um território de comportamento diferente —
// lifestyle real, desabafos, conexão/home office, cultura pop/streaming e
// perrengues de viagem. O insight de verdade mora nos comentários mais votados.
const REDDIT_SUBREDDITS = [
  "eu_nvr",
  "conversas",
  "InternetBrasil",
  "gamesEcultura",
  "viagens",
];

interface RawRedditComment {
  body?: string;
  upVotes?: number;
}

interface RawRedditItem {
  dataType?: string;
  title?: string;
  communityName?: string;
  url?: string;
  permalink?: string;
  upVotes?: number;
  numberOfComments?: number;
  comments?: RawRedditComment[];
}

export async function fetchReddit(): Promise<RedditItem[]> {
  try {
    const raw = await runActor<RawRedditItem>("trudax~reddit-scraper-lite", {
      startUrls: REDDIT_SUBREDDITS.map((sub) => ({
        url: `https://www.reddit.com/r/${sub}/`,
      })),
      sort: "hot",
      time: "day",
      includeMediaLinks: true,
      skipComments: false,
      maxItems: 15,
      maxPostCount: 15,
    });

    return raw
      .filter((item) => item.dataType === "post" && item.title)
      .map((item) => {
        // Pega os 4 comentários mais votados da thread, limpa o texto e "mastiga"
        // a discussão dentro do próprio title — assim o Claude recebe o debate
        // real sem precisarmos mexer na estrutura de tipos do RedditItem.
        const topComentarios = (item.comments ?? [])
          .slice()
          .sort((a, b) => (b.upVotes ?? 0) - (a.upVotes ?? 0))
          .slice(0, 4)
          .map((c) => (c.body ?? "").replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .join(" | ");

        const title = topComentarios
          ? `${item.title} [Fórum/Discussão Real: ${topComentarios}]`
          : item.title;

        return {
          title,
          communityName: item.communityName,
          url: item.url ?? item.permalink,
          upVotes: item.upVotes,
          numberOfComments: item.numberOfComments,
        };
      });
  } catch {
    return [];
  }
}

export type SourceName = "instagram" | "tiktok" | "twitter" | "news" | "reddit";

// As 5 fontes rodam em paralelo (Promise.all), então não têm uma ordem fixa
// de conclusão — o onProgress é chamado assim que CADA UMA termina (sucesso
// ou falha tratada), na ordem real em que os scrapers respondem. É isso que
// alimenta a barra de progresso real na interface (ver ProcessLoader).
async function track<T>(
  name: SourceName,
  promise: Promise<T>,
  onProgress?: (source: SourceName) => void
): Promise<T> {
  const result = await promise;
  onProgress?.(name);
  return result;
}

export async function collectAll(
  keywords: string[],
  onProgress?: (source: SourceName) => void
): Promise<RawData> {
  const [instagram, tiktok, twitter, news, reddit] = await Promise.all([
    track("instagram", fetchInstagram(), onProgress),
    track("tiktok", fetchTikTok(keywords), onProgress),
    track("twitter", fetchTwitter(keywords), onProgress),
    track("news", fetchNews(keywords), onProgress),
    track("reddit", fetchReddit(), onProgress),
  ]);

  return { instagram, tiktok, twitter, news, reddit };
}

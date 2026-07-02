import type {
  InstagramItem,
  NewsItem,
  RawData,
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

export async function fetchNews(keywords: string[]): Promise<NewsItem[]> {
  try {
    return await runActor<NewsItem>("johnvc~GoogleNewsAPI", {
      q: keywords.join(" "),
      gl: "BR",
      max_pages: 2,
    });
  } catch {
    return [];
  }
}

export async function collectAll(keywords: string[]): Promise<RawData> {
  const [instagram, tiktok, twitter, news] = await Promise.all([
    fetchInstagram(),
    fetchTikTok(keywords),
    fetchTwitter(keywords),
    fetchNews(keywords),
  ]);

  return { instagram, tiktok, twitter, news };
}

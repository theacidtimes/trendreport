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

export async function fetchInstagram(
  keywords: string[]
): Promise<InstagramItem[]> {
  try {
    return await runActor<InstagramItem>("apify~instagram-scraper", {
      hashtags: keywords,
      resultsLimit: 20,
    });
  } catch {
    return [];
  }
}

export async function fetchTikTok(keywords: string[]): Promise<TikTokItem[]> {
  try {
    return await runActor<TikTokItem>(
      "khadinakbar~tiktok-trending-hashtags-scraper",
      {
        keywords,
        country: "BR",
        maxItems: 20,
      }
    );
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
    fetchInstagram(keywords),
    fetchTikTok(keywords),
    fetchTwitter(keywords),
    fetchNews(keywords),
  ]);

  return { instagram, tiktok, twitter, news };
}

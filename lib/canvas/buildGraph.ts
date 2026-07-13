import { SupabaseClient } from "@supabase/supabase-js";
import { embedDocuments } from "@/lib/radar/embeddings";
import type { TrendDrop } from "@/lib/types";

// Um drop individual — vive dentro de um tema, exibido no painel lateral ao clicar.
export interface CanvasDrop {
  id: string;
  titulo: string;
  descricao: string | null;
  gancho: string | null;
  hype: number;
  status: TrendDrop["status_hype"] | null;
  categoria: TrendDrop["categoria_funil"] | null;
  fontes: string[];
}

export interface CanvasNode {
  id: string;
  type: "core" | "theme";
  label: string;
  x: number;
  y: number;
  // campos de tema (vazios no núcleo)
  size: number;
  funnel: "growth" | "base" | "mixed" | null;
  hypeAvg: number;
  hypeMax: number;
  keywords: string[];
  drops: CanvasDrop[];
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  kind: "spine" | "web"; // spine = núcleo→tema; web = tema↔tema (correlação)
}

export interface CanvasGraph {
  marca: { id: string; nome: string };
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  meta: { semantic: boolean; themes: number; drops: number };
}

// Granularidade dos temas: alvo de ~4 drops por tema, entre 3 e 12 temas.
// Não force-agrupa: linkagem média (UPGMA) evita o "componente gigante" que
// o single-linkage por percolação criava (um tema com 33, o resto solto).
const TARGET_SIZE = 4;
const K_MIN = 3;
const K_MAX = 12;
const WEB_MIN = 0.42; // liga dois temas na teia acima disso (cosine dos centróides)
const WEB_PER_NODE = 2; // cada tema mostra até N correlações mais fortes

function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// Union-find pra agrupar drops semanticamente conectados.
class DSU {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]];
      i = this.parent[i];
    }
    return i;
  }
  union(a: number, b: number) {
    this.parent[this.find(a)] = this.find(b);
  }
}

function normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  n = Math.sqrt(n) || 1;
  return v.map((x) => x / n);
}

// Agrupamento aglomerativo por linkagem média (UPGMA) sobre similaridade cosseno.
// A cada passo funde o par de clusters mais semanticamente próximo — sem
// encadeamento, então não colapsa tudo num único tema. Truque: com vetores
// unitários, a similaridade média entre A e B = dot(somaA, somaB)/(|A|·|B|),
// então basta manter o vetor-soma de cada cluster.
function agglomerate(vectors: number[][], kTarget: number): number[][] {
  const n = vectors.length;
  if (n === 0) return [];
  const unit = vectors.map(normalize);
  const dim = unit[0].length;

  const members: (number[] | null)[] = unit.map((_, i) => [i]);
  const sum: (number[] | null)[] = unit.map((v) => v.slice());
  const size = new Array(n).fill(1);
  let active = n;

  const avgSim = (a: number, b: number) => {
    const sa = sum[a]!;
    const sb = sum[b]!;
    let s = 0;
    for (let k = 0; k < dim; k++) s += sa[k] * sb[k];
    return s / (size[a] * size[b]);
  };

  while (active > kTarget) {
    let bi = -1;
    let bj = -1;
    let best = -Infinity;
    for (let i = 0; i < n; i++) {
      if (!members[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!members[j]) continue;
        const s = avgSim(i, j);
        if (s > best) {
          best = s;
          bi = i;
          bj = j;
        }
      }
    }
    if (bi === -1) break;
    members[bi] = members[bi]!.concat(members[bj]!);
    const sa = sum[bi]!;
    const sb = sum[bj]!;
    for (let k = 0; k < dim; k++) sa[k] += sb[k];
    size[bi] += size[bj];
    members[bj] = null;
    sum[bj] = null;
    active--;
  }

  return members.filter((m): m is number[] => m !== null);
}

// Cache por processo: re-embedar a cada navegação é desperdício. Chaveado por
// marca + assinatura dos drops (contagem + drop mais recente).
const cache = new Map<string, number[][]>();

async function getDropVectors(
  marcaId: string,
  drops: TrendDrop[]
): Promise<number[][] | null> {
  const signature = `${marcaId}:${drops.length}:${drops[0]?.created_at ?? ""}`;
  const cached = cache.get(signature);
  if (cached) return cached;

  try {
    const texts = drops.map((d) =>
      d.descricao_fato
        ? `${d.insight_titulo}\n${d.descricao_fato}`
        : d.insight_titulo
    );
    const vectors = await embedDocuments(texts);
    cache.set(signature, vectors);
    return vectors;
  } catch (err) {
    console.error("[CANVAS] embedding indisponível, usando fallback:", err);
    return null;
  }
}

// ─── Rótulos de tema ──────────────────────────────────────────
// Extraídos do TEXTO REAL dos drops via c-TF-IDF (termo frequente no cluster,
// raro no resto). Nunca inventado — é destilação, não geração.

const STOP = new Set([
  "a","o","as","os","um","uma","uns","umas","de","do","da","dos","das","em",
  "no","na","nos","nas","por","pra","para","per","com","sem","sob","sobre",
  "ao","aos","à","às","e","ou","mas","que","se","como","quando","onde","porque",
  "não","sim","já","ainda","mais","menos","muito","pouco","tão","também","só",
  "é","era","foi","ser","está","estar","tem","ter","vai","virou","vira","fica",
  "seu","sua","seus","suas","meu","minha","este","esta","isso","esse","essa",
  "ele","ela","eles","elas","você","voce","nós","nos","lhe","the","of","and",
  "to","in","on","for","is","are","o_que","quem","qual","cada","entre","até",
  "quer","pode","deve","faz","fazer","vem","vira","dá","dar","virou","numa","num",
  // preenchimento de baixo sinal — não são tema, só ruído de frequência
  "todo","toda","todos","todas","outro","outra","outros","outras","depois","antes",
  "agora","aqui","ali","lá","então","assim","cada","qualquer","algum","alguma",
  "nada","tudo","bem","mal","novo","nova","grande","primeiro","primeira","último",
  "última","dois","duas","três","ano","anos","dia","dias","vez","vezes","gente",
  "coisa","coisas","pessoa","pessoas","hoje","ontem","semana","mês","mes","aí",
  "porém","porem","enquanto","apenas","talvez","logo","toda","sendo","havia",
]);

const strip = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function tokensOf(text: string, brandTokens: Set<string>): string[] {
  const raw = (text.match(/[a-zà-ÿ0-9]+/gi) ?? []).map((t) => t.toLowerCase());
  return raw.filter(
    (t) =>
      t.length >= 3 &&
      !/^\d+$/.test(t) &&
      !STOP.has(t) &&
      !STOP.has(strip(t)) &&
      !brandTokens.has(strip(t))
  );
}

// Gera termos (unigramas + bigramas adjacentes) de um texto, preservando a forma
// de exibição mais comum por chave normalizada.
function termsOf(
  text: string,
  brandTokens: Set<string>
): { key: string; display: string }[] {
  const toks = tokensOf(text, brandTokens);
  const out: { key: string; display: string }[] = [];
  for (let i = 0; i < toks.length; i++) {
    out.push({ key: strip(toks[i]), display: toks[i] });
    if (i + 1 < toks.length) {
      out.push({
        key: `${strip(toks[i])} ${strip(toks[i + 1])}`,
        display: `${toks[i]} ${toks[i + 1]}`,
      });
    }
  }
  return out;
}

const titleCase = (s: string) =>
  s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

// c-TF-IDF: cada cluster é um "documento". Score = freq no cluster * idf entre clusters.
function labelClusters(
  clusters: number[][],
  drops: TrendDrop[],
  brandTokens: Set<string>
): { label: string; keywords: string[] }[] {
  const N = clusters.length;
  // termos por cluster (com forma de exibição mais frequente)
  const perCluster = clusters.map((members) => {
    const tf = new Map<string, number>();
    const cdf = new Map<string, number>(); // em quantos drops do cluster o termo aparece
    const display = new Map<string, Map<string, number>>();
    for (const idx of members) {
      const text = `${drops[idx].insight_titulo} ${drops[idx].descricao_fato ?? ""}`;
      const seenInDoc = new Set<string>();
      for (const { key, display: d } of termsOf(text, brandTokens)) {
        tf.set(key, (tf.get(key) ?? 0) + 1);
        if (!seenInDoc.has(key)) {
          cdf.set(key, (cdf.get(key) ?? 0) + 1);
          seenInDoc.add(key);
        }
        if (!display.has(key)) display.set(key, new Map());
        const dm = display.get(key)!;
        dm.set(d, (dm.get(d) ?? 0) + 1);
      }
    }
    return { tf, cdf, display, size: members.length };
  });

  // document frequency entre clusters
  const df = new Map<string, number>();
  for (const { tf } of perCluster) {
    for (const key of Array.from(tf.keys()))
      df.set(key, (df.get(key) ?? 0) + 1);
  }

  return perCluster.map(({ tf, cdf, display, size }) => {
    // um termo só nomeia o tema se aparecer em ≥2 drops dele (temas pequenos
    // aceitam 1). Corta fragmentos de um único drop que viravam rótulo por acaso.
    const minSupport = size >= 3 ? 2 : 1;
    const ranked = Array.from(tf.entries())
      .filter(([key]) => (cdf.get(key) ?? 0) >= minSupport)
      .map(([key, freq]) => {
        const isBigram = key.includes(" ");
        const idf = Math.log(1 + N / (df.get(key) ?? 1));
        // bigramas ganham leve preferência: leem melhor como tema
        const score = freq * idf * (isBigram ? 1.35 : 1);
        return { key, score, isBigram };
      })
      .sort((a, b) => b.score - a.score);

    const chosen: string[] = [];
    const used = new Set<string>();
    for (const { key } of ranked) {
      if (chosen.length >= 3) break;
      const parts = key.split(" ");
      // evita repetir um unigrama já contido num bigrama escolhido (e vice-versa)
      if (parts.some((p: string) => used.has(p))) continue;
      const dm = display.get(key)!;
      const bestDisplay = Array.from(dm.entries()).sort(
        (a, b) => b[1] - a[1]
      )[0][0];
      chosen.push(titleCase(bestDisplay));
      parts.forEach((p: string) => used.add(p));
    }

    const keywords = chosen;
    const label = keywords.length ? keywords.join(" · ") : "";
    return { label, keywords };
  });
}

// ─── Layout radial ────────────────────────────────────────────
// Núcleo no centro; temas num anel ao redor, ordenados por tamanho.
function layout(count: number): { x: number; y: number }[] {
  const radius = Math.max(360, count * 62);
  const pos: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / Math.max(count, 1) - Math.PI / 2;
    pos.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return pos;
}

function coreNode(marca: { id: string; nome: string }): CanvasNode {
  return {
    id: "core",
    type: "core",
    label: marca.nome,
    x: 0,
    y: 0,
    size: 0,
    funnel: null,
    hypeAvg: 0,
    hypeMax: 0,
    keywords: [],
    drops: [],
  };
}

export async function buildCanvasGraph(
  supabase: SupabaseClient,
  marcaId: string
): Promise<CanvasGraph | null> {
  const { data: marca } = await supabase
    .from("marcas")
    .select("id, nome")
    .eq("id", marcaId)
    .single();

  if (!marca) return null;

  const { data: dropData } = await supabase
    .from("trends_radar")
    .select(
      "id, insight_titulo, descricao_fato, gancho_produto, status_hype, indice_hype, categoria_funil, links_fontes, created_at"
    )
    .eq("marca_id", marcaId)
    .order("created_at", { ascending: false });

  const drops = (dropData ?? []) as TrendDrop[];

  if (drops.length === 0) {
    return {
      marca: { id: marca.id, nome: marca.nome },
      nodes: [coreNode(marca)],
      edges: [],
      meta: { semantic: false, themes: 0, drops: 0 },
    };
  }

  const brandTokens = new Set(
    (marca.nome as string)
      .toLowerCase()
      .split(/\s+/)
      .map((t: string) => strip(t))
      .filter(Boolean)
  );

  const vectors = await getDropVectors(marcaId, drops);
  let clusters: number[][];

  if (vectors) {
    const kTarget = Math.min(
      drops.length,
      Math.max(K_MIN, Math.min(K_MAX, Math.round(drops.length / TARGET_SIZE)))
    );
    clusters = agglomerate(vectors, kTarget).sort((a, b) => b.length - a.length);
  } else {
    // fallback estrutural: agrupa por categoria+status ou fonte compartilhada
    const dsu = new DSU(drops.length);
    const urlOf = (d: TrendDrop) => new Set(d.links_fontes ?? []);
    for (let i = 0; i < drops.length; i++) {
      for (let j = i + 1; j < drops.length; j++) {
        const sameBucket =
          drops[i].categoria_funil === drops[j].categoria_funil &&
          drops[i].status_hype === drops[j].status_hype;
        const jUrls = urlOf(drops[j]);
        const shared = Array.from(urlOf(drops[i])).some((u) => jUrls.has(u));
        if (sameBucket || shared) dsu.union(i, j);
      }
    }
    const groups = new Map<number, number[]>();
    for (let i = 0; i < drops.length; i++) {
      const r = dsu.find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r)!.push(i);
    }
    clusters = Array.from(groups.values()).sort((a, b) => b.length - a.length);
  }

  const labels = labelClusters(clusters, drops, brandTokens);
  const pos = layout(clusters.length);

  // centróides por cluster pra teia entre temas
  const centroids: (number[] | null)[] = clusters.map((members) => {
    if (!vectors) return null;
    const dim = vectors[0].length;
    const c = new Array(dim).fill(0);
    for (const idx of members)
      for (let k = 0; k < dim; k++) c[k] += vectors[idx][k];
    for (let k = 0; k < dim; k++) c[k] /= members.length;
    return c;
  });

  const themeNodes: CanvasNode[] = clusters.map((members, ci) => {
    let growth = 0;
    let hypeSum = 0;
    let hypeMax = 0;
    const themeDrops: CanvasDrop[] = members.map((idx) => {
      const d = drops[idx];
      const h = d.indice_hype ?? 0;
      if (d.categoria_funil === "growth") growth++;
      hypeSum += h;
      hypeMax = Math.max(hypeMax, h);
      return {
        id: d.id,
        titulo: d.insight_titulo,
        descricao: d.descricao_fato,
        gancho: d.gancho_produto,
        hype: h,
        status: d.status_hype,
        categoria: d.categoria_funil,
        fontes: d.links_fontes ?? [],
      };
    });
    themeDrops.sort((a, b) => b.hype - a.hype);

    const total = members.length;
    const share = growth / total;
    const funnel: CanvasNode["funnel"] =
      share >= 0.6 ? "growth" : share <= 0.4 ? "base" : "mixed";

    const label =
      labels[ci].label || themeDrops[0]?.titulo.slice(0, 40) || "Tema";

    return {
      id: `theme-${ci}`,
      type: "theme" as const,
      label,
      x: pos[ci].x,
      y: pos[ci].y,
      size: total,
      funnel,
      hypeAvg: Math.round(hypeSum / total),
      hypeMax,
      keywords: labels[ci].keywords,
      drops: themeDrops,
    };
  });

  const nodes: CanvasNode[] = [coreNode(marca), ...themeNodes];

  // espinha: núcleo → cada tema
  const spine: CanvasEdge[] = themeNodes.map((t) => ({
    id: `spine-${t.id}`,
    source: "core",
    target: t.id,
    weight: 0.3,
    kind: "spine" as const,
  }));

  // teia: cada tema liga aos vizinhos mais fortes acima do limiar (esparso, mas
  // mostra correlações múltiplas — não só o vínculo #1)
  const web: CanvasEdge[] = [];
  const seen = new Set<string>();
  if (vectors) {
    for (let i = 0; i < clusters.length; i++) {
      if (!centroids[i]) continue;
      const neigh: { j: number; s: number }[] = [];
      for (let j = 0; j < clusters.length; j++) {
        if (i === j || !centroids[j]) continue;
        const s = cosine(centroids[i]!, centroids[j]!);
        if (s >= WEB_MIN) neigh.push({ j, s });
      }
      neigh.sort((a, b) => b.s - a.s);
      for (const { j, s } of neigh.slice(0, WEB_PER_NODE)) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        web.push({
          id: `web-${key}`,
          source: `theme-${i}`,
          target: `theme-${j}`,
          weight: s,
          kind: "web",
        });
      }
    }
  } else {
    // fallback: liga temas que compartilham alguma fonte
    for (let i = 0; i < clusters.length; i++) {
      const iUrls = new Set(
        clusters[i].flatMap((idx) => drops[idx].links_fontes ?? [])
      );
      for (let j = i + 1; j < clusters.length; j++) {
        const shared = clusters[j].some((idx) =>
          (drops[idx].links_fontes ?? []).some((u) => iUrls.has(u))
        );
        if (shared) {
          web.push({
            id: `web-${i}-${j}`,
            source: `theme-${i}`,
            target: `theme-${j}`,
            weight: 0.5,
            kind: "web",
          });
        }
      }
    }
  }

  return {
    marca: { id: marca.id, nome: marca.nome },
    nodes,
    edges: [...spine, ...web],
    meta: { semantic: !!vectors, themes: clusters.length, drops: drops.length },
  };
}

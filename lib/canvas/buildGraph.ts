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
  criado: string;
}

export interface CanvasNode {
  id: string;
  type: "core" | "theme";
  label: string;
  // campos de tema (vazios no núcleo)
  size: number;
  funnel: "growth" | "base" | "mixed" | null;
  hypeAvg: number;
  hypeMax: number;
  keywords: string[];
  drops: CanvasDrop[];
  ultimo: string | null; // data do drop mais recente do tema
  avulso: boolean; // true = balde dos drops que não se repetiram
}

export interface CanvasGraph {
  marca: { id: string; nome: string };
  nodes: CanvasNode[];
  meta: { semantic: boolean; themes: number; drops: number; janelaDias: number | null };
}

// Granularidade dos temas: alvo de ~8 drops por tema, entre 4 e 12 temas —
// mais que isso vira uma coluna ilegível na árvore. Linkagem média (UPGMA)
// evita o "componente gigante" do single-linkage. O teto por tema é alto de
// propósito: tema grande é assunto que VOLTA, e é esse o sinal que interessa;
// com teto 8 a Vivo virava 60+ temas de 1-3 drops.
const TARGET_SIZE = 8;
const K_MIN = 4;
const K_MAX = 12;
const MAX_THEME = 24;

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

// 2-means esférico (cosseno) pra dividir um tema. Sementes = par mais oposto do
// grupo, depois algumas iterações de Lloyd. Determinístico entre navegações.
function bisect(idxs: number[], unit: number[][], dim: number): [number[], number[]] {
  const dot = (a: number[], b: number[]) => {
    let s = 0;
    for (let k = 0; k < dim; k++) s += a[k] * b[k];
    return s;
  };
  let a = idxs[0];
  let b = idxs[1] ?? idxs[0];
  let worst = Infinity;
  for (let x = 0; x < idxs.length; x++)
    for (let y = x + 1; y < idxs.length; y++) {
      const s = dot(unit[idxs[x]], unit[idxs[y]]);
      if (s < worst) {
        worst = s;
        a = idxs[x];
        b = idxs[y];
      }
    }
  let ca = unit[a].slice();
  let cb = unit[b].slice();
  let g1: number[] = [];
  let g2: number[] = [];
  const centroid = (g: number[]) => {
    const c = new Array(dim).fill(0);
    for (const i of g) for (let k = 0; k < dim; k++) c[k] += unit[i][k];
    return normalize(c);
  };
  for (let it = 0; it < 4; it++) {
    g1 = [];
    g2 = [];
    for (const i of idxs) (dot(unit[i], ca) >= dot(unit[i], cb) ? g1 : g2).push(i);
    if (!g1.length || !g2.length) break;
    ca = centroid(g1);
    cb = centroid(g2);
  }
  if (!g1.length || !g2.length) {
    const mid = Math.ceil(idxs.length / 2);
    return [idxs.slice(0, mid), idxs.slice(mid)];
  }
  return [g1, g2];
}

// Nenhum tema domina o mapa: divide recursivamente qualquer cluster acima do
// teto até todos caberem — o "blob" de 23 vira 3 sub-temas coerentes.
function capThemeSizes(
  clusters: number[][],
  vectors: number[][],
  maxTheme: number
): number[][] {
  const dim = vectors[0].length;
  const unit = vectors.map(normalize);
  const out: number[][] = [];
  const queue = [...clusters];
  while (queue.length) {
    const c = queue.pop()!;
    if (c.length > maxTheme) {
      const [x, y] = bisect(c, unit, dim);
      if (x.length && y.length && x.length < c.length && y.length < c.length) {
        queue.push(x, y);
        continue;
      }
    }
    out.push(c);
  }
  return out;
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

function coreNode(marca: { id: string; nome: string }): CanvasNode {
  return {
    id: "core",
    type: "core",
    label: marca.nome,
    size: 0,
    funnel: null,
    hypeAvg: 0,
    hypeMax: 0,
    keywords: [],
    drops: [],
    ultimo: null,
    avulso: false,
  };
}

export async function buildCanvasGraph(
  supabase: SupabaseClient,
  marcaId: string,
  janelaDias: number | null = 30
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
    .gte(
      "created_at",
      janelaDias ? new Date(Date.now() - janelaDias * 86_400_000).toISOString() : "1970-01-01"
    )
    .order("created_at", { ascending: false });

  const drops = (dropData ?? []) as TrendDrop[];

  if (drops.length === 0) {
    return {
      marca: { id: marca.id, nome: marca.nome },
      nodes: [coreNode(marca)],
      meta: { semantic: false, themes: 0, drops: 0, janelaDias },
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
    clusters = capThemeSizes(
      agglomerate(vectors, kTarget),
      vectors,
      MAX_THEME
    ).sort((a, b) => b.length - a.length);
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

  // Drop que não se repetiu não é tema: vai pro balde "avulsos" no fim da
  // coluna, em vez de ocupar um nó por drop.
  const recorrentes = clusters.filter((c) => c.length >= 2);
  const avulsos = clusters.filter((c) => c.length < 2).flat();

  const labels = labelClusters(recorrentes, drops, brandTokens);

  const themeNodes: CanvasNode[] = recorrentes.map((members, ci) => {
    const node = themeNode(`theme-${ci}`, members, drops);
    // Rótulo = título do drop mais central do tema (frase escrita, legível),
    // no lugar da sopa de palavras-chave do c-TF-IDF. Sem vetor, cai nela.
    const rep = vectors ? representante(members, vectors) : null;
    node.label =
      (rep !== null ? drops[rep].insight_titulo : labels[ci].label) ||
      node.drops[0]?.titulo ||
      "Tema";
    node.keywords = labels[ci].keywords;
    return node;
  });

  if (avulsos.length > 0) {
    const node = themeNode("theme-avulsos", avulsos, drops);
    node.label = "Drops que ainda não se repetiram";
    node.avulso = true;
    themeNodes.push(node);
  }

  return {
    marca: { id: marca.id, nome: marca.nome },
    nodes: [coreNode(marca), ...themeNodes],
    meta: {
      semantic: !!vectors,
      themes: recorrentes.length,
      drops: drops.length,
      janelaDias,
    },
  };
}

function themeNode(id: string, members: number[], drops: TrendDrop[]): CanvasNode {
  let growth = 0;
  let hypeSum = 0;
  let hypeMax = 0;
  let ultimo = "";
  const themeDrops: CanvasDrop[] = members.map((idx) => {
    const d = drops[idx];
    const h = d.indice_hype ?? 0;
    if (d.categoria_funil === "growth") growth++;
    hypeSum += h;
    hypeMax = Math.max(hypeMax, h);
    if (d.created_at > ultimo) ultimo = d.created_at;
    return {
      id: d.id,
      titulo: d.insight_titulo,
      descricao: d.descricao_fato,
      gancho: d.gancho_produto,
      hype: h,
      status: d.status_hype,
      categoria: d.categoria_funil,
      fontes: d.links_fontes ?? [],
      criado: d.created_at,
    };
  });
  // mais recente primeiro: a coluna de drops conta a história do tema
  themeDrops.sort((a, b) => b.criado.localeCompare(a.criado));

  const total = members.length;
  const share = growth / total;
  return {
    id,
    type: "theme",
    label: "",
    size: total,
    funnel: share >= 0.6 ? "growth" : share <= 0.4 ? "base" : "mixed",
    hypeAvg: Math.round(hypeSum / total),
    hypeMax,
    keywords: [],
    drops: themeDrops,
    ultimo: ultimo || null,
    avulso: false,
  };
}

// Drop mais próximo do centróide do tema: o que melhor o resume.
function representante(members: number[], vectors: number[][]): number {
  const dim = vectors[0].length;
  const c = new Array(dim).fill(0);
  for (const i of members) {
    const u = normalize(vectors[i]);
    for (let k = 0; k < dim; k++) c[k] += u[k];
  }
  let best = members[0];
  let bestSim = -Infinity;
  for (const i of members) {
    const s = cosine(vectors[i], c);
    if (s > bestSim) {
      bestSim = s;
      best = i;
    }
  }
  return best;
}

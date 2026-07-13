import { SupabaseClient } from "@supabase/supabase-js";
import { embedDocuments } from "@/lib/radar/embeddings";
import type { TrendDrop } from "@/lib/types";

export interface CanvasNode {
  id: string;
  type: "core" | "drop";
  label: string;
  x: number;
  y: number;
  cluster: number;
  hype: number;
  status: TrendDrop["status_hype"] | null;
  categoria: TrendDrop["categoria_funil"] | null;
  descricao: string | null;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  kind: "semantic" | "core";
}

export interface CanvasGraph {
  marca: { id: string; nome: string };
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  meta: { semantic: boolean; clusters: number; drops: number };
}

const NEIGHBORS_K = 3;
const EDGE_MIN = 0.4; // arestas semânticas desenhadas acima disso
const CLUSTER_MIN = 0.64; // une dois drops no mesmo agrupamento acima disso

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

// Distribui as posições: núcleo no centro, um anel por agrupamento, drops
// dispostos num círculo interno ao redor do centro do cluster.
function layout(
  clusters: number[][] // índices de drops por cluster
): Map<number, { x: number; y: number }> {
  const pos = new Map<number, { x: number; y: number }>();
  const C = clusters.length;
  const clusterRadius = 460;

  clusters.forEach((members, ci) => {
    const angle = (2 * Math.PI * ci) / Math.max(C, 1) - Math.PI / 2;
    const cx = Math.cos(angle) * clusterRadius;
    const cy = Math.sin(angle) * clusterRadius;
    const inner = 70 + members.length * 16;

    members.forEach((idx, mi) => {
      if (members.length === 1) {
        pos.set(idx, { x: cx, y: cy });
      } else {
        const a = (2 * Math.PI * mi) / members.length;
        pos.set(idx, {
          x: cx + Math.cos(a) * inner,
          y: cy + Math.sin(a) * inner,
        });
      }
    });
  });

  return pos;
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
      "id, insight_titulo, descricao_fato, status_hype, indice_hype, categoria_funil, links_fontes, created_at"
    )
    .eq("marca_id", marcaId)
    .order("created_at", { ascending: false });

  const drops = (dropData ?? []) as TrendDrop[];

  if (drops.length === 0) {
    return {
      marca: { id: marca.id, nome: marca.nome },
      nodes: [
        {
          id: "core",
          type: "core",
          label: marca.nome,
          x: 0,
          y: 0,
          cluster: -1,
          hype: 0,
          status: null,
          categoria: null,
          descricao: null,
        },
      ],
      edges: [],
      meta: { semantic: false, clusters: 0, drops: 0 },
    };
  }

  const vectors = await getDropVectors(marcaId, drops);
  const dsu = new DSU(drops.length);
  const semanticEdges: CanvasEdge[] = [];
  const seen = new Set<string>();

  if (vectors) {
    // top-K vizinhos semânticos por drop
    for (let i = 0; i < drops.length; i++) {
      const sims: { j: number; s: number }[] = [];
      for (let j = 0; j < drops.length; j++) {
        if (i === j) continue;
        sims.push({ j, s: cosine(vectors[i], vectors[j]) });
      }
      sims.sort((a, b) => b.s - a.s);
      for (const { j, s } of sims.slice(0, NEIGHBORS_K)) {
        if (s < EDGE_MIN) break;
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (seen.has(key)) continue;
        seen.add(key);
        semanticEdges.push({
          id: `e-${key}`,
          source: drops[i].id,
          target: drops[j].id,
          weight: s,
          kind: "semantic",
        });
        if (s >= CLUSTER_MIN) dsu.union(i, j);
      }
    }
  } else {
    // fallback estrutural: liga drops que compartilham categoria + status ou fonte
    const urlOf = (d: TrendDrop) => new Set(d.links_fontes ?? []);
    for (let i = 0; i < drops.length; i++) {
      for (let j = i + 1; j < drops.length; j++) {
        const sameBucket =
          drops[i].categoria_funil === drops[j].categoria_funil &&
          drops[i].status_hype === drops[j].status_hype;
        const jUrls = urlOf(drops[j]);
        const shared = Array.from(urlOf(drops[i])).some((u) => jUrls.has(u));
        if (sameBucket || shared) {
          semanticEdges.push({
            id: `e-${i}-${j}`,
            source: drops[i].id,
            target: drops[j].id,
            weight: shared ? 0.7 : 0.5,
            kind: "semantic",
          });
          dsu.union(i, j);
        }
      }
    }
  }

  // agrupa índices por raiz do union-find
  const groups = new Map<number, number[]>();
  for (let i = 0; i < drops.length; i++) {
    const r = dsu.find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(i);
  }
  const clusters: number[][] = Array.from(groups.values());
  const clusterOf = new Map<number, number>();
  clusters.forEach((members, ci) =>
    members.forEach((idx: number) => clusterOf.set(idx, ci))
  );

  const pos = layout(clusters);

  const nodes: CanvasNode[] = [
    {
      id: "core",
      type: "core",
      label: marca.nome,
      x: 0,
      y: 0,
      cluster: -1,
      hype: 0,
      status: null,
      categoria: null,
      descricao: null,
    },
    ...drops.map((d, i) => {
      const p = pos.get(i) ?? { x: 0, y: 0 };
      return {
        id: d.id,
        type: "drop" as const,
        label: d.insight_titulo,
        x: p.x,
        y: p.y,
        cluster: clusterOf.get(i) ?? 0,
        hype: d.indice_hype ?? 0,
        status: d.status_hype,
        categoria: d.categoria_funil,
        descricao: d.descricao_fato,
      };
    }),
  ];

  // liga o núcleo ao drop de maior hype de cada cluster, pendurando o grafo
  const coreEdges: CanvasEdge[] = clusters.map((members, ci) => {
    const hub = members.reduce((best: number, idx: number) =>
      (drops[idx].indice_hype ?? 0) > (drops[best].indice_hype ?? 0) ? idx : best
    );
    return {
      id: `core-${ci}`,
      source: "core",
      target: drops[hub].id,
      weight: 0.3,
      kind: "core" as const,
    };
  });

  return {
    marca: { id: marca.id, nome: marca.nome },
    nodes,
    edges: [...coreEdges, ...semanticEdges],
    meta: { semantic: !!vectors, clusters: clusters.length, drops: drops.length },
  };
}

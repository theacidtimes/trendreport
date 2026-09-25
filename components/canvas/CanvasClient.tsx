"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  useReactFlow,
  useNodesInitialized,
  useNodesState,
  useEdgesState,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileJson,
  Sparkles,
  X,
  ExternalLink,
} from "lucide-react";
import type { CanvasGraph, CanvasDrop, CanvasNode } from "@/lib/canvas/buildGraph";

// ─── Árvore da esquerda pra direita ───────────────────────────
// Marca → tema → drop, abrindo um nível por clique; o drop abre no painel.
// Substitui a mandala: o anel mostrava tudo de uma vez e não dava por onde
// começar. Aqui cada coluna responde uma pergunta e só o caminho aberto aparece.
// Contraste é requisito: título em --white, texto de apoio em --muted (nunca
// --muted-2, que fica abaixo de 4.5:1 no fundo escuro) e contorno em --muted-2
// (≥3:1, o mínimo pra borda de componente).

const FUNNEL_COLOR: Record<string, string> = {
  growth: "var(--lime)",
  base: "var(--purple)",
  mixed: "#c6a15b",
};
const funnelColor = (f: string | null) => FUNNEL_COLOR[f ?? ""] ?? "var(--muted)";

const FUNNEL_LABEL: Record<string, string> = {
  growth: "growth",
  base: "base",
  mixed: "misto",
};

// Status sempre com rótulo em texto: cor sozinha não carrega significado.
const STATUS: Record<string, { label: string; color: string }> = {
  em_alta: { label: "em alta", color: "var(--lime)" },
  subindo: { label: "subindo", color: "var(--purple)" },
  estabilizando: { label: "estabilizando", color: "var(--muted)" },
  esfriando: { label: "esfriando", color: "var(--muted)" },
};

const OUTLINE = "var(--muted-2)";
const ACTIVE = "var(--purple)";

// Colunas e passos verticais (px). Alturas estimadas só pra centralizar cada
// coluna no pai; o React Flow mede o tamanho real na renderização.
const COL_X = [0, 250, 640];
const H = { core: 76, theme: 110, drop: 100 };
const STEP = { theme: 126, drop: 116 };

const hiddenHandle = { opacity: 0, pointerEvents: "none" } as const;

const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

type CoreData = { label: string; temas: number };
type ThemeData = { theme: CanvasNode; active: boolean };
type DropData = { drop: CanvasDrop; active: boolean };

function CoreNode({ data }: NodeProps<Node<CoreData>>) {
  return (
    <div
      className="rounded-2xl px-4 py-3 text-center"
      style={{ width: 170, background: "var(--surface-2)", border: `2px solid ${ACTIVE}` }}
    >
      <Handle type="source" position={Position.Right} style={hiddenHandle} isConnectable={false} />
      <p className="font-serif text-white font-medium text-lg leading-tight">{data.label}</p>
      <p className="text-[12px] text-muted mt-1">
        {data.temas} {data.temas === 1 ? "tema" : "temas"}
      </p>
    </div>
  );
}

function ThemeNode({ data }: NodeProps<Node<ThemeData>>) {
  const { theme, active } = data;
  const color = theme.avulso ? "var(--muted)" : funnelColor(theme.funnel);
  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-col gap-1.5 cursor-pointer transition-colors hover:bg-surface-3"
      style={{
        width: 320,
        background: active ? "var(--surface-3)" : "var(--surface-2)",
        border: active
          ? `2px solid ${ACTIVE}`
          : `1px ${theme.avulso ? "dashed" : "solid"} ${OUTLINE}`,
      }}
    >
      <Handle type="target" position={Position.Left} style={hiddenHandle} isConnectable={false} />
      <Handle type="source" position={Position.Right} style={hiddenHandle} isConnectable={false} />
      <div className="flex items-center gap-2 text-[11px] text-muted">
        {!theme.avulso && (
          <>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
            <span>{FUNNEL_LABEL[theme.funnel ?? ""] ?? "tema"}</span>
          </>
        )}
        <span className={theme.avulso ? "" : "ml-auto"}>
          <span className="tabular-nums font-medium text-white">{theme.size}</span>{" "}
          {theme.size === 1 ? "drop" : "drops"}
          {theme.ultimo && <> · último {fmtData(theme.ultimo)}</>}
        </span>
      </div>
      <p
        className={`text-[14px] leading-snug font-medium line-clamp-2 ${
          theme.avulso ? "text-muted" : "text-white"
        }`}
      >
        {theme.label}
      </p>
      <div className="flex items-center gap-1 text-[11px] text-muted">
        hype máx <span className="tabular-nums font-medium text-white">{theme.hypeMax}</span>
        <ChevronRight
          className="w-3.5 h-3.5 ml-auto transition-transform"
          style={{ color: active ? ACTIVE : "var(--muted)", transform: active ? "rotate(90deg)" : undefined }}
        />
      </div>
    </div>
  );
}

function DropNode({ data }: NodeProps<Node<DropData>>) {
  const { drop, active } = data;
  const status = STATUS[drop.status ?? ""];
  return (
    <div
      className="rounded-xl px-4 py-3 flex flex-col gap-1.5 cursor-pointer transition-colors hover:bg-surface-3"
      style={{
        width: 320,
        background: active ? "var(--surface-3)" : "var(--surface-2)",
        border: active ? `2px solid ${ACTIVE}` : `1px solid ${OUTLINE}`,
      }}
    >
      <Handle type="target" position={Position.Left} style={hiddenHandle} isConnectable={false} />
      <div className="flex items-center gap-2 text-[11px]">
        {status && (
          <>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: status.color }} />
            <span className="text-muted">{status.label}</span>
          </>
        )}
        <span className="text-muted">· {fmtData(drop.criado)}</span>
        <span className="ml-auto tabular-nums text-muted">
          hype <span className="font-medium text-white">{drop.hype}</span>
        </span>
      </div>
      <p className="text-[13px] leading-snug font-medium text-white line-clamp-2">{drop.titulo}</p>
    </div>
  );
}

const nodeTypes = { core: CoreNode, theme: ThemeNode, drop: DropNode };

// Posiciona só o caminho aberto: todos os temas, e os drops do tema aberto
// centralizados na altura dele.
function buildTree(
  graph: CanvasGraph,
  themeId: string | null,
  dropId: string | null
): { nodes: Node[]; edges: Edge[] } {
  const themes = graph.nodes.filter((n) => n.type === "theme");
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const top = (center: number, h: number) => center - h / 2;
  const column = (count: number, step: number, center: number) =>
    Array.from({ length: count }, (_, i) => center + (i - (count - 1) / 2) * step);

  nodes.push({
    id: "core",
    type: "core",
    position: { x: COL_X[0], y: top(0, H.core) },
    data: { label: graph.marca.nome, temas: themes.length },
    selectable: false,
  });

  const themeY = column(themes.length, STEP.theme, 0);
  themes.forEach((t, i) => {
    const active = t.id === themeId;
    nodes.push({
      id: t.id,
      type: "theme",
      position: { x: COL_X[1], y: top(themeY[i], H.theme) },
      data: { theme: t, active },
    });
    edges.push(edge("core", t.id, active));
  });

  const openTheme = themes.findIndex((t) => t.id === themeId);
  if (openTheme >= 0) {
    const drops = themes[openTheme].drops;
    const dropY = column(drops.length, STEP.drop, themeY[openTheme]);
    drops.forEach((d, i) => {
      const id = `drop-${d.id}`;
      const active = d.id === dropId;
      nodes.push({
        id,
        type: "drop",
        position: { x: COL_X[2], y: top(dropY[i], H.drop) },
        data: { drop: d, active },
      });
      edges.push(edge(themeId!, id, active));
    });
  }

  return { nodes, edges };
}

function edge(source: string, target: string, active: boolean): Edge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: "default",
    focusable: false,
    style: {
      stroke: active ? ACTIVE : OUTLINE,
      strokeWidth: active ? 2 : 1.25,
    },
  };
}

function download(dataUrl: string, name: string) {
  const a = document.createElement("a");
  a.download = name;
  a.href = dataUrl;
  a.click();
}

function MarcaSwitcher({
  marcas,
  activeId,
}: {
  marcas: { id: string; nome: string }[];
  activeId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = marcas.find((m) => m.id === activeId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border bg-surface/90 backdrop-blur pl-4 pr-3 py-1.5 text-white hover:border-white/40 transition-colors"
        style={{ borderColor: OUTLINE }}
      >
        <span className="font-serif text-sm leading-none">
          {active?.nome ?? "Selecionar cliente"}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full left-0 mt-2 z-20 min-w-[200px] max-h-[60vh] overflow-y-auto rounded-2xl border bg-surface-2 p-1.5 shadow-elevated"
            style={{ borderColor: OUTLINE }}
          >
            {marcas.map((m) => {
              const isActive = m.id === activeId;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setOpen(false);
                    if (!isActive) router.push(`/dashboard/mapa/${m.id}${window.location.search}`);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    isActive ? "text-white bg-surface-3" : "text-muted hover:text-white hover:bg-surface-3"
                  }`}
                >
                  <span className="font-serif leading-tight flex-1">{m.nome}</span>
                  {isActive && <Check className="w-3.5 h-3.5 text-lime shrink-0" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const JANELAS: { dias: number | null; label: string }[] = [
  { dias: 14, label: "14 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
  { dias: null, label: "tudo" },
];

function JanelaSwitcher({ atual }: { atual: number | null }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div role="group" aria-label="Janela de tempo" className="flex items-center gap-0.5 border-l pl-2.5" style={{ borderColor: OUTLINE }}>
      {JANELAS.map((j) => {
        const on = j.dias === atual;
        return (
          <button
            key={j.label}
            aria-pressed={on}
            onClick={() => router.push(`${pathname}?janela=${j.dias ?? "tudo"}`)}
            className={`rounded-full px-2 py-0.5 text-[12px] transition-colors ${
              on ? "bg-white text-black font-medium" : "text-muted hover:text-white"
            }`}
          >
            {j.label}
          </button>
        );
      })}
    </div>
  );
}

function Trilha({
  graph,
  theme,
  drop,
  onRoot,
  onTheme,
}: {
  graph: CanvasGraph;
  theme: CanvasNode | undefined;
  drop: CanvasDrop | undefined;
  onRoot: () => void;
  onTheme: () => void;
}) {
  const passo = "hover:text-white transition-colors truncate";
  return (
    <nav
      aria-label="Caminho aberto"
      className="flex items-center gap-1.5 text-[12px] text-muted min-w-0"
    >
      <button onClick={onRoot} className={passo}>{graph.marca.nome}</button>
      {!theme && graph.meta.themes > 0 && <span>· clique num tema para abrir</span>}
      {theme && (
        <>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <button onClick={onTheme} className={`${passo} max-w-[220px] ${drop ? "" : "text-white"}`}>
            {theme.label}
          </button>
        </>
      )}
      {drop && (
        <>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span className="text-white truncate max-w-[260px]">{drop.titulo}</span>
        </>
      )}
    </nav>
  );
}

function Toolbar({
  graph,
  marcas,
  children,
}: {
  graph: CanvasGraph;
  marcas: { id: string; nome: string }[];
  children: React.ReactNode;
}) {
  const { getNodes } = useReactFlow();

  const onExportPng = useCallback(() => {
    const nodes = getNodes();
    if (nodes.length === 0) return;
    const bounds = getNodesBounds(nodes);
    const w = 1920;
    const h = 1200;
    const vp = getViewportForBounds(bounds, w, h, 0.3, 2, 0.12);
    const viewport = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!viewport) return;
    toPng(viewport, {
      backgroundColor: "#0b0b0b",
      width: w,
      height: h,
      style: {
        width: `${w}px`,
        height: `${h}px`,
        transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
      },
    }).then((url) => download(url, `${graph.marca.nome}-mapa.png`));
  }, [getNodes, graph.marca.nome]);

  const onExportJson = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ marca: graph.marca, nodes: graph.nodes }, null, 2)],
      { type: "application/json" }
    );
    download(URL.createObjectURL(blob), `${graph.marca.nome}-mapa.json`);
  }, [graph]);

  const iconBtn =
    "w-9 h-9 rounded-full border bg-surface/90 backdrop-blur text-muted hover:text-white hover:border-white/40 transition-colors grid place-items-center shrink-0";

  return (
    <div className="absolute top-4 left-4 right-4 z-10 flex flex-col gap-2 pointer-events-none">
      <div className="flex items-center gap-2 pointer-events-auto">
        <MarcaSwitcher marcas={marcas} activeId={graph.marca.id} />
        <div
          className="rounded-full border bg-surface/90 backdrop-blur px-4 py-1.5 flex items-center gap-2.5"
          style={{ borderColor: OUTLINE }}
        >
          <span className="text-muted text-[12px]">
            {graph.meta.themes} temas · {graph.meta.drops} drops
          </span>
          <JanelaSwitcher atual={graph.meta.janelaDias} />
          <span
            className="flex items-center gap-1 text-[12px]"
            style={{ color: graph.meta.semantic ? "var(--lime)" : "var(--muted)" }}
          >
            <Sparkles className="w-3 h-3" />
            {graph.meta.semantic ? "semântico" : "estrutural"}
          </span>
        </div>
        <button onClick={onExportPng} className={iconBtn} style={{ borderColor: OUTLINE }} aria-label="Exportar PNG">
          <Download className="w-4 h-4" />
        </button>
        <button onClick={onExportJson} className={iconBtn} style={{ borderColor: OUTLINE }} aria-label="Exportar JSON">
          <FileJson className="w-4 h-4" />
        </button>
      </div>
      <div className="pointer-events-auto pl-1">{children}</div>
    </div>
  );
}

function DropPanel({
  drop,
  theme,
  onClose,
}: {
  drop: CanvasDrop;
  theme: CanvasNode;
  onClose: () => void;
}) {
  const status = STATUS[drop.status ?? ""];
  return (
    <aside
      className="absolute top-0 right-0 z-20 h-full w-full sm:w-[420px] bg-surface-2 border-l flex flex-col shadow-elevated"
      style={{ borderColor: OUTLINE }}
    >
      <div className="flex items-start gap-3 px-5 py-4 border-b" style={{ borderColor: OUTLINE }}>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-muted truncate">{theme.label}</p>
          <h3 className="font-serif text-white text-lg leading-tight mt-1">{drop.titulo}</h3>
          <div className="flex items-center gap-2 mt-2 text-[12px] text-muted">
            {status && (
              <>
                <span className="w-2 h-2 rounded-full" style={{ background: status.color }} />
                {status.label} ·
              </>
            )}
            <span>hype <span className="text-white font-medium tabular-nums">{drop.hype}</span></span>
            <span>· {fmtData(drop.criado)}</span>
            {drop.categoria && <span>· {drop.categoria}</span>}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 grid place-items-center rounded-full text-muted hover:text-white hover:bg-surface-3 transition-colors shrink-0"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
        {drop.descricao && (
          <section>
            <h4 className="text-[12px] text-muted mb-1">O que está acontecendo</h4>
            <p className="text-[14px] leading-relaxed text-white">{drop.descricao}</p>
          </section>
        )}
        {drop.gancho && (
          <section>
            <h4 className="text-[12px] text-muted mb-1">Conexão com a marca</h4>
            <p className="text-[14px] leading-relaxed text-white">{drop.gancho}</p>
          </section>
        )}
        {drop.fontes.length > 0 && (
          <section>
            <h4 className="text-[12px] text-muted mb-2">Fontes</h4>
            <ul className="flex flex-col gap-1.5">
              {drop.fontes.map((url, i) => (
                <li key={i}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] text-white hover:bg-surface-3 transition-colors"
                    style={{ borderColor: OUTLINE }}
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-muted shrink-0" />
                    <span className="truncate">{dominio(url)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </aside>
  );
}

function dominio(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + (u.pathname.length > 1 ? u.pathname : "");
  } catch {
    return url;
  }
}

function Arvore({
  graph,
  marcas,
}: {
  graph: CanvasGraph;
  marcas: { id: string; nome: string }[];
}) {
  const [themeId, setThemeId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const { fitView } = useReactFlow();

  // Trocar janela ou marca gera outro grafo: fecha o que estava aberto.
  useEffect(() => {
    setThemeId(null);
    setDropId(null);
  }, [graph]);

  const tree = useMemo(() => buildTree(graph, themeId, dropId), [graph, themeId, dropId]);
  const [nodes, setNodes, onNodesChange] = useNodesState(tree.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(tree.edges);

  useEffect(() => {
    setNodes(tree.nodes);
    setEdges(tree.edges);
  }, [tree, setNodes, setEdges]);

  const theme = graph.nodes.find((n) => n.id === themeId);
  const drop = theme?.drops.find((d) => d.id === dropId);

  // Enquadra o caminho aberto (e não a árvore inteira): ao abrir um tema, o
  // foco vai pro tema e seus drops; com o painel aberto, reserva a direita.
  // Só enquadra quando o estado já tem os nós novos E o React Flow já os mediu;
  // antes disso o fitView ignora os drops recém-abertos ou os mede com zero.
  const medidos = useNodesInitialized();
  const enquadrado = useRef<string | null>(null);
  useEffect(() => {
    const chave = `${graph.marca.id}|${graph.meta.janelaDias}|${themeId}|${dropId}`;
    if (!medidos || enquadrado.current === chave) return;
    const ids = themeId
      ? [themeId, ...tree.nodes.filter((n) => n.type === "drop").map((n) => n.id)]
      : tree.nodes.map((n) => n.id);
    const presentes = new Set(nodes.map((n) => n.id));
    if (!ids.every((id) => presentes.has(id))) return;
    enquadrado.current = chave;
    fitView({
      nodes: ids.map((id) => ({ id })),
      padding: { top: "110px", left: "40px", bottom: "40px", right: dropId ? "460px" : "40px" },
      maxZoom: 1.1,
      duration: 350,
    });
  }, [medidos, nodes, tree, graph, themeId, dropId, fitView]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === "theme") {
      setThemeId((cur) => (cur === node.id ? null : node.id));
      setDropId(null);
    } else if (node.type === "drop") {
      setDropId((node.data as DropData).drop.id);
    }
  }, []);

  return (
    <div className="relative w-full h-full">
      <Toolbar graph={graph} marcas={marcas}>
        <Trilha
          graph={graph}
          theme={theme}
          drop={drop}
          onRoot={() => {
            setThemeId(null);
            setDropId(null);
          }}
          onTheme={() => setDropId(null)}
        />
      </Toolbar>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#2a2a2a" />
        <Controls
          showInteractive={false}
          style={{ background: "#181818", border: "1px solid #6e6a66", borderRadius: 10 }}
        />
      </ReactFlow>
      {tree.nodes.length <= 1 && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <p className="text-muted text-sm">
            {graph.meta.drops === 0
              ? "Nenhum drop nesta janela. Tente um período maior."
              : "Nenhum tema se repetiu nesta janela."}
          </p>
        </div>
      )}
      {drop && theme && <DropPanel drop={drop} theme={theme} onClose={() => setDropId(null)} />}
    </div>
  );
}

export default function CanvasClient({
  graph,
  marcas,
}: {
  graph: CanvasGraph;
  marcas: { id: string; nome: string }[];
}) {
  return (
    <ReactFlowProvider>
      <Arvore graph={graph} marcas={marcas} />
    </ReactFlowProvider>
  );
}

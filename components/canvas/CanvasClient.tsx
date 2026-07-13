"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  useReactFlow,
  useNodesState,
  useEdgesState,
  useInternalNode,
  getStraightPath,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  type InternalNode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import {
  Check,
  ChevronDown,
  Download,
  FileJson,
  Sparkles,
  X,
  ExternalLink,
} from "lucide-react";
import type { CanvasGraph, CanvasDrop } from "@/lib/canvas/buildGraph";

const FUNNEL_COLOR: Record<string, string> = {
  growth: "#81d300",
  base: "#a063e8",
  mixed: "#c6a15b",
};
const funnelColor = (f: string | null) => FUNNEL_COLOR[f ?? ""] ?? "#8a8580";

const FUNNEL_LABEL: Record<string, string> = {
  growth: "growth",
  base: "base",
  mixed: "misto",
};

const STATUS_DOT: Record<string, string> = {
  em_alta: "#81d300",
  subindo: "#a063e8",
  estabilizando: "#a8a29e",
  esfriando: "#6e6a66",
};

const hiddenHandle = { opacity: 0 } as const;

type ThemeData = {
  label: string;
  size: number;
  funnel: "growth" | "base" | "mixed" | null;
  hypeAvg: number;
  hypeMax: number;
  keywords: string[];
  drops: CanvasDrop[];
};

function ThemeNode({ data, selected }: NodeProps<Node<ThemeData>>) {
  const color = funnelColor(data.funnel);
  // largura cresce com o volume de sinais (1 → 10+ = 156 → 250px)
  const width = 156 + Math.round((Math.min(data.size, 10) / 10) * 94);
  return (
    <div
      className="rounded-2xl px-4 py-3 flex flex-col gap-2 transition-shadow"
      style={{
        width,
        background: "var(--surface)",
        border: `1px solid ${color}${selected ? "" : "66"}`,
        boxShadow: selected
          ? `0 0 0 1px ${color}, 0 0 34px -8px ${color}aa`
          : `0 0 0 1px ${color}22, 0 18px 40px -28px rgba(0,0,0,0.8)`,
      }}
    >
      <Handle type="target" position={Position.Top} style={hiddenHandle} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} style={hiddenHandle} isConnectable={false} />
      <div className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-2">
          {FUNNEL_LABEL[data.funnel ?? ""] ?? "tema"}
        </span>
        <span className="ml-auto text-[11px] tabular-nums text-muted-2">
          {data.size} {data.size === 1 ? "sinal" : "sinais"}
        </span>
      </div>
      <p className="text-[13px] leading-snug font-medium text-white/95">
        {data.label}
      </p>
      <div className="flex items-center gap-1 text-[10px] tabular-nums" style={{ color }}>
        <span className="uppercase tracking-[0.1em] text-muted-2">hype</span>
        <span className="font-medium">{data.hypeMax}</span>
      </div>
    </div>
  );
}

function CoreNode({ data }: NodeProps<Node<{ label: string }>>) {
  return (
    <div
      className="grid place-items-center rounded-full text-center px-4"
      style={{
        width: 132,
        height: 132,
        background: "radial-gradient(circle at 30% 30%, #4a2e63, #181818 70%)",
        border: "1.5px solid #a063e8aa",
        boxShadow: "0 0 40px -10px #a063e880",
      }}
    >
      <Handle type="target" position={Position.Top} style={hiddenHandle} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} style={hiddenHandle} isConnectable={false} />
      <span className="font-serif text-white font-medium text-lg leading-tight">
        {data.label}
      </span>
    </div>
  );
}

const nodeTypes = { theme: ThemeNode, core: CoreNode };

function nodeCenter(node: InternalNode) {
  return {
    x: node.internals.positionAbsolute.x + (node.measured.width ?? 0) / 2,
    y: node.internals.positionAbsolute.y + (node.measured.height ?? 0) / 2,
  };
}

function FloatingEdge({ id, source, target, style, markerEnd }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;
  const s = nodeCenter(sourceNode);
  const t = nodeCenter(targetNode);
  const [path] = getStraightPath({
    sourceX: s.x,
    sourceY: s.y,
    targetX: t.x,
    targetY: t.y,
  });
  return (
    <path id={id} d={path} className="react-flow__edge-path" style={style} markerEnd={markerEnd} />
  );
}

const edgeTypes = { floating: FloatingEdge };

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
        className="flex items-center gap-2 rounded-full border border-border bg-surface/80 backdrop-blur pl-4 pr-3 py-1.5 text-white hover:border-white/20 transition-colors"
      >
        <span className="font-serif text-sm leading-none">
          {active?.nome ?? "Selecionar cliente"}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-muted-2 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 z-20 min-w-[200px] max-h-[60vh] overflow-y-auto rounded-2xl border border-border bg-surface-2/95 backdrop-blur p-1.5 shadow-elevated">
            {marcas.map((m) => {
              const isActive = m.id === activeId;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setOpen(false);
                    if (!isActive) router.push(`/dashboard/mapa/${m.id}`);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? "text-white bg-surface"
                      : "text-muted hover:text-white hover:bg-surface/70"
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

function Toolbar({
  graph,
  marcas,
}: {
  graph: CanvasGraph;
  marcas: { id: string; nome: string }[];
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
      [JSON.stringify({ marca: graph.marca, nodes: graph.nodes, edges: graph.edges }, null, 2)],
      { type: "application/json" }
    );
    download(URL.createObjectURL(blob), `${graph.marca.nome}-mapa.json`);
  }, [graph]);

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
      <MarcaSwitcher marcas={marcas} activeId={graph.marca.id} />
      <div className="rounded-full border border-border bg-surface/80 backdrop-blur px-4 py-1.5 flex items-center gap-2.5">
        <span className="text-muted-2 text-[11px]">
          {graph.meta.themes} temas · {graph.meta.drops} sinais
        </span>
        <span
          className="flex items-center gap-1 text-[11px]"
          style={{ color: graph.meta.semantic ? "#81d300" : "#6e6a66" }}
        >
          <Sparkles className="w-3 h-3" />
          {graph.meta.semantic ? "semântico" : "estrutural"}
        </span>
      </div>
      <button
        onClick={onExportPng}
        className="w-9 h-9 rounded-full border border-border bg-surface/80 backdrop-blur text-muted hover:text-white hover:border-white/20 transition-colors grid place-items-center"
        aria-label="Exportar PNG"
      >
        <Download className="w-4 h-4" />
      </button>
      <button
        onClick={onExportJson}
        className="w-9 h-9 rounded-full border border-border bg-surface/80 backdrop-blur text-muted hover:text-white hover:border-white/20 transition-colors grid place-items-center"
        aria-label="Exportar JSON"
      >
        <FileJson className="w-4 h-4" />
      </button>
    </div>
  );
}

function ThemePanel({
  node,
  onClose,
}: {
  node: Node<ThemeData>;
  onClose: () => void;
}) {
  const { label, drops, funnel, size } = node.data;
  const color = funnelColor(funnel);
  return (
    <div className="absolute top-0 right-0 z-20 h-full w-full sm:w-[400px] bg-surface/95 backdrop-blur border-l border-border flex flex-col shadow-elevated">
      <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
        <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <div className="flex-1 min-w-0">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-2">
            {FUNNEL_LABEL[funnel ?? ""] ?? "tema"} · {size} {size === 1 ? "sinal" : "sinais"}
          </span>
          <h3 className="font-serif text-white text-lg leading-tight mt-0.5">{label}</h3>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 grid place-items-center rounded-full text-muted hover:text-white hover:bg-surface-2 transition-colors shrink-0"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {drops.map((d) => (
          <article key={d.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: STATUS_DOT[d.status ?? ""] ?? "#6e6a66" }}
              />
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-2">
                {d.categoria ?? "drop"}
              </span>
              <span className="ml-auto text-[11px] tabular-nums font-medium" style={{ color }}>
                {d.hype}
              </span>
            </div>
            <h4 className="text-[13px] leading-snug font-medium text-white/95">{d.titulo}</h4>
            {d.descricao && (
              <p className="text-[12px] leading-relaxed text-muted">{d.descricao}</p>
            )}
            {d.gancho && (
              <p className="text-[12px] leading-relaxed text-muted-2 italic">{d.gancho}</p>
            )}
            {d.fontes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {d.fontes.slice(0, 4).map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-muted-2 hover:text-white border border-hairline rounded-full px-2 py-0.5 transition-colors"
                  >
                    <ExternalLink className="w-2.5 h-2.5" />
                    fonte {i + 1}
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const initialNodes = useMemo<Node[]>(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: n.type,
        position: { x: n.x, y: n.y },
        data:
          n.type === "core"
            ? { label: n.label }
            : {
                label: n.label,
                size: n.size,
                funnel: n.funnel,
                hypeAvg: n.hypeAvg,
                hypeMax: n.hypeMax,
                keywords: n.keywords,
                drops: n.drops,
              },
        draggable: true,
      })),
    [graph]
  );

  const initialEdges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => {
        const web = e.kind === "web";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "floating",
          style: {
            stroke: web ? "#a8a29e" : "#4a2e63",
            strokeWidth: web ? 0.8 + e.weight * 1.8 : 1,
            opacity: web ? 0.22 + e.weight * 0.4 : 0.55,
          },
        };
      }),
    [graph]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) as Node<ThemeData> | undefined,
    [nodes, selectedId]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedId(node.type === "theme" ? node.id : null);
  }, []);

  return (
    <ReactFlowProvider>
      <div className="relative w-full h-full">
        <Toolbar graph={graph} marcas={marcas} />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={() => setSelectedId(null)}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.15}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          edgesFocusable={false}
        >
          <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="#232323" />
          <Controls
            showInteractive={false}
            style={{ background: "#181818", border: "1px solid #232323", borderRadius: 10 }}
          />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) =>
              n.type === "core" ? "#a063e8" : funnelColor((n.data as ThemeData).funnel)
            }
            maskColor="rgba(11,11,11,0.75)"
            style={{ background: "#121212", border: "1px solid #232323" }}
          />
        </ReactFlow>
        {selectedNode && (
          <ThemePanel node={selectedNode} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </ReactFlowProvider>
  );
}

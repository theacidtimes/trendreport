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
import { Check, ChevronDown, Download, FileJson, Sparkles } from "lucide-react";
import type { CanvasGraph } from "@/lib/canvas/buildGraph";

const PALETTE = [
  "#a063e8",
  "#81d300",
  "#c6a15b",
  "#6e93c7",
  "#b27bb0",
  "#d9843f",
  "#7fa650",
];

const clusterColor = (c: number) => PALETTE[((c % PALETTE.length) + PALETTE.length) % PALETTE.length];

const STATUS_DOT: Record<string, string> = {
  em_alta: "#81d300",
  subindo: "#a063e8",
  estabilizando: "#a8a29e",
  esfriando: "#6e6a66",
};

// Handles reais (bounds mensuráveis pro React Flow não descartar a aresta),
// só invisíveis. A posição do traço vem do centro do nó (aresta flutuante).
const hiddenHandle = { opacity: 0 } as const;

type DropData = {
  label: string;
  hype: number;
  status: string | null;
  cluster: number;
  categoria: string | null;
};

function DropNode({ data }: NodeProps<Node<DropData>>) {
  const color = clusterColor(data.cluster);
  // largura cresce discretamente com o hype (60 → 100 = 168 → 210px)
  const width = 168 + Math.round((Math.min(Math.max(data.hype, 0), 100) / 100) * 46);
  return (
    <div
      className="rounded-2xl px-3.5 py-3 flex flex-col gap-1.5 shadow-card"
      style={{
        width,
        background: "var(--surface)",
        border: `1px solid ${color}66`,
        boxShadow: `0 0 0 1px ${color}22, 0 18px 40px -28px rgba(0,0,0,0.8)`,
      }}
    >
      <Handle type="target" position={Position.Top} style={hiddenHandle} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} style={hiddenHandle} isConnectable={false} />
      <div className="flex items-center gap-1.5">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: STATUS_DOT[data.status ?? ""] ?? "#6e6a66" }}
        />
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-2">
          {data.categoria ?? "drop"}
        </span>
        <span className="ml-auto text-[11px] tabular-nums font-medium" style={{ color }}>
          {data.hype}
        </span>
      </div>
      <p className="text-[12px] leading-snug text-white/90 line-clamp-3">
        {data.label}
      </p>
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
        background:
          "radial-gradient(circle at 30% 30%, #4a2e63, #181818 70%)",
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

const nodeTypes = { drop: DropNode, core: CoreNode };

// Aresta flutuante: liga o centro dos dois nós, independente de handles. Ideal
// pro layout radial — a straight edge padrão depende da posição do handle, que
// com handles ocultos não resolve.
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
    <path
      id={id}
      d={path}
      className="react-flow__edge-path"
      style={style}
      markerEnd={markerEnd}
    />
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
    const viewport = document.querySelector(
      ".react-flow__viewport"
    ) as HTMLElement | null;
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
    }).then((url) => download(url, `${graph.marca.nome}-canvas.png`));
  }, [getNodes, graph.marca.nome]);

  const onExportJson = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ marca: graph.marca, nodes: graph.nodes, edges: graph.edges }, null, 2)],
      { type: "application/json" }
    );
    download(URL.createObjectURL(blob), `${graph.marca.nome}-canvas.json`);
  }, [graph]);

  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
      <MarcaSwitcher marcas={marcas} activeId={graph.marca.id} />
      <div className="rounded-full border border-border bg-surface/80 backdrop-blur px-4 py-1.5 flex items-center gap-2.5">
        <span className="text-muted-2 text-[11px]">
          {graph.meta.drops} drops · {graph.meta.clusters} grupos
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

export default function CanvasClient({
  graph,
  marcas,
}: {
  graph: CanvasGraph;
  marcas: { id: string; nome: string }[];
}) {
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
                hype: n.hype,
                status: n.status,
                cluster: n.cluster,
                categoria: n.categoria,
              },
        draggable: true,
      })),
    [graph]
  );

  const initialEdges = useMemo<Edge[]>(
    () =>
      graph.edges.map((e) => {
        const semantic = e.kind === "semantic";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "floating",
          style: {
            stroke: semantic ? "#a8a29e" : "#4a2e63",
            strokeWidth: semantic ? 0.6 + e.weight * 1.6 : 1,
            opacity: semantic ? 0.18 + e.weight * 0.4 : 0.5,
          },
        };
      }),
    [graph]
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <ReactFlowProvider>
      <div className="relative w-full h-full">
        <Toolbar graph={graph} marcas={marcas} />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
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
              n.type === "core" ? "#a063e8" : clusterColor((n.data as DropData).cluster ?? 0)
            }
            maskColor="rgba(11,11,11,0.75)"
            style={{ background: "#121212", border: "1px solid #232323" }}
          />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}

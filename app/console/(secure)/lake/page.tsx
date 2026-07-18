import { Droplets, Layers, TrendingUp, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import LakeExport, { LakeCell } from "@/components/console/LakeExport";

// ═══════════════════════════════════════════════════════════════════════════
// A TORNEIRA — sessão do Console que lê a Fabric Lake (trend_cell) e a entrega.
//
// A lake vive em fabric_lake (schema NÃO exposto ao PostgREST). O ÚNICO acesso é
// via a RPC public.fabric_trend_cells (SECURITY DEFINER, gated is_acid_admin),
// que já devolve tudo K-ANONIMIZADO na origem (célula < K não nasce). Esta tela
// não vê sinal cru, só o agregado vendável.
//
// Estado atual: DORMENTE. O ingest (FABRIC_LAKE_INGEST) está desligado, então a
// tabela está vazia até a torneira de entrada abrir. A tela é funcional contra a
// RPC desde já: no dia em que o ingest ligar e o rebuild rodar, ela mostra dado
// real sem tocar em código.
// ═══════════════════════════════════════════════════════════════════════════

// Ordem canônica das dimensões semânticas (as 4 rodas). Fixa a apresentação
// independente da ordem que a RPC devolver.
const DIM_ORDER = ["inflexao", "lente_negocio", "comportamento", "emocao"];
const DIM_LABEL: Record<string, string> = {
  inflexao: "Inflexão",
  lente_negocio: "Lente de negócio",
  comportamento: "Comportamento",
  emocao: "Emoção",
};

// Momento derivado (no agregado, não por sinal) → cor. Espelha o CASE do rebuild.
const MOMENTO_TONE: Record<string, string> = {
  emergente: "border-purple/30 bg-purple/10 text-purple",
  crescimento: "border-lime/30 bg-lime/10 text-lime",
  pico: "border-white/20 bg-white/10 text-white",
  declinio: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  residual: "border-border bg-surface-2/60 text-muted",
};

function confPct(c: number | null): string {
  if (c === null) return "—";
  return `${Math.round(c * 100)}%`;
}

function formatPeriodo(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export default async function LakePage() {
  const supabase = createClient();
  // Primeiro corte: bucket semanal, sem recorte de setor/dimensão/data. A RPC já
  // vem ordenada por período desc, n_sinais desc — a célula mais quente no topo.
  const { data, error } = await supabase.rpc("fabric_trend_cells", {
    p_bucket: "semana",
  });
  const cells = (data ?? []) as LakeCell[];

  // Agrupamentos pra visão: por setor (bloco) e, dentro, por dimensão.
  const porSetor = new Map<string, LakeCell[]>();
  for (const c of cells) {
    const arr = porSetor.get(c.setor) ?? [];
    arr.push(c);
    porSetor.set(c.setor, arr);
  }
  const setores = Array.from(porSetor.entries()).sort(
    (a, b) => b[1].length - a[1].length
  );

  const totalSinais = cells.reduce((s, c) => s + c.n_sinais, 0);
  const nSetores = porSetor.size;
  const nInflexao = cells.filter((c) => c.dimensao === "inflexao").length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="kicker text-purple">Console Acid Fabric</span>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="font-serif text-white font-medium text-3xl md:text-4xl leading-tight flex items-center gap-3">
            <Droplets className="w-8 h-8 text-purple" strokeWidth={1.8} />
            Lake
          </h1>
          <LakeExport cells={cells} />
        </div>
        <p className="text-muted text-sm max-w-2xl leading-relaxed">
          A camada de valor da percepção. Série por setor × dimensão × termo, já
          k-anonimizada na origem: célula com poucos sinais não existe, nada
          rastreável ao indivíduo. Momento é derivado no agregado, não no sinal.
        </p>
      </header>

      {error ? (
        <div className="rounded-3xl bg-red-500/5 border border-red-500/20 p-6 text-red-400 text-sm">
          Falha ao ler a lake: {error.message}
        </div>
      ) : cells.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Resumo topo */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryStat value={cells.length} label="Células" icon={Layers} />
            <SummaryStat value={nSetores} label="Setores" icon={Droplets} />
            <SummaryStat value={totalSinais} label="Sinais agregados" icon={TrendingUp} />
            <SummaryStat value={nInflexao} label="Inflexões" icon={Sparkles} accent />
          </section>

          {/* Blocos por setor */}
          <section className="flex flex-col gap-6">
            {setores.map(([setor, arr]) => {
              const porDim = new Map<string, LakeCell[]>();
              for (const c of arr) {
                const d = porDim.get(c.dimensao) ?? [];
                d.push(c);
                porDim.set(c.dimensao, d);
              }
              const dims = DIM_ORDER.filter((d) => porDim.has(d));
              return (
                <div
                  key={setor}
                  className="rounded-3xl bg-surface border border-border overflow-hidden shadow-card"
                >
                  <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border">
                    <h2 className="text-white text-lg font-bold capitalize">
                      {setor}
                    </h2>
                    <span className="text-muted-2 text-xs tabular-nums">
                      {arr.length} células
                    </span>
                  </div>
                  <div className="flex flex-col divide-y divide-border">
                    {dims.map((dim) => (
                      <div key={dim} className="px-6 py-4 flex flex-col gap-3">
                        <span className="kicker text-muted-2">
                          {DIM_LABEL[dim] ?? dim}
                        </span>
                        <ul className="flex flex-col gap-2">
                          {porDim.get(dim)!.map((c, i) => (
                            <CellRow key={`${c.termo}-${c.periodo_inicio}-${i}`} c={c} />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}

function CellRow({ c }: { c: LakeCell }) {
  return (
    <li className="flex items-center gap-3 flex-wrap">
      <span className="text-white text-sm font-medium flex-1 min-w-0 truncate">
        {c.termo}
      </span>
      {c.momento_derivado && (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
            MOMENTO_TONE[c.momento_derivado] ?? "border-border text-muted"
          }`}
        >
          {c.momento_derivado}
        </span>
      )}
      <span className="text-muted text-xs tabular-nums whitespace-nowrap">
        {formatPeriodo(c.periodo_inicio)}
      </span>
      <span className="text-muted text-xs tabular-nums whitespace-nowrap">
        {c.n_sinais} sinais · {c.n_plataformas} plat.
      </span>
      {c.n_engaj_alto > 0 && (
        <span className="text-lime text-xs tabular-nums whitespace-nowrap">
          {c.n_engaj_alto} alto engaj.
        </span>
      )}
      <span className="text-muted-2 text-xs tabular-nums whitespace-nowrap w-10 text-right">
        {confPct(c.confidence)}
      </span>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl bg-surface border border-border p-10 flex flex-col items-center gap-4 text-center">
      <span className="grid place-items-center h-14 w-14 rounded-2xl bg-purple/10 text-purple">
        <Droplets className="w-7 h-7" strokeWidth={1.8} />
      </span>
      <div className="flex flex-col gap-1.5 max-w-md">
        <h2 className="text-white text-lg font-bold">A lake ainda está seca</h2>
        <p className="text-muted text-sm leading-relaxed">
          Nenhuma célula agregada ainda. A torneira de entrada
          (FABRIC_LAKE_INGEST) está desligada por padrão: o fork existe no
          código mas não grava nada até ser ligado. Assim que o ingest abrir e o
          rebuild rodar, as células aparecem aqui automaticamente.
        </p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1.5 text-xs text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Dormente · aguardando ingest
      </span>
    </div>
  );
}

function SummaryStat({
  value,
  label,
  icon: Icon,
  accent,
}: {
  value: number | string;
  label: string;
  icon: typeof Layers;
  accent?: boolean;
}) {
  return (
    <div className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-2 shadow-card">
      <Icon
        className={`w-4 h-4 ${accent ? "text-purple" : "text-muted-2"}`}
        strokeWidth={2}
      />
      <span className="text-3xl font-bold tabular-nums text-white">{value}</span>
      <span className="text-muted text-[11px] uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

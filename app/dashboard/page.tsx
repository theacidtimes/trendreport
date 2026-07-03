import { Flame, Sparkle, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import ComposerBar from "@/components/ComposerBar";
import ReportCard from "./ReportCard";
import type { ReportRow } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reports } = await supabase
    .from("reports")
    .select("id, slug, cliente, report, created_at")
    .order("created_at", { ascending: false });

  const rows = (reports ?? []) as Pick<
    ReportRow,
    "id" | "slug" | "cliente" | "report" | "created_at"
  >[];

  const thumbOf = (row: (typeof rows)[number]) =>
    row.report?.tendencias?.find((t) => t.imagem_url)?.imagem_url ?? null;

  const hypeValues = rows
    .map((r) => r.report?.meta?.indice_hype)
    .filter((v): v is number => typeof v === "number");
  const avgHype = hypeValues.length
    ? Math.round(hypeValues.reduce((a, b) => a + b, 0) / hypeValues.length)
    : null;
  const ultimoCliente = rows[0]?.cliente ?? null;

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user?.email} />

      <main className="md:pl-64">
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-4">
          {/* HERO CLUSTER: composer + stats */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8 rounded-3xl bg-purple p-6 md:p-8 flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <span className="text-white/60 text-xs uppercase tracking-[0.14em] font-medium">
                  Novo report
                </span>
                <h1 className="font-sans text-white font-bold text-2xl md:text-3xl tracking-[-0.01em]">
                  O que está bombando agora?
                </h1>
              </div>
              <ComposerBar />
            </div>

            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="flex-1 rounded-3xl bg-black border border-border p-6 flex flex-col justify-between gap-3">
                <span className="text-muted text-xs uppercase tracking-[0.14em] font-medium">
                  Total de reports
                </span>
                <span className="font-sans text-white font-bold text-4xl tabular-nums">
                  {rows.length}
                </span>
              </div>
              <div className="flex-1 rounded-3xl bg-white p-6 flex flex-col justify-between gap-3">
                <span className="text-black/50 text-xs uppercase tracking-[0.14em] font-medium">
                  Hype médio
                </span>
                <span className="font-sans text-black font-bold text-4xl tabular-nums flex items-center gap-2">
                  {avgHype ?? "—"}
                  {avgHype !== null && <Flame className="w-6 h-6 text-purple" strokeWidth={2.2} />}
                </span>
              </div>
            </div>
          </div>

          {ultimoCliente && (
            <div className="rounded-3xl bg-surface border border-border px-6 py-4 flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-lime shrink-0" strokeWidth={2.2} />
              <span className="text-muted text-sm">
                Último cliente analisado: <span className="text-white font-medium">{ultimoCliente}</span>
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1 pt-6">
            <span className="text-muted text-xs uppercase tracking-[0.14em] font-medium">
              {rows.length} {rows.length === 1 ? "report" : "reports"}
            </span>
            <h2 className="font-sans text-white font-bold text-2xl md:text-3xl tracking-[-0.01em]">
              Seus reports
            </h2>
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-24 border border-dashed border-border rounded-3xl">
              <span className="w-11 h-11 rounded-full bg-surface flex items-center justify-center">
                <Sparkle className="w-5 h-5 text-muted" strokeWidth={2} />
              </span>
              <p className="text-muted text-center max-w-xs">
                Nenhum report ainda. Cole um briefing acima e gere o primeiro relatório de
                tendências.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rows.map((r, i) => (
                <ReportCard
                  key={r.id}
                  index={i + 1}
                  slug={r.slug}
                  cliente={r.cliente}
                  createdAt={r.created_at}
                  indiceHype={r.report?.meta?.indice_hype ?? 0}
                  hypeMotivo={r.report?.meta?.hype_motivo ?? ""}
                  imagemUrl={thumbOf(r)}
                  corMarca={r.report?.meta?.cor_marca ?? null}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

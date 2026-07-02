import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
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

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user?.email} />

      <main className="md:pl-64">
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-muted text-xs uppercase tracking-[0.14em] font-medium">
                {rows.length} {rows.length === 1 ? "report" : "reports"}
              </span>
              <h1 className="text-white font-bold text-3xl md:text-4xl tracking-[-0.01em]">
                Reports
              </h1>
            </div>
            <Link
              href="/dashboard/new"
              className="bg-lime text-black font-bold text-sm uppercase h-11 px-5 rounded-lg flex items-center gap-2 shrink-0 shadow-lime hover:brightness-110 transition-[filter]"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Novo report
            </Link>
          </div>

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-24 border border-dashed border-border rounded-xl">
              <span className="w-11 h-11 rounded-full bg-surface flex items-center justify-center">
                <Plus className="w-5 h-5 text-muted" strokeWidth={2} />
              </span>
              <p className="text-muted text-center max-w-xs">
                Nenhum report ainda. Cole um briefing e gere o primeiro relatório de tendências.
              </p>
              <Link
                href="/dashboard/new"
                className="text-lime text-sm font-bold uppercase tracking-wide hover:underline underline-offset-4"
              >
                Criar novo report →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

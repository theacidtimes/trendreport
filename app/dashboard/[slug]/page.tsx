import { notFound } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import ReportView from "@/components/ReportView";
import { checkIsAdmin } from "@/lib/admin";
import PublishedActions from "./PublishedActions";
import ReportEditor from "./ReportEditor";
import PendingReport from "./PendingReport";
import type { TrendReport } from "@/lib/types";

export default async function DashboardReportPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAdmin = await checkIsAdmin(supabase);

  const { data: row } = await supabase
    .from("reports")
    .select("report, created_at, briefing, status, error_message")
    .eq("slug", params.slug)
    .single();

  if (!row) {
    notFound();
  }

  if (row.status === "pending") {
    return (
      <div className="min-h-screen bg-bg">
        <Sidebar userEmail={user?.email} isAdmin={isAdmin} />
        <main className="md:pl-64">
          <PendingReport slug={params.slug} />
        </main>
      </div>
    );
  }

  if (row.status === "error") {
    return (
      <div className="min-h-screen bg-bg">
        <Sidebar userEmail={user?.email} isAdmin={isAdmin} />
        <main className="md:pl-64">
          <div className="min-h-screen md:min-h-0 flex items-center justify-center px-4 py-10 md:py-24">
            <p className="text-red-400 text-sm max-w-md flex items-center gap-2 text-center">
              <TriangleAlert className="w-4 h-4 shrink-0" strokeWidth={2} />
              {row.error_message ?? "Erro ao gerar relatório."}
            </p>
          </div>
        </main>
      </div>
    );
  }

  const report = row.report as TrendReport;
  const briefing = row.briefing as Record<string, unknown> | string | null;
  const geradoEm = new Date(row.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 'ready' = gerado pela IA, aguardando curadoria humana. Só depois de
  // homologado (status 'published') o relatório fica visível no link público.
  if (row.status === "ready") {
    return (
      <div className="min-h-screen bg-bg">
        <Sidebar userEmail={user?.email} isAdmin={isAdmin} />
        <main className="md:pl-64">
          <ReportEditor
            slug={params.slug}
            initialReport={report}
            briefing={briefing}
            geradoEm={geradoEm}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user?.email} />
      <main className="md:pl-64">
        <ReportView report={report} geradoEm={geradoEm} standalone={false} briefing={briefing} />
      </main>
      <PublishedActions slug={params.slug} />
    </div>
  );
}

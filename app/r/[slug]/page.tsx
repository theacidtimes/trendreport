import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReportView from "@/components/ReportView";
import type { TrendReport } from "@/lib/types";

export default async function PublicReportPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createClient();

  const { data: row } = await supabase
    .from("reports")
    .select("report, created_at, briefing, status")
    .eq("slug", params.slug)
    .single();

  // Link público só existe pra reports prontos — pending/error ainda não
  // têm nada pronto pra mostrar (e não devem vazar estado interno).
  if (!row || row.status !== "ready") {
    notFound();
  }

  const report = row.report as TrendReport;
  const briefing = row.briefing as Record<string, unknown> | string | null;
  const geradoEm = new Date(row.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-bg">
      <ReportView report={report} geradoEm={geradoEm} briefing={briefing} />
    </div>
  );
}

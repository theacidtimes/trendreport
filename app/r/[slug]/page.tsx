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
    .select("report, created_at")
    .eq("slug", params.slug)
    .single();

  if (!row) {
    notFound();
  }

  const report = row.report as TrendReport;
  const geradoEm = new Date(row.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-bg">
      <ReportView report={report} geradoEm={geradoEm} />
    </div>
  );
}

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
  const geradoEm = new Date(row.created_at).toLocaleDateString("pt-BR");

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-6xl mx-auto px-5 md:px-10 pt-6">
        <span className="text-muted text-[13px]">
          cccaramelo trend report · gerado em {geradoEm}
        </span>
      </div>
      <ReportView report={report} />
    </div>
  );
}

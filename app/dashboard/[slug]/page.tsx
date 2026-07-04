import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import ReportView from "@/components/ReportView";
import CopyLinkButton from "./CopyLinkButton";
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

  const { data: row } = await supabase
    .from("reports")
    .select("report, created_at, briefing")
    .eq("slug", params.slug)
    .single();

  if (!row) {
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
      <Sidebar userEmail={user?.email} />
      <main className="md:pl-64">
        <ReportView report={report} geradoEm={geradoEm} standalone={false} briefing={briefing} />
      </main>
      <CopyLinkButton slug={params.slug} />
    </div>
  );
}

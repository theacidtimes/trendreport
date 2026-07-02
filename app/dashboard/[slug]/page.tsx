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
    .select("report")
    .eq("slug", params.slug)
    .single();

  if (!row) {
    notFound();
  }

  const report = row.report as TrendReport;

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user?.email} />
      <main className="md:pl-64">
        <ReportView report={report} />
      </main>
      <CopyLinkButton slug={params.slug} />
    </div>
  );
}

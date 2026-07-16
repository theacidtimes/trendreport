import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabase/server";
import ReportView from "@/components/ReportView";
import type { TrendReport, TenantBranding } from "@/lib/types";

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

  // Link público só existe pra reports homologados. 'ready' agora significa
  // "gerado pela IA, aguardando curadoria humana" — não deve vazar pro cliente
  // até o analista publicar (status 'published').
  if (!row || row.status !== "published") {
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

  // Branding white-label do tenant dono deste report (Fase 4E). Anon nao le a
  // tabela tenants (RLS to authenticated), entao uma rpc SECURITY DEFINER resolve
  // slug -> branding SO para reports 'published'. Ausente/erro = fallback ACID.
  const { data: brandingRaw } = await supabase.rpc("branding_do_report", {
    p_slug: params.slug,
  });
  const branding =
    brandingRaw && typeof brandingRaw === "object"
      ? (brandingRaw as TenantBranding)
      : {};

  // Cores dinamicas: sobrescreve as vars --purple/--lime SO no escopo deste
  // report (custom properties cascateiam pros descendentes; bg-lime/text-purple
  // resolvem var(--...)). Server-side = sem FOUC. Tenant sem cor = defaults.
  const brandStyle: CSSProperties = {};
  if (branding.cor_primaria) {
    (brandStyle as Record<string, string>)["--purple"] = branding.cor_primaria;
    (brandStyle as Record<string, string>)["--purple-mid"] =
      `color-mix(in srgb, ${branding.cor_primaria} 45%, #140f1c)`;
  }
  if (branding.cor_destaque) {
    (brandStyle as Record<string, string>)["--lime"] = branding.cor_destaque;
  }

  return (
    <div className="min-h-screen bg-bg" style={brandStyle}>
      <ReportView
        report={report}
        geradoEm={geradoEm}
        briefing={briefing}
        logoUrl={branding.logo_url || undefined}
        displayName={branding.display_name || undefined}
      />
    </div>
  );
}

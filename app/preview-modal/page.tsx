import NewReportDialog from "@/app/dashboard/NewReportDialog";

export default function PreviewModal() {
  return (
    <div className="min-h-screen bg-bg p-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
        <NewReportDialog />
        <div className="rounded-3xl bg-surface border border-border p-6 min-h-[400px] flex items-center justify-center text-muted">
          Radar recente (stand-in) — o modal deve cobrir isto.
        </div>
        <div className="rounded-3xl bg-surface border border-border p-6 min-h-[400px] flex items-center justify-center text-muted">
          Outra seção
        </div>
      </div>
    </div>
  );
}

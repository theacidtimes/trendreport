import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
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

  return (
    <div className="min-h-screen bg-bg">
      <Header userEmail={user?.email} />

      <main className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-white font-bold text-2xl">Reports</h1>
          <Link
            href="/dashboard/new"
            className="bg-lime text-black font-bold text-sm uppercase h-11 px-6 rounded-lg flex items-center"
          >
            NOVO REPORT +
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="text-muted text-center py-20">
            Nenhum report ainda. Crie o primeiro ↑
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {rows.map((r) => (
              <ReportCard
                key={r.id}
                slug={r.slug}
                cliente={r.cliente}
                createdAt={r.created_at}
                indiceHype={r.report?.meta?.indice_hype ?? 0}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

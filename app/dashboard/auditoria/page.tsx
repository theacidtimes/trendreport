import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRight,
  FilePlus2,
  FileX2,
  Pencil,
  ScrollText,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import { checkIsAdmin } from "@/lib/admin";
import AdminManager from "./AdminManager";

type AuditAction = "INSERT" | "UPDATE" | "DELETE";

type AuditRow = {
  id: number;
  report_id: string | null;
  slug: string | null;
  cliente: string | null;
  action: AuditAction;
  changed_by: string | null;
  changed_by_email: string | null;
  status_before: string | null;
  status_after: string | null;
  created_at: string;
};

const ACTION_META: Record<
  AuditAction,
  { label: string; icon: typeof Pencil; className: string }
> = {
  INSERT: {
    label: "Criou",
    icon: FilePlus2,
    className: "text-lime border-lime/30 bg-lime/5",
  },
  UPDATE: {
    label: "Editou",
    icon: Pencil,
    className: "text-purple-300 border-purple/40 bg-purple/10",
  },
  DELETE: {
    label: "Excluiu",
    icon: FileX2,
    className: "text-red-400 border-red-500/30 bg-red-500/5",
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AuditoriaPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!(await checkIsAdmin(supabase))) {
    redirect("/dashboard");
  }

  // A RLS ("audit admin read") só devolve linhas pro admin; a checagem acima é
  // só pra UX (evitar renderizar a casca vazia pra quem não deveria ver).
  const { data } = await supabase
    .from("report_audit")
    .select(
      "id, report_id, slug, cliente, action, changed_by, changed_by_email, status_before, status_after, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (data ?? []) as AuditRow[];

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user?.email} isAdmin />

      <main className="md:pl-64">
        <div className="max-w-5xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-lime text-xs uppercase tracking-[0.14em] font-medium">
              <ScrollText className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
              Admin
            </span>
            <h1 className="font-sans text-white font-bold text-3xl tracking-[-0.01em]">
              Trilha de auditoria
            </h1>
            <p className="text-muted text-sm">
              Quem alterou o quê, quando — com backup do estado anterior guardado
              no banco. {rows.length} registro{rows.length === 1 ? "" : "s"}.
            </p>
          </div>

          <AdminManager currentEmail={user?.email} />

          {rows.length === 0 ? (
            <div className="rounded-3xl bg-surface border border-border p-10 text-center text-muted text-sm">
              Nenhuma alteração registrada ainda.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((row) => {
                const meta = ACTION_META[row.action];
                const Icon = meta?.icon ?? Pencil;
                const statusChanged =
                  row.status_before &&
                  row.status_after &&
                  row.status_before !== row.status_after;
                return (
                  <li
                    key={row.id}
                    className="rounded-2xl bg-surface border border-border px-4 py-3.5 flex items-center gap-4 flex-wrap"
                  >
                    <span
                      className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide rounded-lg border px-2.5 py-1 ${
                        meta?.className ?? "text-muted border-border"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
                      {meta?.label ?? row.action}
                    </span>

                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-white text-sm font-medium truncate">
                        {row.cliente ?? "—"}
                        {row.slug && (
                          <span className="text-muted font-normal">
                            {" "}
                            · {row.slug}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 text-muted text-xs mt-0.5">
                        <User className="w-3 h-3 shrink-0" strokeWidth={2} />
                        {row.changed_by_email ?? "sistema/pipeline"}
                        {statusChanged && (
                          <span className="ml-1 text-purple-300">
                            {row.status_before} → {row.status_after}
                          </span>
                        )}
                      </span>
                    </div>

                    <span className="shrink-0 text-muted text-xs tabular-nums">
                      {formatDate(row.created_at)}
                    </span>

                    {row.action !== "DELETE" && row.slug && (
                      <Link
                        href={`/dashboard/${row.slug}`}
                        aria-label="Abrir report"
                        className="shrink-0 text-muted hover:text-lime transition-colors"
                      >
                        <ArrowUpRight className="w-4 h-4" strokeWidth={2.2} />
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

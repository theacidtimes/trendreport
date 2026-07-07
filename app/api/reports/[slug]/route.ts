import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TrendReport } from "@/lib/types";

type PatchBody = {
  report?: TrendReport;
  status?: "ready" | "published";
};

// Só a curadoria humana transita entre esses dois estados. 'pending'/'error'
// são sempre escritos pelo pipeline de geração, nunca por esta rota.
const EDITABLE_STATUSES = ["ready", "published"] as const;

export async function PATCH(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (body.report !== undefined) {
    if (
      typeof body.report !== "object" ||
      body.report === null ||
      typeof (body.report as TrendReport).meta !== "object"
    ) {
      return NextResponse.json(
        { error: "Report inválido." },
        { status: 400 }
      );
    }
    update.report = body.report;
  }

  if (body.status !== undefined) {
    if (!EDITABLE_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: "Status não permitido por esta rota." },
        { status: 400 }
      );
    }
    update.status = body.status;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "Nada para atualizar." },
      { status: 400 }
    );
  }

  // A RLS (policy "owner") garante que só o dono altera a própria linha; e
  // filtramos por status para nunca sobrescrever um report ainda 'pending'
  // ou em 'error' — a edição humana só age sobre relatórios já gerados.
  const { data, error } = await supabase
    .from("reports")
    .update(update)
    .eq("slug", params.slug)
    .in("status", EDITABLE_STATUSES)
    .select("slug, status")
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        error: "Falha ao atualizar report.",
        detail: error?.message ?? "Nenhuma linha atualizada.",
      },
      { status: error ? 500 : 404 }
    );
  }

  return NextResponse.json({ slug: data.slug, status: data.status });
}

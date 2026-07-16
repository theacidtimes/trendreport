"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ModuloNome } from "@/lib/types";

// Todas as escritas do console rodam com o client de SESSÃO. A trava real é no
// banco: RPC provisionar_tenant (checa is_acid_admin por dentro) e as policies
// `acid_manage` (with check is_acid_admin()) em tenant_modulos/assinaturas, mais
// a tenant_isolation (`or is_acid_admin()`) em tenants. A UI só reflete.

const TIPOS = ["studio", "agency", "holding", "company"] as const;
const STATUS = ["ativo", "suspenso", "cancelado"] as const;
const PLANOS = ["mensal", "trimestral", "semestral", "anual"] as const;
const MODULOS: ModuloNome[] = ["radar", "reports", "dados_semanticos"];

type Tipo = (typeof TIPOS)[number];
type Status = (typeof STATUS)[number];
type Plano = (typeof PLANOS)[number];

// ─── Provisionar (criar) ──────────────────────────────────
export async function provisionarTenant(input: {
  nome: string;
  tipo: string;
  seats: number;
  plano: string;
  modulos: string[];
  cnpj?: string;
  creditos?: number;
}): Promise<string> {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome do tenant é obrigatório.");
  if (!TIPOS.includes(input.tipo as Tipo)) throw new Error("Tipo inválido.");
  if (!PLANOS.includes(input.plano as Plano)) throw new Error("Plano inválido.");
  const modulos = input.modulos.filter((m) =>
    MODULOS.includes(m as ModuloNome)
  );

  const supabase = createClient();
  const { data, error } = await supabase.rpc("provisionar_tenant", {
    p_nome: nome,
    p_tipo: input.tipo,
    p_seats: Math.max(1, Math.trunc(input.seats || 1)),
    p_plano: input.plano,
    p_modulos: modulos,
    p_cnpj: input.cnpj?.trim() || null,
    p_creditos: Math.max(0, Math.trunc(input.creditos || 0)),
  });
  if (error) throw new Error(error.message);

  revalidatePath("/console");
  return data as string;
}

// ─── Editar dados do tenant ───────────────────────────────
export async function updateTenant(
  id: string,
  input: { nome: string; tipo: string; status: string; seats: number; cnpj?: string }
): Promise<void> {
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome do tenant é obrigatório.");
  if (!TIPOS.includes(input.tipo as Tipo)) throw new Error("Tipo inválido.");
  if (!STATUS.includes(input.status as Status)) throw new Error("Status inválido.");

  const supabase = createClient();
  const { error } = await supabase
    .from("tenants")
    .update({
      nome,
      tipo: input.tipo,
      status: input.status,
      seats: Math.max(1, Math.trunc(input.seats || 1)),
      cnpj: input.cnpj?.trim() || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/console");
  revalidatePath(`/console/tenants/${id}`);
}

// ─── Ligar/desligar módulo ────────────────────────────────
export async function toggleModulo(
  tenantId: string,
  modulo: ModuloNome,
  ativo: boolean
): Promise<void> {
  if (!MODULOS.includes(modulo)) throw new Error("Módulo inválido.");
  const supabase = createClient();
  // upsert: o tenant pode nunca ter tido a linha (provisionado sem esse módulo).
  const { error } = await supabase
    .from("tenant_modulos")
    .upsert(
      { tenant_id: tenantId, modulo, ativo, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id,modulo" }
    );
  if (error) throw new Error(error.message);

  revalidatePath("/console");
  revalidatePath(`/console/tenants/${tenantId}`);
}

// ─── Assinatura: lançar novo ciclo ────────────────────────
// Expira a assinatura ativa atual (mantém 1 ativa por vez) e insere o novo ciclo.
// data_fim deriva do plano pelo trigger set_data_fim.
export async function lancarAssinatura(
  tenantId: string,
  plano: string
): Promise<void> {
  if (!PLANOS.includes(plano as Plano)) throw new Error("Plano inválido.");
  const supabase = createClient();

  const { error: expErr } = await supabase
    .from("assinaturas")
    .update({ status: "expirada" })
    .eq("tenant_id", tenantId)
    .eq("status", "ativa");
  if (expErr) throw new Error(expErr.message);

  const { error } = await supabase
    .from("assinaturas")
    .insert({ tenant_id: tenantId, plano_tipo: plano });
  if (error) throw new Error(error.message);

  revalidatePath("/console");
  revalidatePath(`/console/tenants/${tenantId}`);
}

// ─── Assinatura: cancelar a vigente ───────────────────────
export async function cancelarAssinatura(tenantId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("assinaturas")
    .update({ status: "cancelada", auto_renovacao: false })
    .eq("tenant_id", tenantId)
    .eq("status", "ativa");
  if (error) throw new Error(error.message);

  revalidatePath("/console");
  revalidatePath(`/console/tenants/${tenantId}`);
}

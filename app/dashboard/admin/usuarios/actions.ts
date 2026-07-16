"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Gestao self-serve de membros pelo ADMIN DO TENANT, dentro do workspace. As RPCs
// (0028) travam em sou_admin_do_meu_tenant() por dentro e resolvem o tenant SEMPRE
// de jwt_tenant_id() — nenhuma destas actions recebe tenantId, entao um admin nunca
// alcanca outro tenant. Espelha o console (ACID), mas com posse invertida: aqui o
// admin PREENCHE os seats ate o teto; o teto em si (tenants.seats) e ACID-only.
//
// Diferenca deliberada vs. console: adicionarMembro so CRIA conta nova. Se o email
// ja existe (em qualquer lugar), NAO anexamos — isso exporia contas de outros
// tenants e permitiria "sequestrar" um usuario sem consentimento. Nesse caso
// mandamos falar com a ACID, que tem a visao global e a RPC acid_* pra decidir.

const ROLES = ["admin", "editor", "viewer"] as const;
type Role = (typeof ROLES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface Membro {
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

// service_role: unico caminho pra criar conta em auth.users (Admin API). Fica
// server-side; a key nunca chega ao client.
function serviceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Senha temporaria forte pra conta recem-criada. O usuario troca depois; aqui
// so precisa passar no minimo do GoTrue e nao ser adivinhavel.
function senhaTemporaria(): string {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += alpha[bytes[i] % alpha.length];
  return `Af!${s}`;
}

// ─── Listar membros do proprio tenant ─────────────────────
export async function listarMembros(): Promise<Membro[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("meus_usuarios");
  if (error) throw new Error(error.message);
  return (data ?? []) as Membro[];
}

// ─── Definir papel de um membro do proprio tenant ─────────
export async function definirPapelMembro(
  userId: string,
  role: string
): Promise<void> {
  if (!ROLES.includes(role as Role)) throw new Error("Papel inválido.");
  const supabase = createClient();
  const { error } = await supabase.rpc("meu_tenant_definir_papel", {
    p_user: userId,
    p_role: role,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/usuarios");
}

// ─── Remover membro do proprio tenant ─────────────────────
export async function removerMembroMeuTenant(userId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("meu_tenant_remover_membro", {
    p_user: userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/admin/usuarios");
}

// ─── Adicionar membro (SO cria conta nova) ────────────────
// Fluxo:
//  1. Pre-checa o teto de seats (conta membros atuais vs. tenants.seats) pra nao
//     nascer uma conta orfa se o teto ja estiver cheio.
//  2. Cria a conta via Admin API com senha temporaria e email_confirm=true.
//     Se o GoTrue disser que o email ja existe -> paramos e mandamos falar com a
//     ACID (nao anexamos conta alheia sem consentimento).
//  3. Anexa ao tenant via meu_tenant_definir_papel (que reforca o teto por dentro).
//     Se falhar, deleta a conta recem-criada (rollback best-effort).
export async function adicionarMembro(
  emailRaw: string,
  role: string
): Promise<{ email: string; senhaTemporaria: string }> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("E-mail inválido.");
  if (!ROLES.includes(role as Role)) throw new Error("Papel inválido.");

  const supabase = createClient();

  // 1. Pre-checa seats. Resolve o tenant pela associacao (self-read), le o teto
  //    (self-read em tenants) e conta membros via a propria RPC (admin-gated).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: tu } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const tenantId = (tu as { tenant_id: string } | null)?.tenant_id;
  if (!tenantId) throw new Error("Tenant da sessão não resolvido.");

  const [{ data: tenantRow }, { data: membros, error: membrosErr }] =
    await Promise.all([
      supabase.from("tenants").select("seats").eq("id", tenantId).maybeSingle(),
      supabase.rpc("meus_usuarios"),
    ]);
  if (membrosErr) throw new Error(membrosErr.message);
  const seats = (tenantRow as { seats: number | null } | null)?.seats ?? null;
  const usados = (membros ?? []).length;
  if (seats !== null && usados >= seats) {
    throw new Error(
      `Teto de seats atingido (${usados} de ${seats}). Fale com a ACID para ampliar o plano antes de adicionar membros.`
    );
  }

  // 2. Cria a conta nova.
  const senha = senhaTemporaria();
  const admin = serviceDb();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (createErr) {
    // GoTrue sinaliza email ja cadastrado — nao anexamos conta alheia.
    const msg = createErr.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      throw new Error(
        "Já existe uma conta com esse e-mail. Fale com a ACID para vincular esse usuário ao seu workspace."
      );
    }
    throw new Error(createErr.message);
  }
  const newId = created.user?.id;
  if (!newId) throw new Error("Falha ao criar a conta.");

  // 3. Anexa ao tenant.
  const { error: papelErr } = await supabase.rpc("meu_tenant_definir_papel", {
    p_user: newId,
    p_role: role,
  });
  if (papelErr) {
    // Rollback best-effort: a conta nasceu mas nao pertence a nenhum tenant.
    await admin.auth.admin.deleteUser(newId).catch(() => {});
    throw new Error(papelErr.message);
  }

  revalidatePath("/dashboard/admin/usuarios");
  return { email, senhaTemporaria: senha };
}

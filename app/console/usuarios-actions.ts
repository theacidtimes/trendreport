"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { inviteEmail } from "@/lib/email/templates";

// Gerenciamento de usuarios/seats dos tenants pela ACID. As RPCs (0026) travam
// em is_acid_admin() por dentro; estas actions so orquestram. A criacao de conta
// nova usa a Admin API (service_role) — a unica coisa que uma RPC nao faz, ja
// que auth.users so aceita escrita via GoTrue/Admin, nao via SQL de app.

const ROLES = ["admin", "editor", "viewer"] as const;
type Role = (typeof ROLES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UsuarioTenant {
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

// Origem real da requisicao (local: localhost; prod: dominio Vercel via forwarded).
function origin(): string {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
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

// ─── Listar membros do tenant ─────────────────────────────
export async function listarUsuariosTenant(
  tenantId: string
): Promise<UsuarioTenant[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("acid_tenant_usuarios", {
    p_tenant: tenantId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as UsuarioTenant[];
}

// ─── Definir papel de um membro ja existente ──────────────
export async function definirPapel(
  tenantId: string,
  userId: string,
  role: string
): Promise<void> {
  if (!ROLES.includes(role as Role)) throw new Error("Papel inválido.");
  const supabase = createClient();
  const { error } = await supabase.rpc("acid_definir_papel", {
    p_tenant: tenantId,
    p_user: userId,
    p_role: role,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/console/tenants/${tenantId}`);
}

// ─── Remover membro ───────────────────────────────────────
export async function removerMembro(
  tenantId: string,
  userId: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("acid_remover_membro", {
    p_tenant: tenantId,
    p_user: userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/console/tenants/${tenantId}`);
}

// ─── Adicionar usuario (anexa existente OU cria conta nova) ─
// Fluxo:
//  1. Resolve o email contra auth.users (acid_buscar_usuario).
//  2. Se ja existe conta -> so anexa ao tenant com o papel (acid_definir_papel).
//  3. Se nao existe -> pre-checa o teto de seats, cria a conta via Admin API
//     com senha temporaria e email_confirm=true, entao anexa. Retorna a senha
//     temporaria pra ACID repassar ao usuario (nao dependemos de SMTP).
// A pre-checagem de seats antes do createUser evita orfanar uma conta caso o
// teto ja esteja cheio (a RPC tambem barra, mas ai a conta ja teria nascido).
export async function adicionarUsuario(
  tenantId: string,
  emailRaw: string,
  role: string
): Promise<{ criado: boolean; email: string; senhaTemporaria?: string }> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("E-mail inválido.");
  if (!ROLES.includes(role as Role)) throw new Error("Papel inválido.");

  const supabase = createClient();

  // 1. Ja tem conta?
  const { data: existingId, error: buscaErr } = await supabase.rpc(
    "acid_buscar_usuario",
    { p_email: email }
  );
  if (buscaErr) throw new Error(buscaErr.message);

  // 2. Conta existente -> anexa.
  if (existingId) {
    const { error } = await supabase.rpc("acid_definir_papel", {
      p_tenant: tenantId,
      p_user: existingId as string,
      p_role: role,
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/console/tenants/${tenantId}`);
    return { criado: false, email };
  }

  // 3. Conta nova -> pre-checa seats antes de criar (nao orfanar conta).
  const [{ data: tenantRow }, { count }] = await Promise.all([
    supabase.from("tenants").select("seats").eq("id", tenantId).maybeSingle(),
    supabase
      .from("tenant_users")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);
  const seats = (tenantRow as { seats: number | null } | null)?.seats ?? null;
  const usados = count ?? 0;
  if (seats !== null && usados >= seats) {
    throw new Error(
      `Teto de seats atingido (${usados} de ${seats}). Amplie o plano antes de adicionar usuários.`
    );
  }

  const senha = senhaTemporaria();
  const admin = serviceDb();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });
  if (createErr) throw new Error(createErr.message);
  const newId = created.user?.id;
  if (!newId) throw new Error("Falha ao criar a conta.");

  const { error: papelErr } = await supabase.rpc("acid_definir_papel", {
    p_tenant: tenantId,
    p_user: newId,
    p_role: role,
  });
  if (papelErr) {
    // Rollback best-effort: a conta nasceu mas nao pertence a nenhum tenant.
    await admin.auth.admin.deleteUser(newId).catch(() => {});
    throw new Error(papelErr.message);
  }

  revalidatePath(`/console/tenants/${tenantId}`);
  return { criado: true, email, senhaTemporaria: senha };
}

// ─── Convidar o admin INICIAL de um tenant (onboarding por e-mail) ─
// Diferente do adicionarUsuario (senha temporaria repassada na mao): aqui a pessoa
// recebe um e-mail branded, clica, define a PROPRIA senha e vira o 1o usuario ativo.
// Fluxo:
//  1. Ja existe conta? -> so anexa como admin (sem e-mail; conta ja ativa).
//  2. Nao existe -> generateLink type=invite CRIA a conta e devolve o token; anexa
//     como admin e manda o e-mail de convite apontando pro /auth/confirm -> /ativar.
// Best-effort proposital: e chamado DEPOIS do provisionar_tenant, entao um erro aqui
// nao desfaz o tenant — a ACID reenvia o convite pela pagina do tenant.
export async function convidarAdminInicial(
  tenantId: string,
  emailRaw: string
): Promise<{ criado: boolean; email: string }> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("E-mail do admin inválido.");

  const supabase = createClient();

  // Nome do tenant pro corpo do e-mail.
  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("nome")
    .eq("id", tenantId)
    .maybeSingle();
  const tenantNome = (tenantRow as { nome: string } | null)?.nome ?? "seu workspace";

  // 1. Conta ja existe -> so anexa como admin.
  const { data: existingId, error: buscaErr } = await supabase.rpc(
    "acid_buscar_usuario",
    { p_email: email }
  );
  if (buscaErr) throw new Error(buscaErr.message);

  if (existingId) {
    const { error } = await supabase.rpc("acid_definir_papel", {
      p_tenant: tenantId,
      p_user: existingId as string,
      p_role: "admin",
    });
    if (error) throw new Error(error.message);
    revalidatePath(`/console/tenants/${tenantId}`);
    return { criado: false, email };
  }

  // 2. Conta nova -> generateLink type=invite cria a conta e devolve o token.
  const admin = serviceDb();
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
  });
  if (linkErr) throw new Error(linkErr.message);
  const newId = link.user?.id;
  const hash = link.properties?.hashed_token;
  if (!newId || !hash) throw new Error("Falha ao gerar o convite.");

  // Anexa como admin. Rollback best-effort se falhar (nao orfanar a conta).
  const { error: papelErr } = await supabase.rpc("acid_definir_papel", {
    p_tenant: tenantId,
    p_user: newId,
    p_role: "admin",
  });
  if (papelErr) {
    await admin.auth.admin.deleteUser(newId).catch(() => {});
    throw new Error(papelErr.message);
  }

  const actionUrl = `${origin()}/auth/confirm?token_hash=${hash}&type=invite&next=/ativar`;
  const { subject, html } = inviteEmail({ tenantNome, actionUrl });
  await sendEmail({ to: email, subject, html });

  revalidatePath(`/console/tenants/${tenantId}`);
  return { criado: true, email };
}

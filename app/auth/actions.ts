"use server";

import { headers } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { resetEmail } from "@/lib/email/templates";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// service_role: único caminho pra gerar action link (Admin API). Fica server-side.
function serviceDb() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Origem real da requisição (local: localhost; prod: domínio Vercel via forwarded).
function origin(): string {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ─── Solicitar reset de senha ─────────────────────────────────
// Gera o link de recuperação e manda o e-mail branded. NUNCA revela se o e-mail
// existe (anti-enumeração): erro de "usuário inexistente" é engolido e a resposta é
// sempre a mesma. Só erro de INFRA (SMTP/env) borbulha, pra não esconder falha real.
export async function solicitarReset(emailRaw: string): Promise<{ ok: true }> {
  const email = emailRaw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error("E-mail inválido.");

  const admin = serviceDb();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  // Usuário não existe -> resposta idêntica ao sucesso (não vaza a base de contas).
  if (error) {
    if (/not found|no user|does not exist/i.test(error.message)) return { ok: true };
    throw new Error(error.message);
  }

  const hash = data.properties?.hashed_token;
  if (!hash) throw new Error("Falha ao gerar o link de recuperação.");

  const actionUrl = `${origin()}/auth/confirm?token_hash=${hash}&type=recovery&next=/redefinir-senha`;
  const { subject, html } = resetEmail({ actionUrl });
  await sendEmail({ to: email, subject, html });

  return { ok: true };
}

// ─── Redefinir a senha (já com sessão de recovery via /auth/confirm) ─
export async function redefinirSenha(novaSenha: string): Promise<{ ok: true }> {
  if (novaSenha.length < 8) {
    throw new Error("A senha precisa ter ao menos 8 caracteres.");
  }
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sessão de recuperação expirada. Peça um novo link.");

  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) throw new Error(error.message);
  return { ok: true };
}

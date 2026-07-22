"use server";

import { headers } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { resetEmail } from "@/lib/email/templates";
import { TERMOS_VERSAO } from "@/lib/legal";

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

// IP do cliente pro registro de aceite (comprovação). x-forwarded-for pode vir
// como lista "cliente, proxy1, proxy2": o primeiro é o cliente real.
function clientIp(): string | null {
  const h = headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
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

// ─── Ativar conta (convite de onboarding, sessão via /auth/confirm type=invite) ─
// A pessoa já foi anexada ao tenant como admin no convite; aqui ela só define nome
// e senha e vira usuário ativo. full_name entra no user_metadata. O primeiro login
// é também o momento do aceite dos T&C: gravamos versão, timestamp e IP no
// user_metadata como comprovação (LGPD/aceite eletrônico).
export async function ativarConta(
  nomeRaw: string,
  senha: string,
  aceitouTermos: boolean
): Promise<{ ok: true }> {
  const nome = nomeRaw.trim();
  if (!nome) throw new Error("Informe seu nome.");
  if (senha.length < 8) throw new Error("A senha precisa ter ao menos 8 caracteres.");
  if (!aceitouTermos) throw new Error("É necessário aceitar os Termos e Condições para ativar a conta.");

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Convite expirado. Peça um novo para o administrador.");

  const { error } = await supabase.auth.updateUser({
    password: senha,
    data: {
      full_name: nome,
      termos_versao: TERMOS_VERSAO,
      termos_aceitos_em: new Date().toISOString(),
      termos_aceite_ip: clientIp(),
    },
  });
  if (error) throw new Error(error.message);
  return { ok: true };
}

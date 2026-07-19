// Envio transacional via Resend (convite de onboarding + reset de senha). Feito
// com fetch cru pra NÃO adicionar dependência: a API do Resend é um POST simples.
// A key é sending-only (restrita a enviar) e não é NEXT_PUBLIC, então nunca chega
// ao client — só server actions e route handlers importam este módulo.
//
// RESEND_FROM precisa ser um remetente de domínio VERIFICADO no Resend (subdomínio
// dedicado, pra não sujar a reputação do Workspace raiz). Ausência de env = erro
// explícito no envio (falha barulhenta, não silenciosa).

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey) throw new Error("RESEND_API_KEY ausente — e-mail não enviado.");
  if (!from) throw new Error("RESEND_FROM ausente — e-mail não enviado.");

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const detalhe = await res.text().catch(() => "");
    throw new Error(`Resend HTTP ${res.status} ao enviar "${subject}": ${detalhe}`);
  }
}

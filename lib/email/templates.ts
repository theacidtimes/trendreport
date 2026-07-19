// Templates HTML dos e-mails transacionais. Puro (sem I/O): recebem os dados e o
// link de ação já pronto, devolvem { subject, html }. HTML de e-mail é table-based
// e com estilo INLINE de propósito — Gmail/Outlook ignoram <style> e classes. As
// cores batem com o visual da plataforma (lime #81D300, roxo #A063E8, base escura).

interface EmailContent {
  subject: string;
  html: string;
}

const BG = "#0A0A0A";
const SURFACE = "#141414";
const BORDER = "#262626";
const TEXT = "#FFFFFF";
const MUTED = "#A3A3A3";

// Casca comum: card escuro centralizado, com acento de cor por tipo de e-mail.
function shell(opts: {
  accent: string;
  preheader: string;
  heading: string;
  body: string; // HTML interno (parágrafos + botão)
}): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:${BG};color:${TEXT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${SURFACE};border:1px solid ${BORDER};border-radius:20px;overflow:hidden;">
      <tr><td style="height:4px;background:${opts.accent};"></td></tr>
      <tr><td style="padding:36px 36px 32px;">
        <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:${opts.accent};font-weight:700;margin-bottom:20px;">Acid Fabric</div>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:600;color:${TEXT};">${opts.heading}</h1>
        ${opts.body}
      </td></tr>
    </table>
    <p style="max-width:480px;margin:24px auto 0;font-size:12px;line-height:1.5;color:${MUTED};text-align:center;">
      Se você não esperava este e-mail, pode ignorá-lo com segurança. O link expira em breve por motivo de segurança.
    </p>
  </td></tr>
</table>
</body>
</html>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${MUTED};">${text}</p>`;
}

function button(url: string, label: string, accent: string, textColor: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
    <tr><td style="border-radius:12px;background:${accent};">
      <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:${textColor};text-decoration:none;border-radius:12px;">${label}</a>
    </td></tr>
  </table>`;
}

function fallbackLink(url: string): string {
  return `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:${MUTED};word-break:break-all;">
    Se o botão não abrir, cole este link no navegador:<br>
    <a href="${url}" style="color:${MUTED};">${url}</a>
  </p>`;
}

// ─── Convite de onboarding (novo admin de um tenant) ──────────
export function inviteEmail(opts: {
  tenantNome: string;
  actionUrl: string;
}): EmailContent {
  const LIME = "#81D300";
  return {
    subject: `Seu acesso ao workspace ${opts.tenantNome} está pronto`,
    html: shell({
      accent: LIME,
      preheader: `Ative sua conta e entre no workspace ${opts.tenantNome}.`,
      heading: `Bem-vindo ao ${opts.tenantNome}`,
      body: [
        paragraph(
          `Você foi convidado como administrador do workspace <strong style="color:${TEXT};">${opts.tenantNome}</strong> na plataforma de inteligência cultural da Acid Fabric.`
        ),
        paragraph(
          "Aqui você acompanha os sinais culturais que o radar captura para as suas marcas em tempo real. Para começar, ative sua conta e defina sua senha:"
        ),
        button(opts.actionUrl, "Ativar minha conta", LIME, "#000000"),
        fallbackLink(opts.actionUrl),
      ].join(""),
    }),
  };
}

// ─── Reset de senha ───────────────────────────────────────────
export function resetEmail(opts: { actionUrl: string }): EmailContent {
  const PURPLE = "#A063E8";
  return {
    subject: "Redefinir sua senha",
    html: shell({
      accent: PURPLE,
      preheader: "Crie uma nova senha para sua conta.",
      heading: "Redefinir sua senha",
      body: [
        paragraph(
          "Recebemos um pedido para redefinir a senha da sua conta. Clique abaixo para criar uma nova senha:"
        ),
        button(opts.actionUrl, "Criar nova senha", PURPLE, "#FFFFFF"),
        fallbackLink(opts.actionUrl),
      ].join(""),
    }),
  };
}

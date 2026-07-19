import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Ponto de aterrissagem dos links de e-mail (convite e recuperação). O link que a
// gente manda aponta pra CÁ (não pro Supabase direto), com token_hash + type + next.
// verifyOtp troca o token por uma sessão e grava os cookies via o client SSR; então
// redireciona pro destino (ativar conta / redefinir senha). Sem token válido, cai no
// login com marca de erro. Padrão recomendado do @supabase/ssr (fluxo por token_hash,
// não o implicit flow com fragmento de URL que não chega ao server).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  // next só pode ser caminho interno (evita open redirect via ?next=http://...).
  const destino = next.startsWith("/") ? next : "/dashboard";

  if (token_hash && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(`${origin}${destino}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?erro=link_invalido`);
}

import { createClient } from "@/lib/supabase/client";

// Quais tours de novidade a pessoa já viu. Fica no user_metadata do Supabase
// (sem migration) pra não reaparecer ao trocar de computador; o localStorage é
// só o cache rápido e a rede de segurança quando o updateUser falha.

const CHAVE_LOCAL = "tours_vistos";

function lerLocal(): string[] {
  try {
    const raw = window.localStorage.getItem(CHAVE_LOCAL);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function gravarLocal(ids: string[]) {
  try {
    window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify(ids));
  } catch {
    /* sem storage: vale só nesta sessão */
  }
}

export async function tourVisto(id: string): Promise<boolean> {
  if (lerLocal().includes(id)) return true;
  try {
    const { data } = await createClient().auth.getUser();
    const vistos = (data.user?.user_metadata?.tours_vistos ?? []) as string[];
    if (vistos.length) gravarLocal(Array.from(new Set([...lerLocal(), ...vistos])));
    return vistos.includes(id);
  } catch {
    return false;
  }
}

export async function marcarTourVisto(id: string): Promise<void> {
  const locais = Array.from(new Set([...lerLocal(), id]));
  gravarLocal(locais);
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const vistos = (data.user.user_metadata?.tours_vistos ?? []) as string[];
    if (vistos.includes(id)) return;
    await supabase.auth.updateUser({
      data: { tours_vistos: Array.from(new Set([...vistos, ...locais])) },
    });
  } catch {
    /* fica só no localStorage */
  }
}

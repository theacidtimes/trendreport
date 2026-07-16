"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TenantBranding } from "@/lib/types";

// #RRGGBB (aceita maiusc/minusc); vazio = limpar o campo.
const HEX = /^#[0-9a-fA-F]{6}$/;

function clean(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

export async function salvarBranding(input: {
  display_name: string;
  logo_url: string;
  cor_primaria: string;
  cor_destaque: string;
}): Promise<void> {
  const display_name = clean(input.display_name);
  const logo_url = clean(input.logo_url);
  const cor_primaria = clean(input.cor_primaria);
  const cor_destaque = clean(input.cor_destaque);

  if (logo_url && !/^https?:\/\//i.test(logo_url)) {
    throw new Error("O logo precisa ser uma URL http(s).");
  }
  if (cor_primaria && !HEX.test(cor_primaria)) {
    throw new Error("Cor primária inválida (use #RRGGBB).");
  }
  if (cor_destaque && !HEX.test(cor_destaque)) {
    throw new Error("Cor de destaque inválida (use #RRGGBB).");
  }

  // Só grava as chaves preenchidas; campo vazio remove a chave (volta ao
  // fallback ACID). Nunca envia saldo/seats/status — a RPC só toca branding.
  const branding: TenantBranding = {};
  if (display_name) branding.display_name = display_name;
  if (logo_url) branding.logo_url = logo_url;
  if (cor_primaria) branding.cor_primaria = cor_primaria.toUpperCase();
  if (cor_destaque) branding.cor_destaque = cor_destaque.toUpperCase();

  const supabase = createClient();
  const { error } = await supabase.rpc("atualizar_branding", {
    p_branding: branding,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin/marca");
}

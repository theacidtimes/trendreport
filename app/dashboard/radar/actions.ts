"use server";

import { createClient } from "@/lib/supabase/server";

export async function toggleMarca(id: string, status: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("marcas")
    .update({ status_varredura: status })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

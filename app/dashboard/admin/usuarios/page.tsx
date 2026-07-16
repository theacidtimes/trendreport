import { createClient } from "@/lib/supabase/server";
import MembrosManager from "@/components/admin/MembrosManager";
import type { Membro } from "@/app/dashboard/admin/usuarios/actions";

// Aba "Usuários": gestao self-serve dos membros do PROPRIO tenant, pelo admin do
// tenant. Lista, papel e remocao saem das RPCs tenant-scoped (0028), que resolvem o
// tenant de jwt_tenant_id() por dentro. O teto de seats e read-only: quem vende
// seat e a ACID (console); aqui o admin so preenche ate o teto.
export default async function UsuariosPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Membros do tenant (com email) via RPC admin-gated.
  const { data: membrosData } = await supabase.rpc("meus_usuarios");
  const membros = (membrosData ?? []) as Membro[];

  // Teto de seats: self-read da associacao -> tenants.seats.
  const { data: tu } = user
    ? await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const tenantId = (tu as { tenant_id: string } | null)?.tenant_id;

  const { data: tenantRow } = tenantId
    ? await supabase
        .from("tenants")
        .select("seats")
        .eq("id", tenantId)
        .maybeSingle()
    : { data: null };
  const seats = (tenantRow as { seats: number | null } | null)?.seats ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="kicker text-muted-2">Time do workspace</span>
        <h1 className="font-serif text-white font-medium text-3xl md:text-4xl leading-tight">
          Usuários
        </h1>
        <p className="text-muted text-sm max-w-2xl leading-relaxed">
          Quem tem acesso ao seu Acid Fabric e com qual papel. Admins gerenciam
          o time; editores criam e editam reports; viewers só leem.
        </p>
      </div>

      <MembrosManager membros={membros} seats={seats} />
    </div>
  );
}

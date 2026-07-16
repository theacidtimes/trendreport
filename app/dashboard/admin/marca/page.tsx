import { createClient } from "@/lib/supabase/server";
import BrandingForm from "@/components/admin/BrandingForm";
import type { Tenant, TenantBranding } from "@/lib/types";

export default async function MarcaPage() {
  const supabase = createClient();

  // A rota já é protegida pelo admin/layout (checkIsAdmin). Resolve o tenant do
  // usuário pela própria associação (self-read na policy de tenant_users).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tu } = user
    ? await supabase
        .from("tenant_users")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };
  const tenantId = tu?.tenant_id as string | undefined;

  const { data: tenantRow } = tenantId
    ? await supabase
        .from("tenants")
        .select("id, nome, branding")
        .eq("id", tenantId)
        .maybeSingle()
    : { data: null };
  const tenant = tenantRow as Pick<
    Tenant,
    "id" | "nome" | "branding"
  > | null;

  const branding = (tenant?.branding ?? {}) as TenantBranding;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="kicker text-muted-2">Identidade white-label</span>
        <h1 className="font-serif text-white font-medium text-3xl md:text-4xl leading-tight">
          Marca
        </h1>
        <p className="text-muted text-sm max-w-2xl leading-relaxed">
          A cara do seu espaço no Acid Fabric: nome de exibição, logo e cores.
          O que ficar em branco herda o padrão da ACID.
        </p>
      </div>

      {!tenant ? (
        <div className="rounded-3xl bg-surface border border-border p-10 text-center text-muted text-sm">
          Não foi possível resolver o tenant desta sessão.
        </div>
      ) : (
        <BrandingForm initial={branding} />
      )}
    </div>
  );
}

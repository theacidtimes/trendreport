import { createClient } from "@/lib/supabase/server";
import BrandingForm from "@/components/admin/BrandingForm";
import type { Tenant, TenantBranding } from "@/lib/types";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admins",
  editor: "Editores",
  viewer: "Viewers",
};

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
        .select("id, nome, branding, seats")
        .eq("id", tenantId)
        .maybeSingle()
    : { data: null };
  const tenant = tenantRow as Pick<
    Tenant,
    "id" | "nome" | "branding" | "seats"
  > | null;

  const { data: usuariosRow } = tenantId
    ? await supabase
        .from("tenant_users")
        .select("role")
        .eq("tenant_id", tenantId)
    : { data: [] };
  const usuarios = (usuariosRow ?? []) as { role: string }[];
  const roleCounts = usuarios.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] ?? 0) + 1;
    return acc;
  }, {});

  const branding = (tenant?.branding ?? {}) as TenantBranding;
  const seats = tenant?.seats ?? 0;
  const usados = usuarios.length;

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
        <>
          <BrandingForm initial={branding} />

          {/* Seats / usuários no teto */}
          <section className="flex flex-col gap-3">
            <h2 className="kicker text-muted-2">
              Seats · {usados}/{seats}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryStat value={`${usados}/${seats}`} label="Seats usados" />
              {(["admin", "editor", "viewer"] as const).map((role) => (
                <SummaryStat
                  key={role}
                  value={roleCounts[role] ?? 0}
                  label={ROLE_LABEL[role]}
                />
              ))}
            </div>
            {usados > seats && (
              <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2.5">
                O tenant está acima do teto de seats contratado. Fale com a ACID
                para ampliar o plano.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SummaryStat({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  return (
    <div className="rounded-3xl bg-surface border border-border p-5 flex flex-col gap-1 shadow-card">
      <span className="text-white text-3xl font-bold tabular-nums">{value}</span>
      <span className="text-muted text-[11px] uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

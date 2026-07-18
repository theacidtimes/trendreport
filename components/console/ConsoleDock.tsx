"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Building2, DoorOpen, Droplets, Zap, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Dock flutuante — EXCLUSIVO do console ACID. É o sinal visual de que se saiu do
// produto do cliente (rail lateral) e entrou no ambiente cross-tenant da ACID.
// Não reusar no workspace do tenant.
const ITEMS = [
  {
    href: "/console",
    label: "Tenants",
    icon: Building2,
    match: (p: string) => p === "/console" || p.startsWith("/console/tenants"),
  },
  {
    href: "/console/saude",
    label: "Saúde",
    icon: Activity,
    match: (p: string) => p.startsWith("/console/saude"),
  },
  {
    href: "/console/lake",
    label: "Lake",
    icon: Droplets,
    match: (p: string) => p.startsWith("/console/lake"),
  },
];

export default function ConsoleDock({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="fixed z-50 bottom-5 left-1/2 -translate-x-1/2 print:hidden">
      <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface-2/80 backdrop-blur-xl px-2 py-2 shadow-elevated">
        {/* Marca do console — Acid Fabric */}
        <span
          className="group/item relative grid place-items-center h-11 w-11 rounded-xl bg-purple/15 text-purple"
          aria-label="Console Acid Fabric"
        >
          <Zap className="w-[18px] h-[18px]" strokeWidth={2.4} />
          <Tooltip>Console Acid Fabric</Tooltip>
        </span>

        <span className="mx-1 h-6 w-px bg-hairline" />

        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`group/item relative grid place-items-center h-11 w-11 rounded-xl transition-colors ${
                active
                  ? "bg-surface-3 text-white"
                  : "text-muted hover:text-white hover:bg-surface/70"
              }`}
            >
              {active && (
                <span className="absolute -bottom-0.5 h-0.5 w-5 rounded-full bg-purple" />
              )}
              <Icon className="w-[18px] h-[18px]" strokeWidth={active ? 2.4 : 2} />
              <Tooltip>{label}</Tooltip>
            </Link>
          );
        })}

        <span className="mx-1 h-6 w-px bg-hairline" />

        {/* Sair do console de volta pro workspace do tenant */}
        <Link
          href="/dashboard"
          aria-label="Voltar ao workspace"
          className="group/item relative grid place-items-center h-11 w-11 rounded-xl text-muted hover:text-white hover:bg-surface/70 transition-colors"
        >
          <DoorOpen className="w-[18px] h-[18px]" strokeWidth={2} />
          <Tooltip>Voltar ao workspace</Tooltip>
        </Link>

        <button
          onClick={handleSignOut}
          aria-label="Sair"
          className="group/item relative grid place-items-center h-11 w-11 rounded-xl text-muted hover:text-white hover:bg-surface/70 transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" strokeWidth={2} />
          <span className="pointer-events-none absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center whitespace-nowrap rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-white opacity-0 translate-y-1 shadow-elevated transition-all duration-150 group-hover/item:opacity-100 group-hover/item:translate-y-0">
            <span className="font-medium leading-tight">Sair</span>
            {userEmail && (
              <span className="text-[11px] text-muted-2 leading-tight">
                {userEmail}
              </span>
            )}
          </span>
        </button>
      </div>
    </nav>
  );
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 translate-y-1 shadow-elevated transition-all duration-150 group-hover/item:opacity-100 group-hover/item:translate-y-0">
      {children}
    </span>
  );
}

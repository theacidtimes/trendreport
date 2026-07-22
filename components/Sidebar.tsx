"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bolt,
  Info,
  LayoutGrid,
  LogOut,
  Plus,
  Radar,
  Waypoints,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Logo from "./Logo";
import CreditTicker from "./CreditTicker";
import TermosModal from "./TermosModal";
import { OPERADO_POR } from "@/lib/legal";
import type { TenantBranding } from "@/lib/types";

// `modulo` mapeia o item ao "app" do Acid Fabric que o habilita (enforcement de
// modulo). Item sem `modulo` (ex. a lista de Reports, home segura) aparece sempre.
const NAV = [
  { href: "/dashboard/new", label: "Novo report", icon: Plus, modulo: "reports" },
  { href: "/dashboard", label: "Reports", icon: LayoutGrid },
  { href: "/dashboard/radar", label: "Radar", icon: Radar, modulo: "radar" },
  { href: "/dashboard/mapa", label: "Mapa semântico", icon: Waypoints, modulo: "dados_semanticos" },
] as const;

const ADMIN_NAV = [{ href: "/dashboard/admin", label: "Admin", icon: Bolt }];

function isActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar({
  userEmail,
  isAdmin = false,
}: {
  userEmail?: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // "Admin" no rail = app_admin GLOBAL (prop, vem do SSR, sem flash pro zampoli)
  // OU admin do PRÓPRIO tenant (detectado no client). Unifica a noção: o gate do
  // /dashboard/admin (layout) já é `is_app_admin OR sou_admin_do_meu_tenant`;
  // aqui o rail passa a mostrar a porta pra quem esse gate deixa entrar, sem ter
  // que threadar prop por todos os layouts do workspace.
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);
  const canAdmin = isAdmin || isTenantAdmin;
  const [termosOpen, setTermosOpen] = useState(false);

  // Modulos ativos do tenant (enforcement): esconde do rail o que nao foi
  // assinado. null = carregando OU rpc falhou -> mostra TUDO (fail-open, sem
  // flash-esconder pro Caramelo que tem os 3). So filtra quando a lista chega.
  const [modulos, setModulos] = useState<string[] | null>(null);
  const nav = canAdmin ? [...NAV, ...ADMIN_NAV] : NAV;
  const visibleNav = nav.filter((item) => {
    const m = (item as { modulo?: string }).modulo;
    return !m || modulos === null || modulos.includes(m);
  });

  // Marca white-label do tenant (Fase 4E) — busca única via rpc, fallback ACID
  // fica no próprio Logo. Só o admin do tenant edita; todos do tenant enxergam.
  const [branding, setBranding] = useState<TenantBranding>({});
  useEffect(() => {
    const supabase = createClient();
    supabase
      .rpc("sou_admin_do_meu_tenant")
      .then(({ data }) => setIsTenantAdmin(data === true));
    supabase
      .rpc("meus_modulos")
      .then(({ data }) =>
        setModulos(Array.isArray(data) ? (data as string[]) : null)
      );
    supabase.rpc("meu_branding").then(({ data }) => {
      if (!data || typeof data !== "object") return;
      const b = data as TenantBranding;
      setBranding(b);
      // Paleta dinâmica: troca SÓ onde hoje aparece roxo/verde (tokens --purple
      // e --lime). Tenant sem cor custom (ex. Caramelo) fica nos defaults do
      // globals.css — nada muda. --purple-mid (hover) deriva da cor primária.
      const root = document.documentElement;
      if (b.cor_primaria) {
        root.style.setProperty("--purple", b.cor_primaria);
        root.style.setProperty(
          "--purple-mid",
          `color-mix(in srgb, ${b.cor_primaria} 45%, #140f1c)`
        );
      }
      if (b.cor_destaque) {
        root.style.setProperty("--lime", b.cor_destaque);
      }
    });
  }, []);
  const logoUrl = branding.logo_url || undefined;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Ticker de créditos — fixo, visível em qualquer página do dashboard.
          Linka pro extrato pra quem pode ver o admin (app_admin ou admin do tenant). */}
      <CreditTicker isAdmin={canAdmin} />

      {/* Desktop dock — fixed 80px icon rail with hover tooltips */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-20 md:z-40 border-r border-border bg-bg">
        <Link
          href="/dashboard"
          aria-label="caramelo trend report"
          className="grid place-items-center h-[68px] shrink-0"
        >
          <Logo size="md" wordmarkClassName="hidden" logoUrl={logoUrl} />
        </Link>

        <nav className="flex flex-col gap-1 px-3 mt-6">
          {visibleNav.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={`group/item relative grid place-items-center h-12 rounded-xl transition-colors ${
                  active
                    ? "bg-surface-2 text-white"
                    : "text-muted hover:text-white hover:bg-surface/70"
                }`}
              >
                {active && (
                  <span className="absolute left-0 h-6 w-0.5 rounded-full bg-purple" />
                )}
                <Icon
                  className="w-[18px] h-[18px]"
                  strokeWidth={active ? 2.4 : 2}
                />
                <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 translate-x-[-4px] shadow-elevated transition-all duration-150 group-hover/item:opacity-100 group-hover/item:translate-x-0">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-3 pb-6">
          <div className="pt-4 border-t border-hairline flex flex-col gap-1">
            <button
              onClick={handleSignOut}
              aria-label="Sair"
              className="group/item relative grid place-items-center w-full h-12 rounded-xl text-muted hover:text-white hover:bg-surface/70 transition-colors"
            >
              <LogOut className="w-[18px] h-[18px]" strokeWidth={2} />
              <span className="pointer-events-none absolute left-full ml-3 z-50 flex flex-col whitespace-nowrap rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-white opacity-0 translate-x-[-4px] shadow-elevated transition-all duration-150 group-hover/item:opacity-100 group-hover/item:translate-x-0">
                <span className="font-medium leading-tight">Sair</span>
                {userEmail && (
                  <span className="text-[11px] text-muted-2 leading-tight">
                    {userEmail}
                  </span>
                )}
              </span>
            </button>

            {/* Atribuição legal fixa da operadora — presente no produto pra
                qualquer tenant, independente do branding white-label. Abre os
                T&C em modal, sem tirar o usuário do workspace. */}
            <button
              type="button"
              onClick={() => setTermosOpen(true)}
              aria-label="Termos e Condições"
              className="group/item relative grid place-items-center w-full h-8 rounded-xl text-muted-2 hover:text-muted hover:bg-surface/70 transition-colors"
            >
              <Info className="w-[15px] h-[15px]" strokeWidth={2} />
              <span className="pointer-events-none absolute left-full ml-3 z-50 flex flex-col whitespace-nowrap rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-white opacity-0 translate-x-[-4px] shadow-elevated transition-all duration-150 group-hover/item:opacity-100 group-hover/item:translate-x-0">
                <span className="text-[11px] text-muted leading-tight">
                  {OPERADO_POR}
                </span>
                <span className="text-[11px] font-medium leading-tight mt-0.5">
                  Termos e Condições
                </span>
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex md:hidden h-14 items-center justify-between px-5 border-b border-border bg-bg/95 backdrop-blur sticky top-0 z-40">
        <Link href="/dashboard" className="flex items-center">
          <Logo size="sm" wordmarkClassName="hidden" logoUrl={logoUrl} />
        </Link>
        <div className="flex items-center gap-4">
          {visibleNav.map(({ href, icon: Icon, label }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className={`relative grid place-items-center w-9 h-9 rounded-lg transition-colors ${
                  active
                    ? "bg-surface-2 text-white"
                    : "text-muted hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} />
              </Link>
            );
          })}
          {userEmail && (
            <button
              onClick={handleSignOut}
              aria-label="Sair"
              className="text-muted hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" strokeWidth={2} />
            </button>
          )}
        </div>
      </header>

      {termosOpen && <TermosModal onClose={() => setTermosOpen(false)} />}
    </>
  );
}

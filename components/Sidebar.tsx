"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, LogOut, Plus, Sparkle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard/new", label: "Novo report", icon: Plus },
  { href: "/dashboard", label: "Reports", icon: LayoutGrid },
];

export default function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 md:z-40 border-r border-border bg-bg px-5 py-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-1 mb-10">
          <span className="w-8 h-8 shrink-0 rounded-full bg-lime flex items-center justify-center">
            <Sparkle className="w-4 h-4 text-black" strokeWidth={2.5} fill="currentColor" />
          </span>
          <div className="flex flex-col leading-none gap-1">
            <span className="text-white font-bold text-[15px]">cccaramelo</span>
            <span className="text-muted text-[10px] uppercase tracking-[0.14em]">
              trend report
            </span>
          </div>
        </Link>

        <nav className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`group flex items-center gap-3 h-11 px-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-surface text-white"
                    : "text-muted hover:text-white hover:bg-surface/60"
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] transition-colors ${
                    active ? "text-lime" : "text-muted group-hover:text-white"
                  }`}
                  strokeWidth={2}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3 pt-5 border-t border-border">
          {userEmail && (
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-muted text-xs truncate">{userEmail}</span>
              <button
                onClick={handleSignOut}
                aria-label="Sair"
                className="text-muted hover:text-lime transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex md:hidden h-14 items-center justify-between px-5 border-b border-border bg-bg/95 backdrop-blur sticky top-0 z-40">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="w-6 h-6 shrink-0 rounded-full bg-lime flex items-center justify-center">
            <Sparkle className="w-3 h-3 text-black" strokeWidth={2.5} fill="currentColor" />
          </span>
          <span className="text-white font-bold text-sm">cccaramelo</span>
        </Link>
        <div className="flex items-center gap-5">
          {NAV.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={pathname === href ? "text-lime" : "text-muted"}
            >
              <Icon className="w-5 h-5" strokeWidth={2} />
            </Link>
          ))}
          {userEmail && (
            <button onClick={handleSignOut} aria-label="Sair" className="text-muted">
              <LogOut className="w-5 h-5" strokeWidth={2} />
            </button>
          )}
        </div>
      </header>
    </>
  );
}

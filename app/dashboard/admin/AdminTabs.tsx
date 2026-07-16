"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coins, ScrollText, Users } from "lucide-react";

const TABS = [
  { href: "/dashboard/admin/clientes", label: "Clientes", icon: Users },
  { href: "/dashboard/admin/usuarios", label: "Usuários", icon: ScrollText },
  { href: "/dashboard/admin/creditos", label: "Créditos", icon: Coins },
];

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="inline-flex items-center gap-1 p-1 rounded-full bg-surface border border-border w-fit print:hidden">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-2 h-8 px-3.5 rounded-full text-sm font-medium transition-colors ${
              active
                ? "bg-surface-2 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                : "text-muted hover:text-white"
            }`}
          >
            <Icon
              className={`w-4 h-4 ${active ? "text-lime" : ""}`}
              strokeWidth={2}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

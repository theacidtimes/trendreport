"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollText, Users } from "lucide-react";

const TABS = [
  { href: "/dashboard/admin/clientes", label: "Clientes", icon: Users },
  { href: "/dashboard/admin/usuarios", label: "Usuários", icon: ScrollText },
];

export default function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 print:hidden">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-sm font-medium transition-colors ${
              active
                ? "bg-purple text-white"
                : "text-muted hover:text-white hover:bg-surface"
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

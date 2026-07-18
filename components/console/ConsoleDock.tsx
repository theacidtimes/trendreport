"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { Activity, Building2, Droplets, LogOut } from "lucide-react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { createClient } from "@/lib/supabase/client";

// Dock flutuante — EXCLUSIVO do console ACID. É o sinal visual de que se saiu do
// produto do cliente (rail lateral) e entrou no ambiente cross-tenant da ACID.
// Estilo aceternity: os ícones ampliam conforme a proximidade do cursor.
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

// Tamanhos base e ampliado (px) da célula e do ícone.
const BASE = 52;
const MAG = 90;
const ICON_BASE = 22;
const ICON_MAG = 40;
const RANGE = 150; // distância de influência do cursor

function useMagnify(mouseX: MotionValue<number>, ref: React.RefObject<HTMLElement | null>) {
  const distance = useTransform(mouseX, (val) => {
    const b = ref.current?.getBoundingClientRect();
    const center = b ? b.x + b.width / 2 : 0;
    return val - center;
  });
  const sizeSync = useTransform(distance, [-RANGE, 0, RANGE], [BASE, MAG, BASE]);
  const iconSync = useTransform(distance, [-RANGE, 0, RANGE], [ICON_BASE, ICON_MAG, ICON_BASE]);
  const spring = { mass: 0.1, stiffness: 150, damping: 12 };
  return {
    size: useSpring(sizeSync, spring),
    icon: useSpring(iconSync, spring),
  };
}

export default function ConsoleDock({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const mouseX = useMotionValue(Infinity);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/console/login");
    router.refresh();
  }

  return (
    <nav className="fixed z-50 bottom-6 left-1/2 -translate-x-1/2 print:hidden">
      <motion.div
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => mouseX.set(Infinity)}
        className="flex items-end gap-2 rounded-3xl border border-border bg-surface-2/80 backdrop-blur-xl px-3.5 py-3 shadow-elevated"
      >
        {/* Marca do console — Acid Fabric */}
        <DockCell mouseX={mouseX} label="Console Acid Fabric" tone="brand">
          {(iconSize) => (
            <motion.span style={{ width: iconSize, height: iconSize }} className="grid place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/fabric-mark.svg" alt="Acid Fabric" className="w-full h-full object-contain" />
            </motion.span>
          )}
        </DockCell>

        <Divider />

        {ITEMS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <DockCell
              key={href}
              mouseX={mouseX}
              label={label}
              href={href}
              active={active}
            >
              {(iconSize) => (
                <motion.span style={{ width: iconSize, height: iconSize }} className="grid place-items-center">
                  <Icon className="w-full h-full" strokeWidth={active ? 2.4 : 2} />
                </motion.span>
              )}
            </DockCell>
          );
        })}

        <Divider />

        <DockCell
          mouseX={mouseX}
          label={userEmail ? `Sair · ${userEmail}` : "Sair"}
          onClick={handleSignOut}
        >
          {(iconSize) => (
            <motion.span style={{ width: iconSize, height: iconSize }} className="grid place-items-center">
              <LogOut className="w-full h-full" strokeWidth={2} />
            </motion.span>
          )}
        </DockCell>
      </motion.div>
    </nav>
  );
}

function Divider() {
  return <span className="self-center mx-0.5 h-8 w-px bg-hairline" />;
}

function DockCell({
  mouseX,
  label,
  href,
  onClick,
  active = false,
  tone = "default",
  children,
}: {
  mouseX: MotionValue<number>;
  label: string;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  tone?: "default" | "brand";
  children: (iconSize: MotionValue<number>) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { size, icon } = useMagnify(mouseX, ref);

  const base =
    tone === "brand"
      ? "bg-purple/15 text-purple"
      : active
        ? "bg-surface-3 text-white"
        : "text-muted hover:text-white hover:bg-surface/70";

  const inner = (
    <>
      {active && (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-5 rounded-full bg-purple" />
      )}
      {children(icon)}
      <span className="pointer-events-none absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 whitespace-nowrap rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 translate-y-1 shadow-elevated transition-all duration-150 group-hover/cell:opacity-100 group-hover/cell:translate-y-0">
        {label}
      </span>
    </>
  );

  const className = `group/cell relative grid place-items-center rounded-2xl transition-colors ${base}`;

  return (
    <motion.div ref={ref} style={{ width: size, height: size }} className="shrink-0">
      {href ? (
        <Link href={href} aria-label={label} className={`${className} w-full h-full`}>
          {inner}
        </Link>
      ) : onClick ? (
        <button onClick={onClick} aria-label={label} className={`${className} w-full h-full`}>
          {inner}
        </button>
      ) : (
        <span aria-label={label} className={`${className} w-full h-full`}>
          {inner}
        </span>
      )}
    </motion.div>
  );
}

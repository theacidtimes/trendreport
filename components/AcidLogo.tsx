import { Zap } from "lucide-react";

const SIZES = {
  sm: { box: "w-8 h-8 rounded-lg", icon: "w-4 h-4", text: "text-sm", gap: "gap-2" },
  md: { box: "w-10 h-10 rounded-xl", icon: "w-5 h-5", text: "text-lg", gap: "gap-2.5" },
  lg: { box: "w-12 h-12 rounded-2xl", icon: "w-6 h-6", text: "text-2xl", gap: "gap-3" },
} as const;

// Marca do console ACID — o Acid Fabric é o produto da ACID (não do tenant).
// Espelha o mark do ConsoleDock (Zap roxo). Distinto do <Logo> white-label do
// workspace, que carrega a marca do tenant.
export default function AcidLogo({ size = "md" }: { size?: keyof typeof SIZES }) {
  const s = SIZES[size];
  return (
    <span className={`flex items-center ${s.gap}`}>
      <span className={`grid place-items-center shrink-0 bg-purple/15 text-purple ${s.box}`}>
        <Zap className={s.icon} strokeWidth={2.4} />
      </span>
      <span className={`font-sans font-bold tracking-[-0.01em] ${s.text}`}>
        <span className="text-white">Acid</span>
        <span className="text-purple"> Fabric</span>
      </span>
    </span>
  );
}

import { Plus } from "lucide-react";

// Plus dentro de um anel de gradiente (verde/roxo) que gira continuamente.
// O centro é transparente — o fundo do card aparece através do anel.
export default function AnimatedPlusBadge({
  size = 48,
}: {
  size?: number;
}) {
  return (
    <span
      className="relative grid place-items-center shrink-0"
      style={{ width: size, height: size }}
    >
      <span
        aria-hidden
        className="absolute inset-0 rounded-full animate-[spin_4s_linear_infinite]"
        style={{
          background:
            "conic-gradient(from 0deg, #81d300, #a063e8, #81d300, #a063e8, #81d300)",
          WebkitMask:
            "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
          mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 2px))",
        }}
      />
      <Plus className="relative w-5 h-5 text-white" strokeWidth={2.5} />
    </span>
  );
}

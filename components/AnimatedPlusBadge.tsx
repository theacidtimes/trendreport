import { Plus } from "lucide-react";

// Plus dentro de um anel cinza fino e estático. Ao passar o mouse no card
// (group), o + gira suavemente.
export default function AnimatedPlusBadge({
  size = 48,
}: {
  size?: number;
}) {
  return (
    <span
      className="relative grid place-items-center shrink-0 rounded-full border border-white/20"
      style={{ width: size, height: size }}
    >
      <Plus
        className="relative w-5 h-5 text-white/50 transition-transform duration-500 ease-spring group-hover:rotate-90"
        strokeWidth={2.5}
      />
    </span>
  );
}

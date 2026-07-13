"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BorderBeamProps {
  className?: string;
  duration?: number;
  borderWidth?: number;
}

// Borda em gradiente na perímetro inteira: um conic-gradient roxo/lime (mesma
// dupla do AnimatedPlusBadge) girando devagar, recortado num anel fino via
// máscara padding/XOR — só longhands, senão o shorthand `mask` zera o composite.
export function BorderBeam({
  className,
  duration = 8,
  borderWidth = 1.5,
}: BorderBeamProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit]",
        className
      )}
      style={{
        padding: `${borderWidth}px`,
        maskImage: "linear-gradient(#000, #000), linear-gradient(#000, #000)",
        maskClip: "content-box, border-box",
        maskComposite: "exclude",
        WebkitMaskImage:
          "linear-gradient(#000, #000), linear-gradient(#000, #000)",
        WebkitMaskClip: "content-box, border-box",
        WebkitMaskComposite: "xor",
      }}
    >
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 aspect-square w-[150%] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "conic-gradient(from 0deg, #81d300, #a063e8, #81d300, #a063e8, #81d300)",
        }}
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, ease: "linear", duration }}
      />
    </div>
  );
}

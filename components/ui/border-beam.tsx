"use client";

import { motion, type MotionStyle, type Transition } from "framer-motion";
import { cn } from "@/lib/utils";

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  delay?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
  transition?: Transition;
  style?: React.CSSProperties;
  reverse?: boolean;
  initialOffset?: number;
}

export function BorderBeam({
  className,
  size = 60,
  delay = 0,
  duration = 7,
  borderWidth = 1.5,
  colorFrom = "#a063e8",
  colorTo = "#81d300",
  transition,
  style,
  reverse = false,
  initialOffset = 0,
}: BorderBeamProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      // Recorta o feixe num anel fino: dois gradientes opacos (content-box vs
      // border-box) combinados com XOR sobram só a faixa do "padding" = a borda.
      // Só longhands — o shorthand `mask` zeraria mask-composite pro valor inicial.
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
        className={cn(
          "absolute aspect-square",
          "bg-gradient-to-l from-[var(--color-from)] via-[var(--color-to)] to-transparent",
          className
        )}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            "--color-from": colorFrom,
            "--color-to": colorTo,
            ...style,
          } as MotionStyle
        }
        initial={{ offsetDistance: `${initialOffset}%` }}
        animate={{
          offsetDistance: reverse
            ? [`${100 - initialOffset}%`, `${-initialOffset}%`]
            : [`${initialOffset}%`, `${100 + initialOffset}%`],
        }}
        transition={{
          repeat: Infinity,
          ease: "linear",
          duration,
          delay: -delay,
          ...transition,
        }}
      />
    </div>
  );
}

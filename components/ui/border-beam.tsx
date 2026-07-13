import { cn } from "@/lib/utils";

interface BorderBeamProps {
  className?: string;
  borderWidth?: number;
}

// Borda em gradiente na perímetro inteira: um conic-gradient roxo/lime (mesma
// dupla do AnimatedPlusBadge) girando devagar, recortado num anel fino via
// máscara padding/XOR — só longhands, senão o shorthand `mask` zera o composite.
// Usa spin do CSS (igual ao badge), que anima de forma confiável; centralização
// via inset pra o transform do spin não apagar o posicionamento.
export function BorderBeam({ className, borderWidth = 1.5 }: BorderBeamProps) {
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
      <div
        aria-hidden
        className="absolute inset-[-50%] animate-[spin_8s_linear_infinite]"
        style={{
          background:
            "conic-gradient(from 0deg, #81d300, #a063e8, #81d300, #a063e8, #81d300)",
        }}
      />
    </div>
  );
}

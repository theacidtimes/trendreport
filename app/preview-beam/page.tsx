import AnimatedPlusBadge from "@/components/AnimatedPlusBadge";
import { ShineBorder } from "@/components/ui/shine-border";

export default function PreviewBeam() {
  return (
    <div className="min-h-screen bg-bg grid place-items-center p-10">
      <div className="w-full max-w-2xl">
        <div
          id="cta"
          className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-surface-2 via-surface to-black p-7 md:p-8 flex items-center justify-between gap-4 shadow-card"
        >
          <ShineBorder
            borderWidth={1.5}
            duration={12}
            shineColor={["#a063e8", "#81d300"]}
          />
          <div className="flex flex-col gap-1.5">
            <span className="kicker text-purple/60">Novo report</span>
            <h1 className="font-serif text-purple font-medium text-3xl md:text-4xl leading-tight">
              O que está bombando agora?
            </h1>
          </div>
          <AnimatedPlusBadge size={56} />
        </div>
      </div>
    </div>
  );
}

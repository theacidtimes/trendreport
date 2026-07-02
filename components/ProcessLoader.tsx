"use client";

import { useEffect, useState } from "react";
import {
  Compass,
  FileCheck2,
  HeartPulse,
  Lightbulb,
  Radar,
  ScanSearch,
  Sparkles,
} from "lucide-react";

const STEPS = [
  { label: "Entendendo o briefing", icon: Sparkles },
  { label: "Mapeando território da marca", icon: Compass },
  { label: "Coletando sinais culturais", icon: Radar },
  { label: "Escaneando redes sociais", icon: ScanSearch },
  { label: "Analisando comportamento", icon: HeartPulse },
  { label: "Identificando oportunidades", icon: Lightbulb },
  { label: "Montando report personalizado", icon: FileCheck2 },
];

const CAP = STEPS.length - 0.15;

export default function ProcessLoader({ done = false }: { done?: boolean }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (done) {
      const id = setInterval(() => {
        setProgress((p) => Math.min(STEPS.length, p + 0.6));
      }, 40);
      return () => clearInterval(id);
    }

    const id = setInterval(() => {
      setProgress((p) => Math.min(CAP, p + 0.025 + Math.random() * 0.04));
    }, 150);
    return () => clearInterval(id);
  }, [done]);

  return (
    <div className="w-full flex flex-col gap-5 bg-surface border border-border rounded-xl p-6 md:p-7 animate-fade-in">
      <span className="text-muted uppercase text-xs tracking-[0.14em] font-medium">
        Processo IA
      </span>

      <div className="flex flex-col gap-4">
        {STEPS.map(({ label, icon: Icon }, i) => {
          const width = Math.max(0, Math.min(100, (progress - i) * 100));
          const isActive = width > 0 && width < 100;
          const isDone = width >= 100;

          return (
            <div key={label} className="flex items-center gap-3">
              <span
                className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center transition-colors duration-300 ${
                  isDone
                    ? "bg-lime text-black"
                    : isActive
                      ? "bg-purple text-white"
                      : "bg-surface-2 text-muted"
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={2.5} />
              </span>

              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <span
                  className={`text-sm truncate transition-colors duration-300 ${
                    isDone || isActive ? "text-white" : "text-muted"
                  }`}
                >
                  {label}
                </span>
                <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full bg-lime rounded-full transition-[width] duration-150 ease-linear"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

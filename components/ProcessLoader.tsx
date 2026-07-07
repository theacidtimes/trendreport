"use client";

import {
  AtSign,
  Camera,
  Lightbulb,
  MessagesSquare,
  Newspaper,
  Sparkles,
  Video,
} from "lucide-react";
import type { ReportProgress } from "@/lib/generateReport";
import type { SourceName } from "@/lib/apify";

type StepId = "briefing" | SourceName | "model";

const STEPS: { id: StepId; label: string; icon: typeof Sparkles }[] = [
  { id: "briefing", label: "Entendendo o briefing", icon: Sparkles },
  { id: "instagram", label: "Escaneando Instagram", icon: Camera },
  { id: "tiktok", label: "Escaneando TikTok", icon: Video },
  { id: "twitter", label: "Escaneando X (Twitter)", icon: AtSign },
  { id: "reddit", label: "Vasculhando Reddit", icon: MessagesSquare },
  { id: "news", label: "Rastreando notícias e sites", icon: Newspaper },
  { id: "model", label: "Cruzando sinais e escrevendo o report", icon: Lightbulb },
];

const SOURCE_IDS: SourceName[] = ["instagram", "tiktok", "twitter", "reddit", "news"];

function isSource(id: StepId): id is SourceName {
  return (SOURCE_IDS as StepId[]).includes(id);
}

function statusOf(
  step: StepId,
  progress: ReportProgress | null
): "pending" | "active" | "done" {
  if (!progress) return step === "briefing" ? "active" : "pending";

  if (step === "briefing") {
    return progress.phase === "briefing" ? "active" : "done";
  }

  if (step === "model") {
    return progress.phase === "model" ? "active" : "pending";
  }

  // Etapas de fonte (instagram/tiktok/twitter/reddit/news): cada uma fica
  // "done" assim que o respectivo scraper responde — não seguem uma ordem
  // fixa entre si, porque rodam em paralelo de verdade.
  if (progress.phase === "briefing") return "pending";
  if (isSource(step) && progress.sources_done.includes(step)) return "done";
  return progress.phase === "collecting" ? "active" : "done";
}

export default function ProcessLoader({ progress = null }: { progress?: ReportProgress | null }) {
  const sourcesDoneCount = progress
    ? SOURCE_IDS.filter((id) => progress.sources_done.includes(id)).length
    : 0;

  return (
    <div className="w-full flex flex-col gap-5 bg-surface border border-border rounded-xl p-6 md:p-7 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="text-muted uppercase text-xs tracking-[0.14em] font-medium">
          Processo IA
        </span>
        {progress?.phase === "collecting" && (
          <span className="text-muted text-xs">{sourcesDoneCount}/5 fontes</span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {STEPS.map(({ id, label, icon: Icon }) => {
          const state = statusOf(id, progress);
          const isDone = state === "done";
          const isActive = state === "active";

          return (
            <div key={id} className="flex items-center gap-3">
              <span
                className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center transition-colors duration-300 ${
                  isDone
                    ? "bg-lime text-black"
                    : isActive
                      ? "bg-purple text-white animate-pulse"
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
                    className={`h-full bg-lime rounded-full transition-[width] duration-500 ease-out ${
                      isActive ? "animate-pulse" : ""
                    }`}
                    style={{ width: isDone ? "100%" : isActive ? "55%" : "0%" }}
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

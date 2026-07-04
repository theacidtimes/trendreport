"use client";

import { useState } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";

function labelFromKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (value == null) return "";
  return String(value);
}

export default function BriefingRecap({
  briefing,
}: {
  briefing?: Record<string, unknown> | string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!briefing) return null;

  const entries =
    typeof briefing === "string"
      ? [{ label: "Briefing", value: briefing }]
      : Object.entries(briefing)
          .filter(
            ([, v]) =>
              v !== null &&
              v !== undefined &&
              v !== "" &&
              !(Array.isArray(v) && v.length === 0)
          )
          .map(([k, v]) => ({ label: labelFromKey(k), value: formatValue(v) }));

  if (entries.length === 0) return null;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs bg-surface border border-border rounded-full px-3 py-1.5 text-muted hover:text-white hover:border-lime/40 transition-colors font-body"
      >
        <ClipboardList className="w-3 h-3 shrink-0" strokeWidth={2.5} />
        {open ? "Ocultar briefing" : "Ver briefing"}
        <ChevronDown
          className={`w-3 h-3 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          strokeWidth={2.5}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="mt-3 rounded-2xl bg-surface border border-border p-5 flex flex-col gap-4">
            {entries.map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <span className="text-muted text-[11px] uppercase tracking-[0.1em] font-medium font-body">
                  {label}
                </span>
                <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap font-body">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

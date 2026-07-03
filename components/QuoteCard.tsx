import { ArrowUpRight } from "lucide-react";
import { PLATFORM_LABEL, PLATFORM_ICON, PLATFORM_ACCENT, type Plataforma } from "@/lib/platforms";

export default function QuoteCard({
  plataforma,
  autor,
  texto,
  url,
}: {
  plataforma: Plataforma;
  autor: string;
  texto: string;
  url?: string | null;
}) {
  const Icon = PLATFORM_ICON[plataforma];
  const accent = PLATFORM_ACCENT[plataforma];
  const handlePrefix = plataforma === "reddit" ? "r/" : "@";
  const initial = autor.trim().charAt(0).toUpperCase();

  const Wrapper = url ? "a" : "div";

  return (
    <Wrapper
      {...(url
        ? { href: url, target: "_blank", rel: "noopener noreferrer" }
        : {})}
      className="group flex flex-col gap-3 rounded-3xl bg-white p-5 border border-black/10 hover:border-black/20 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-body font-bold text-xs text-white"
            style={{ backgroundColor: accent }}
          >
            {initial}
          </span>
          <div className="flex flex-col min-w-0">
            <span className="text-black text-sm font-semibold font-body truncate">
              {handlePrefix}
              {autor}
            </span>
            <span className="flex items-center gap-1 text-black/45 text-[11px] font-body">
              <Icon className="w-3 h-3" strokeWidth={2.2} style={{ color: accent }} />
              {PLATFORM_LABEL[plataforma]}
            </span>
          </div>
        </div>
        {url && (
          <ArrowUpRight
            className="w-3.5 h-3.5 text-black/30 shrink-0 group-hover:text-purple transition-colors"
            strokeWidth={2.5}
          />
        )}
      </div>

      <p className="text-black/80 text-sm leading-relaxed font-body line-clamp-4">{texto}</p>
    </Wrapper>
  );
}

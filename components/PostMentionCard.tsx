import { ArrowUpRight, Camera } from "lucide-react";

export default function PostMentionCard({
  autor,
  texto,
  url,
}: {
  autor: string;
  texto: string;
  url?: string | null;
}) {
  const Wrapper = url ? "a" : "div";

  return (
    <Wrapper
      {...(url
        ? { href: url, target: "_blank", rel: "noopener noreferrer" }
        : {})}
      className="group flex items-center gap-3 rounded-2xl bg-surface border border-border px-4 py-3.5 hover:border-[#E1306C]/40 transition-colors"
    >
      <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[#E1306C]/15">
        <Camera className="w-4 h-4 text-[#E1306C]" strokeWidth={2.2} />
      </span>
      <div className="flex flex-col min-w-0 flex-1 font-body">
        <span className="text-muted text-[11px] truncate">@{autor} postou no Instagram</span>
        <span className="text-white text-sm font-medium truncate">{texto}</span>
      </div>
      {url && (
        <ArrowUpRight
          className="w-3.5 h-3.5 text-white/30 shrink-0 group-hover:text-lime transition-colors"
          strokeWidth={2.5}
        />
      )}
    </Wrapper>
  );
}

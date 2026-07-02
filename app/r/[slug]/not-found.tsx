import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-4">
      <span className="w-12 h-12 rounded-full bg-surface flex items-center justify-center">
        <SearchX className="w-5 h-5 text-muted" strokeWidth={2} />
      </span>
      <p className="text-muted text-lg text-center">Report não encontrado.</p>
    </div>
  );
}

import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="h-full w-full grid place-items-center">
      <Loader2 className="w-8 h-8 text-lime animate-spin" strokeWidth={2.5} />
    </div>
  );
}

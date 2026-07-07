"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProcessLoader from "@/components/ProcessLoader";
import type { ReportProgress } from "@/lib/generateReport";

export default function PendingReport({ slug }: { slug: string }) {
  const router = useRouter();
  const [progress, setProgress] = useState<ReportProgress | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function poll() {
      const { data } = await supabase
        .from("reports")
        .select("status, progress")
        .eq("slug", slug)
        .single();

      if (cancelled || !data) return;

      if (data.status !== "pending") {
        router.refresh();
        return;
      }

      setProgress(data.progress as ReportProgress | null);
    }

    poll();
    const interval = setInterval(poll, 2500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [slug, router]);

  return (
    <div className="min-h-screen md:min-h-0 flex items-center justify-center px-4 py-10 md:py-24">
      <div className="w-full max-w-2xl">
        <ProcessLoader progress={progress} />
      </div>
    </div>
  );
}

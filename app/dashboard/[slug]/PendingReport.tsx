"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ProcessLoader from "@/components/ProcessLoader";

export default function PendingReport({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("reports")
        .select("status")
        .eq("slug", slug)
        .single();

      if (data && data.status !== "pending") {
        router.refresh();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [slug, router]);

  return (
    <div className="min-h-screen md:min-h-0 flex items-center justify-center px-4 py-10 md:py-24">
      <div className="w-full max-w-2xl">
        <ProcessLoader />
      </div>
    </div>
  );
}

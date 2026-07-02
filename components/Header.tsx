"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Header({ userEmail }: { userEmail?: string }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="h-14 flex items-center justify-between px-6 bg-bg border-b border-border">
      <Link href="/dashboard" className="text-white font-bold text-lg">
        cccaramelo trend report
      </Link>

      {userEmail && (
        <div className="flex items-center gap-4">
          <span className="text-muted text-sm">{userEmail}</span>
          <button
            onClick={handleSignOut}
            className="text-white text-xs uppercase tracking-wide font-medium hover:text-lime transition-colors"
          >
            SAIR
          </button>
        </div>
      )}
    </header>
  );
}

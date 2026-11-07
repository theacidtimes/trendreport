"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutList } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import BriefingComposer from "@/components/briefing/BriefingComposer";

export default function NewReportPage() {
  const [userEmail, setUserEmail] = useState<string | undefined>();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email));
    supabase.rpc("is_app_admin").then(({ data }) => setIsAdmin(data === true));
  }, []);

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={userEmail} isAdmin={isAdmin} />

      <main className="md:pl-20">
        <div className="min-h-screen md:min-h-0 flex items-center justify-center px-4 py-10 md:py-24">
          <div className="w-full max-w-5xl flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-muted uppercase text-xs tracking-[0.14em] font-medium">
                Novo report
              </span>
              <h1 className="font-serif text-white font-medium text-3xl md:text-4xl leading-tight">
                Monte o briefing.
              </h1>
              <p className="text-muted text-[15px] max-w-md">
                Preencha os campos abaixo. A gente cuida do resto pra IA entender a marca,
                a campanha e o contexto que você quer explorar.
              </p>
              <Link
                href="/dashboard/new/montar"
                className="flex items-center gap-1.5 text-sm text-lime hover:brightness-110 w-fit"
              >
                <LayoutList className="w-4 h-4" strokeWidth={2} />
                Ou monte a partir do acervo, com posts que já foram coletados
              </Link>
            </div>

            <BriefingComposer />
          </div>
        </div>
      </main>
    </div>
  );
}

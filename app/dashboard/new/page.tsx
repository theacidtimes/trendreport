"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Sidebar from "@/components/Sidebar";
import BriefingForm from "@/components/BriefingForm";

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
          <div className="w-full max-w-2xl flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-muted uppercase text-xs tracking-[0.14em] font-medium">
                Novo report
              </span>
              <h1 className="font-sans text-white font-bold text-3xl md:text-4xl tracking-[-0.01em]">
                Monte o briefing.
              </h1>
              <p className="text-muted text-[15px] max-w-md">
                Preencha os campos abaixo. A gente cuida do resto pra IA entender a marca,
                a campanha e o contexto que você quer explorar.
              </p>
            </div>

            <BriefingForm />
          </div>
        </div>
      </main>
    </div>
  );
}

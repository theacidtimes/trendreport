import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsAdmin } from "@/lib/admin";
import Sidebar from "@/components/Sidebar";

export default async function MapaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const isAdmin = await checkIsAdmin(supabase);

  return (
    <div className="h-screen w-screen overflow-hidden bg-bg">
      <Sidebar userEmail={user?.email} isAdmin={isAdmin} />
      <main className="h-full md:pl-20">{children}</main>
    </div>
  );
}

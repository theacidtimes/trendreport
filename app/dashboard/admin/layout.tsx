import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkIsAdmin } from "@/lib/admin";
import Sidebar from "@/components/Sidebar";
import AdminTabs from "./AdminTabs";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!(await checkIsAdmin(supabase))) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail={user.email} isAdmin />
      <main className="md:pl-64 print:pl-0">
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-8">
          <AdminTabs />
          {children}
        </div>
      </main>
    </div>
  );
}

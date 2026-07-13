import Sidebar from "@/components/Sidebar";
import Loading from "@/app/dashboard/mapa/[marca]/loading";

export const dynamic = "force-dynamic";

export default function PreviewLoader() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-bg">
      <Sidebar userEmail="preview@x.com" isAdmin />
      <main className="h-full md:pl-20">
        <Loading />
      </main>
    </div>
  );
}

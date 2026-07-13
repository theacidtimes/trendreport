import Sidebar from "@/components/Sidebar";

export default function PreviewSidebarPage() {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar userEmail="teste@caramelo.com" isAdmin />
      <main className="md:pl-20 p-10 text-white">conteúdo</main>
    </div>
  );
}

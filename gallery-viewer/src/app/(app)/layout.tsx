import { GalleryProvider } from "@/components/GalleryContext";
import Sidebar from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <GalleryProvider>
      <div className="appShell">
        <Sidebar />
        <main className="mainContent">
          <div className="pageContent">{children}</div>
        </main>
      </div>
    </GalleryProvider>
  );
}

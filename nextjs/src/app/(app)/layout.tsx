import { AppHeader } from "@/components/app-header";
import { AppHeaderTitleProvider } from "@/components/app-header-title";
import { AppSidebar } from "@/components/app-sidebar";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppHeaderTitleProvider defaultTitle="Dashboard">
        <Sidebar>
          <AppSidebar />
        </Sidebar>
        <SidebarInset>
          <AppHeader />
          <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </SidebarInset>
      </AppHeaderTitleProvider>
    </SidebarProvider>
  );
}

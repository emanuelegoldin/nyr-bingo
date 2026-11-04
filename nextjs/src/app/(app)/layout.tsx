import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppContextProvider } from "@/hooks/AppContext";
import { getLocaleFromRequest } from "@/i18n/request";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const defaultLanguage = await getLocaleFromRequest();

  return (
    <SidebarProvider>
      <AppContextProvider defaultTitle="Dashboard" defaultLanguage={defaultLanguage}>
        <Sidebar>
          <AppSidebar />
        </Sidebar>
        {/* min-w-0 keeps wide content from stretching the page past the screen (spec 20) */}
        <SidebarInset className="min-w-0">
          <AppHeader />
          <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </SidebarInset>
      </AppContextProvider>
    </SidebarProvider>
  );
}

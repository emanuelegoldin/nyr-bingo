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
        <SidebarInset>
          <AppHeader />
          <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </SidebarInset>
      </AppContextProvider>
    </SidebarProvider>
  );
}

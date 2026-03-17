import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}

export function AppLayout({ children, title, actions }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b border-border px-4 shrink-0">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-base font-semibold" data-testid="page-title">{title}</h1>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 min-w-0">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

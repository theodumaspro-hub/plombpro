import { useState, useEffect, useSyncExternalStore } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Building2 } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { authStore } from "@/lib/authStore";
import { db } from "@/lib/supabaseData";

function HeaderUserInfo() {
  const user = useSyncExternalStore(
    (cb) => authStore.subscribe(cb),
    () => authStore.getUser()
  );
  const isAuth = useSyncExternalStore(
    (cb) => authStore.subscribe(cb),
    () => authStore.isAuthenticated()
  );
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuth) { setCompanyName(null); return; }
    db.getCompanySettings().then((cs) => {
      setCompanyName(cs?.name || null);
    }).catch(() => setCompanyName(null));
  }, [isAuth]);

  const handleLogout = async () => {
    await authStore.logout();
    window.location.hash = "#/";
    window.location.reload();
  };

  if (!isAuth || !user) return null;

  const initials = (user.name || user.email)
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("");

  return (
    <div className="flex items-center gap-3">
      <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
        {companyName && (
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Building2 className="size-3.5" />
            {companyName}
          </span>
        )}
        {companyName && <span className="text-border">|</span>}
        <span>{user.email}</span>
      </div>
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-[11px] font-semibold sm:hidden">
        {initials}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
      >
        <LogOut className="size-3.5" />
        <span className="hidden sm:inline">Déconnexion</span>
      </Button>
    </div>
  );
}

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
            <HeaderUserInfo />
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 min-w-0">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

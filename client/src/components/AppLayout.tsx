import { useState, useEffect } from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Building2 } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/supabaseData";

function HeaderUserInfo() {
  const [email, setEmail] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Try to get session — retry a few times since auth may not be ready yet
    async function fetchUser() {
      for (let i = 0; i < 10; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && !cancelled) {
          setEmail(session.user.email || null);
          try {
            const cs = await db.getCompanySettings();
            if (!cancelled) setCompanyName(cs?.name || null);
          } catch {}
          return;
        }
        // Wait 500ms before retry
        await new Promise(r => setTimeout(r, 500));
      }
    }
    fetchUser();

    // Also listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) {
        setEmail(session.user.email || null);
        db.getCompanySettings().then((cs) => {
          if (!cancelled) setCompanyName(cs?.name || null);
        }).catch(() => {});
      } else {
        setEmail(null);
        setCompanyName(null);
      }
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.hash = "#/";
    window.location.reload();
  };

  // Always show at least the logout button when in the app view
  const initials = email
    ? email.split("@")[0].slice(0, 2).toUpperCase()
    : "?";

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
        {email && <span>{email}</span>}
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

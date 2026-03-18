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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function loadUser(userEmail: string | undefined) {
      if (cancelled) return;
      setEmail(userEmail || null);
      setReady(true);
      db.getCompanySettings().then((cs) => {
        if (!cancelled) setCompanyName(cs?.name || null);
      }).catch(() => {});
    }

    // 1. Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadUser(session.user.email);
    });

    // 2. Listen for future changes (login fires SIGNED_IN event)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUser(session.user.email);
      } else {
        if (!cancelled) { setEmail(null); setCompanyName(null); setReady(false); }
      }
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.hash = "#/";
    window.location.reload();
  };

  // This component is only rendered inside AppLayout (= authenticated app)
  // So always show logout, even before session resolves
  return (
    <div className="flex items-center gap-3">
      {ready && (
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
      )}
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

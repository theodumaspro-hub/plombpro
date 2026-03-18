import { Link, useLocation } from "wouter";
import { useState, useEffect, useSyncExternalStore } from "react";
import {
  LayoutDashboard, FileText, FileCheck, Receipt, HardHat,
  Users, BookOpen, ShoppingCart, Landmark, BarChart3,
  UserCog, Settings, Calendar, Plus, Package, Plug, FileUp,
  Clock, FolderOpen, Sparkles, LogOut, Building2, User,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { Button } from "@/components/ui/button";
import { authStore } from "@/lib/authStore";
import { db } from "@/lib/supabaseData";

const commercialNav = [
  { label: "Tableau de bord", href: "/", icon: LayoutDashboard },
  { label: "Devis", href: "/devis", icon: FileCheck },
  { label: "Modèles devis", href: "/modeles-devis", icon: Sparkles },
  { label: "Factures", href: "/factures", icon: Receipt },
  { label: "Chantiers", href: "/chantiers", icon: HardHat },
];

const gestionNav = [
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Ressources", href: "/ressources", icon: UserCog },
  { label: "Suivi temps", href: "/suivi-temps", icon: Clock },
  { label: "Documents", href: "/documents", icon: FolderOpen },
  { label: "Bibliothèque", href: "/bibliotheque", icon: BookOpen },
  { label: "Achats", href: "/achats", icon: ShoppingCart },
];

const financeNav = [
  { label: "Banques", href: "/banques", icon: Landmark },
  { label: "Pilotage", href: "/pilotage", icon: BarChart3 },
  { label: "Planning", href: "/planning", icon: Calendar },
];

const marketplaceNav = [
  { label: "Marketplace", href: "/marketplace", icon: Package },
  { label: "Intégrations", href: "/integrations", icon: Plug },
  { label: "Import données", href: "/import-donnees", icon: FileUp },
];

const systemNav = [
  { label: "Paramètres", href: "/parametres", icon: Settings },
];

function NavSection({ label, items }: { label: string; items: typeof commercialNav }) {
  const [location] = useLocation();
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/50 text-[11px] uppercase tracking-wider font-medium">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className="h-9"
                >
                  <Link href={item.href}>
                    <item.icon className="size-4" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function UserProfileFooter() {
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
    window.location.hash = "#/login";
  };

  if (!isAuth || !user) return null;

  const initials = (user.name || user.email)
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("");

  return (
    <div className="border-t border-sidebar-border pt-3 space-y-2">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
          {initials}
        </div>
        <div className="flex flex-col min-w-0">
          {companyName && (
            <span className="text-xs font-medium text-sidebar-foreground truncate flex items-center gap-1">
              <Building2 className="size-3 shrink-0 text-sidebar-foreground/50" />
              {companyName}
            </span>
          )}
          <span className="text-[11px] text-sidebar-foreground/50 truncate">
            {user.email}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="w-full justify-start gap-2 h-8 text-xs text-sidebar-foreground/60 hover:text-destructive"
      >
        <LogOut className="size-3.5" />
        Se déconnecter
      </Button>
    </div>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="PlombPro">
              <path d="M6 12V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
              <path d="M6 12h4" />
              <path d="M10 12v6a2 2 0 0 0 2 2h0" />
              <path d="M14 12V8a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v4" />
              <path d="M14 12h4" />
              <path d="M18 12v4a2 2 0 0 1-2 2h-4" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
            </svg>
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold text-sidebar-foreground">PlombPro</span>
            <span className="text-[10px] text-sidebar-foreground/50">Gestion Plomberie</span>
          </div>
        </Link>
      </SidebarHeader>

      <div className="px-3 pb-2 group-data-[collapsible=icon]:hidden">
        <Link href="/devis/nouveau">
          <Button size="sm" className="w-full gap-2 h-8 text-xs font-medium" data-testid="btn-new-devis-sidebar">
            <Plus className="size-3.5" />
            Nouveau devis
          </Button>
        </Link>
      </div>

      <SidebarContent className="px-2">
        <NavSection label="Commercial" items={commercialNav} />
        <NavSection label="Gestion" items={gestionNav} />
        <NavSection label="Finance" items={financeNav} />
        <NavSection label="Outils" items={marketplaceNav} />
        <NavSection label="Système" items={systemNav} />
      </SidebarContent>
      <SidebarFooter className="p-3 group-data-[collapsible=icon]:hidden">
        <UserProfileFooter />
        <PerplexityAttribution />
      </SidebarFooter>
    </Sidebar>
  );
}

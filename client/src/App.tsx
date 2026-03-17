import { useState, useEffect, useCallback } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { authStore } from "./lib/authStore";
import { supabase } from "./lib/supabase";
import { db } from "@/lib/supabaseData";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/dashboard";
import DevisPage from "@/pages/devis";
import DevisDetailPage from "@/pages/devis-detail";
import FacturesPage from "@/pages/factures";
import ChantiersPage from "@/pages/chantiers";
import ContactsPage from "@/pages/contacts";
import RessourcesPage from "@/pages/ressources";
import BibliothequePage from "@/pages/bibliotheque";
import AchatsPage from "@/pages/achats";
import BanquesPage from "@/pages/banques";
import PilotagePage from "@/pages/pilotage";
import PlanningPage from "@/pages/planning";
import ParametresPage from "@/pages/parametres";
import SuiviTempsPage from "@/pages/suivi-temps";
import DocumentsPage from "@/pages/documents-page";
import ModelesDevisPage from "@/pages/modeles-devis";
import MarketplacePage from "@/pages/marketplace";
import IntegrationsPage from "@/pages/integrations";
import ImportDonneesPage from "@/pages/import-donnees";
import OnboardingWizard from "@/pages/onboarding";
import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth";
import SubscriptionPage from "@/pages/subscription";
import type { CompanySettings } from "@shared/schema";

// App state managed via React state (no localStorage in sandbox)
type AppView = "landing" | "login" | "signup" | "onboarding" | "subscription" | "app";

function AppRouter() {
  const [view, setView] = useState<AppView>("landing");
  const [isAuthed, setIsAuthed] = useState(false);

  // Check if we have a token
  const hasToken = authStore.isAuthenticated();

  // Check auth status via Supabase directly
  const { data: authData, isLoading: authLoading } = useQuery({
    queryKey: ["auth"],
    retry: false,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return { authenticated: !!user, user };
    },
  });

  // Check company/onboarding state
  const { data: company, isLoading: companyLoading } = useQuery<CompanySettings>({
    queryKey: ["company"],
    queryFn: () => db.getCompanySettings(),
    enabled: isAuthed,
  });

  // Determine view based on auth + onboarding state
  useEffect(() => {
    if (!hasToken) {
      setIsAuthed(false);
      if (view !== "login" && view !== "signup") {
        setView("landing");
      }
      return;
    }

    if (authLoading) return;

    if (authData?.authenticated) {
      setIsAuthed(true);
      if (!companyLoading && company) {
        if (!company.onboardingCompleted) {
          setView("onboarding");
        } else if (company.plan === "free" || !company.plan) {
          setView("subscription");
        } else {
          // Ensure hash is valid app route before switching to app view
          const hash = window.location.hash.replace('#', '') || '/';
          const appRoutes = ['/', '/devis', '/factures', '/chantiers', '/contacts', '/ressources', '/bibliotheque', '/achats', '/banques', '/pilotage', '/planning', '/suivi-temps', '/documents', '/modeles-devis', '/parametres', '/marketplace', '/integrations', '/import-donnees'];
          if (!appRoutes.some(r => hash === r || hash.startsWith(r + '/'))) {
            window.location.hash = '#/';
          }
          setView("app");
        }
      }
    } else {
      setIsAuthed(false);
      authStore.clear();
      if (view !== "login" && view !== "signup") {
        setView("landing");
      }
    }
  }, [authData, authLoading, company, companyLoading, hasToken]);

  const navigate = useCallback((path: string) => {
    if (path === "landing") setView("landing");
    else if (path === "login") setView("login");
    else if (path === "signup") setView("signup");
    else if (path === "onboarding") setView("onboarding");
    else if (path === "subscription") setView("subscription");
    else if (path === "app") setView("app");
  }, []);

  const handleAuth = useCallback(() => {
    setIsAuthed(true);
    queryClient.invalidateQueries({ queryKey: ["auth"] });
    queryClient.invalidateQueries({ queryKey: ["company"] });
    // Reset hash to root so the app router doesn't 404 on /login or /signup
    window.location.hash = "#/";
    setView("onboarding");
  }, []);

  const handleLogout = useCallback(async () => {
    await authStore.logout();
    setIsAuthed(false);
    queryClient.clear();
    setView("landing");
  }, []);

  // Loading state (only show when we have a token and are checking)
  if (hasToken && authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground animate-pulse">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 12V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
              <path d="M6 12h4" />
              <path d="M10 12v6a2 2 0 0 0 2 2h0" />
              <path d="M14 12V8a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v4" />
              <path d="M14 12h4" />
              <path d="M18 12v4a2 2 0 0 1-2 2h-4" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
            </svg>
          </div>
          <span className="text-sm text-muted-foreground">Chargement de PlombPro...</span>
        </div>
      </div>
    );
  }

  // Landing Page
  if (view === "landing") {
    return <LandingPage onNavigate={navigate} />;
  }

  // Auth Pages
  if (view === "login") {
    return <AuthPage mode="login" onNavigate={navigate} onAuth={handleAuth} />;
  }
  if (view === "signup") {
    return <AuthPage mode="signup" onNavigate={navigate} onAuth={handleAuth} />;
  }

  // Onboarding
  if (view === "onboarding") {
    return (
      <OnboardingWizard
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["company"] });
          setView("subscription");
        }}
      />
    );
  }

  // Subscription / Paywall
  if (view === "subscription") {
    return (
      <SubscriptionPage
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["company"] });
          setView("app");
        }}
        onBack={() => setView("onboarding")}
      />
    );
  }

  // Main App
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/devis" component={DevisPage} />
      <Route path="/devis/nouveau" component={DevisPage} />
      <Route path="/devis/:id" component={DevisDetailPage} />
      <Route path="/factures" component={FacturesPage} />
      <Route path="/factures/nouveau" component={FacturesPage} />
      <Route path="/chantiers" component={ChantiersPage} />
      <Route path="/chantiers/nouveau" component={ChantiersPage} />
      <Route path="/contacts" component={ContactsPage} />
      <Route path="/contacts/nouveau" component={ContactsPage} />
      <Route path="/ressources" component={RessourcesPage} />
      <Route path="/ressources/nouveau" component={RessourcesPage} />
      <Route path="/bibliotheque" component={BibliothequePage} />
      <Route path="/bibliotheque/nouveau" component={BibliothequePage} />
      <Route path="/achats" component={AchatsPage} />
      <Route path="/achats/nouveau" component={AchatsPage} />
      <Route path="/banques" component={BanquesPage} />
      <Route path="/pilotage" component={PilotagePage} />
      <Route path="/planning" component={PlanningPage} />
      <Route path="/planning/nouveau" component={PlanningPage} />
      <Route path="/suivi-temps" component={SuiviTempsPage} />
      <Route path="/documents" component={DocumentsPage} />
      <Route path="/modeles-devis" component={ModelesDevisPage} />
      <Route path="/parametres" component={ParametresPage} />
      <Route path="/marketplace" component={MarketplacePage} />
      <Route path="/integrations" component={IntegrationsPage} />
      <Route path="/import-donnees" component={ImportDonneesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

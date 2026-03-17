import { useState, useEffect, useCallback } from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { authStore } from "./lib/authStore";
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

  // Reactive auth state — subscribe to authStore changes
  const [hasToken, setHasToken] = useState(() => authStore.isAuthenticated());
  useEffect(() => {
    const unsub = authStore.subscribe(() => {
      setHasToken(authStore.isAuthenticated());
    });
    return unsub;
  }, []);

  // Check company/onboarding state (only when authed)
  const { data: company, isLoading: companyLoading } = useQuery<CompanySettings | null>({
    queryKey: ["company"],
    queryFn: () => db.getCompanySettings(),
    enabled: isAuthed,
  });

  // Determine view based on auth + company state
  useEffect(() => {
    if (!isAuthed) return;
    if (companyLoading) return;

    if (company) {
      if (!company.onboarding_completed) {
        setView("onboarding");
      } else if (company.plan === "free" || !company.plan) {
        setView("subscription");
      } else {
        setView("app");
      }
    } else {
      // No company settings yet → go to onboarding
      setView("onboarding");
    }
  }, [isAuthed, company, companyLoading]);

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
    queryClient.invalidateQueries({ queryKey: ["company"] });
    window.location.hash = "#/";
    // View will be determined by the useEffect once company data loads
    setView("onboarding"); // temporary — will be overridden by useEffect
  }, []);

  const handleLogout = useCallback(async () => {
    await authStore.logout();
    setIsAuthed(false);
    queryClient.clear();
    setView("landing");
  }, []);

  // Loading state
  if (isAuthed && companyLoading) {
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

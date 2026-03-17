import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CompanySettings } from "@shared/schema";
import {
  CheckCircle2, Sparkles, ChevronLeft, CreditCard, Shield, Lock, X,
  Zap, Users, BarChart3, Building2, Calendar, Receipt, BookOpen,
  ShoppingCart, HardHat, Globe, Headphones, FileCheck, Smartphone,
  TrendingUp,
} from "lucide-react";

interface SubscriptionProps {
  onComplete: () => void;
  onBack?: () => void;
}

const PLANS = [
  {
    id: "pro",
    name: "PRO",
    monthlyPrice: 29,
    yearlyPrice: 24,
    yearlyTotal: 288,
    obatPrice: 39,
    desc: "Gestion clients, chiffrage et facturation complète",
    features: [
      { text: "2 utilisateurs", icon: Users, highlight: true },
      { text: "Devis & factures illimités", icon: FileCheck },
      { text: "Bibliothèques de prix artisan incluses", icon: BookOpen },
      { text: "500+ modèles de devis chiffrés", icon: FileCheck },
      { text: "Gestion clients complète", icon: Users },
      { text: "Signatures électroniques illimitées", icon: Shield },
      { text: "Paiements clients illimités", icon: CreditCard },
      { text: "Documents digitalisés", icon: Receipt },
      { text: "Connexion compte bancaire", icon: CreditCard },
      { text: "Accès comptable inclus", icon: BarChart3 },
      { text: "Conformité e-facturation 2026", icon: Shield },
      { text: "Accès mobile complet", icon: Smartphone },
      { text: "Support email & chat", icon: Headphones },
    ],
    popular: false,
    badge: null,
    stripe_price_monthly: "price_pro_monthly",
    stripe_price_yearly: "price_pro_yearly",
  },
  {
    id: "croissance",
    name: "CROISSANCE",
    monthlyPrice: 49,
    yearlyPrice: 41,
    yearlyTotal: 492,
    obatPrice: 69,
    desc: "Planifiez vos chantiers, pilotez votre rentabilité",
    features: [
      { text: "5 utilisateurs", icon: Users, highlight: true },
      { text: "Tout le pack PRO +", icon: Zap, isSectionHeader: true },
      { text: "Achats & bons de commande", icon: ShoppingCart },
      { text: "Commandes fournisseurs", icon: ShoppingCart },
      { text: "Rentabilité chantier temps réel", icon: HardHat },
      { text: "Planning & calendrier équipe", icon: Calendar },
      { text: "Suivi du temps par intervention", icon: Calendar },
      { text: "Connexion bancaire multi-comptes", icon: CreditCard },
      { text: "Statistiques financières complètes", icon: BarChart3 },
      { text: "Primes énergie (CEE, MaPrimeRénov')", icon: Globe },
      { text: "Retenues de garantie", icon: Shield },
      { text: "Accompagnement illimité", icon: Headphones },
    ],
    popular: true,
    badge: "Le plus populaire",
    stripe_price_monthly: "price_croissance_monthly",
    stripe_price_yearly: "price_croissance_yearly",
  },
  {
    id: "booster",
    name: "BOOSTER",
    monthlyPrice: 89,
    yearlyPrice: 74,
    yearlyTotal: 888,
    obatPrice: 109,
    desc: "Gestion complète multi-sociétés, visibilité maximale",
    features: [
      { text: "Utilisateurs illimités", icon: Users, highlight: true },
      { text: "Tout le pack CROISSANCE +", icon: Zap, isSectionHeader: true },
      { text: "Multi-sociétés", icon: Building2 },
      { text: "Marketplace fournisseurs", icon: Globe },
      { text: "API & intégrations tierces", icon: Zap },
      { text: "Import données (Obat, EBP, Excel)", icon: FileCheck },
      { text: "Pilotage avancé & KPIs", icon: TrendingUp },
      { text: "Manager dédié", icon: Headphones },
      { text: "Formation équipe incluse", icon: BookOpen },
      { text: "Priorité nouvelles fonctionnalités", icon: Sparkles },
    ],
    popular: false,
    badge: null,
    stripe_price_monthly: "price_booster_monthly",
    stripe_price_yearly: "price_booster_yearly",
  },
];

export default function SubscriptionPage({ onComplete, onBack }: SubscriptionProps) {
  const [selectedPlan, setSelectedPlan] = useState("croissance");
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { data: company } = useQuery<CompanySettings>({ queryKey: ["/api/company"] });

  const subscribeMut = useMutation({
    mutationFn: async (planId: string) => {
      await apiRequest("POST", "/api/subscription/checkout", { planId });
      return { ok: true };
    },
    onSuccess: () => {
      setIsProcessing(true);
      setTimeout(() => {
        setIsProcessing(false);
        toast({
          title: "Abonnement activé",
          description: `Votre essai gratuit de 14 jours sur la formule ${selectedPlan.toUpperCase()} a commencé.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/company"] });
        onComplete();
      }, 1500);
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de traiter le paiement", variant: "destructive" });
    },
  });

  function handleSubscribe() {
    subscribeMut.mutate(selectedPlan);
  }

  const currentPlan = PLANS.find(p => p.id === selectedPlan);
  const price = billing === "yearly" ? currentPlan?.yearlyPrice : currentPlan?.monthlyPrice;
  const yearlySavings = currentPlan ? (currentPlan.monthlyPrice * 12) - (currentPlan.yearlyPrice * 12) : 0;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="size-4" /> Retour
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 12V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
                  <path d="M6 12h4" />
                  <path d="M10 12v6a2 2 0 0 0 2 2h0" />
                  <path d="M14 12V8a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v4" />
                  <path d="M14 12h4" />
                  <path d="M18 12v4a2 2 0 0 1-2 2h-4" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                </svg>
              </div>
              <span className="font-semibold text-sm">PlombPro</span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground hidden sm:block">
            14 jours d'essai gratuit — Sans engagement
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 pt-8 overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto">
          {/* Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-medium mb-4">
              <Sparkles className="size-3.5" />
              Des prix simples et transparents
            </div>
            <h1 className="text-xl md:text-2xl font-bold mb-2">Choisissez votre formule</h1>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              Toutes les fonctionnalités dont vous avez besoin, à un prix juste. Aucun paiement immédiat.
            </p>
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === "monthly"
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="billing-monthly"
            >
              Mensuel
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billing === "yearly"
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="billing-yearly"
            >
              Annuel
              <span className="bg-emerald-500/15 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                -17%
              </span>
            </button>
          </div>

          {/* Plan Cards - OBAT style */}
          <div className="grid md:grid-cols-3 gap-5 mb-8">
            {PLANS.map((plan) => {
              const isSelected = selectedPlan === plan.id;
              const displayPrice = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
              const annualTotal = billing === "yearly" ? plan.yearlyTotal : plan.monthlyPrice * 12;
              const savings = plan.monthlyPrice * 12 - plan.yearlyTotal;

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className="text-left group"
                  data-testid={`plan-card-${plan.id}`}
                >
                  <Card className={`relative transition-all h-full ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-border/50 hover:border-primary/30"
                  } ${plan.popular ? "md:-mt-3 md:mb-0" : ""}`}>
                    
                    {/* Popular badge */}
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                        <div className="bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap flex items-center gap-1.5">
                          <Zap className="size-3" />
                          {plan.badge}
                        </div>
                      </div>
                    )}

                    <CardContent className="p-5 pt-7">
                      {/* Plan name + desc */}
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-base">{plan.name}</h3>
                        {isSelected && <CheckCircle2 className="size-5 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{plan.desc}</p>

                      {/* Price block - OBAT style */}
                      <div className="text-center py-4 mb-4 border-y border-border/30">
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-extrabold tracking-tight">{displayPrice} €</span>
                          <span className="text-xs text-muted-foreground font-medium">HT<br/>/ mois</span>
                        </div>
                        {billing === "yearly" ? (
                          <div className="mt-2">
                            <div className="text-xs text-muted-foreground">Paiement annuel de {annualTotal} € HT</div>
                            <div className="text-xs text-emerald-400 font-semibold mt-0.5">Économisez {savings} €</div>
                          </div>
                        ) : (
                          <div className="mt-2">
                            <div className="text-xs text-muted-foreground">Paiement mensuel de {displayPrice} € HT</div>
                            <div className="text-xs text-muted-foreground/60 mt-0.5">Sans engagement</div>
                          </div>
                        )}

                        {/* OBAT comparison */}
                        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                          <TrendingUp className="size-3" />
                          {plan.obatPrice - displayPrice}€ moins cher qu'Obat
                        </div>
                      </div>

                      {/* CTA button */}
                      <Button
                        className={`w-full mb-5 h-11 font-semibold text-sm ${
                          plan.popular 
                            ? "bg-primary hover:bg-primary/90" 
                            : isSelected 
                              ? "bg-primary hover:bg-primary/90"
                              : ""
                        }`}
                        variant={plan.popular || isSelected ? "default" : "outline"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlan(plan.id);
                          handleSubscribe();
                        }}
                        data-testid={`btn-choose-${plan.id}`}
                      >
                        Choisir ce pack
                      </Button>

                      {/* Features list */}
                      <ul className="space-y-2.5">
                        {plan.features.map((f, j) => (
                          <li key={j} className={`flex items-start gap-2.5 ${f.isSectionHeader ? "mt-3 pt-2 border-t border-border/20" : ""}`}>
                            {f.isSectionHeader ? (
                              <span className="text-xs font-bold text-foreground">{f.text}</span>
                            ) : (
                              <>
                                <CheckCircle2 className={`size-4 shrink-0 mt-0.5 ${
                                  f.highlight ? "text-primary" : "text-emerald-400/80"
                                }`} />
                                <span className={`text-xs leading-relaxed ${
                                  f.highlight ? "text-foreground font-semibold" : "text-muted-foreground"
                                }`}>{f.text}</span>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>

          {/* Comparison callout */}
          <div className="max-w-2xl mx-auto mb-8">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1">
                  <div className="text-sm font-semibold mb-1">Vous venez d'Obat ?</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Import gratuit de vos données (contacts, devis, factures). Plus de fonctionnalités, des prix plus bas, un support réactif. Migration en 24h.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 text-xs border-primary/30 text-primary hover:bg-primary/10">
                  En savoir plus
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 mb-8 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><Shield className="size-3.5 text-emerald-400" /> Paiement sécurisé Stripe</span>
            <span className="flex items-center gap-1.5"><Lock className="size-3.5 text-emerald-400" /> Données hébergées en France</span>
            <span className="flex items-center gap-1.5"><CreditCard className="size-3.5 text-emerald-400" /> Annulable à tout moment</span>
            <span className="flex items-center gap-1.5"><Headphones className="size-3.5 text-emerald-400" /> Support réactif 7j/7</span>
          </div>

          {/* Skip option */}
          <div className="text-center mb-8">
            <button
              type="button"
              onClick={() => subscribeMut.mutate(selectedPlan)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Continuer sans carte bancaire →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Wrench, FileCheck, Receipt, HardHat, Users, BarChart3,
  Calendar, CreditCard, Shield, ChevronRight, Star,
  Building2, CheckCircle2, ArrowRight, Zap, Globe, Lock,
  Smartphone, TrendingUp, BookOpen, ShoppingCart,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface LandingProps {
  onNavigate: (path: string) => void;
}

export default function LandingPage({ onNavigate }: LandingProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 12V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
                <path d="M6 12h4" />
                <path d="M10 12v6a2 2 0 0 0 2 2h0" />
                <path d="M14 12V8a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v4" />
                <path d="M14 12h4" />
                <path d="M18 12v4a2 2 0 0 1-2 2h-4" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
              </svg>
            </div>
            <span className="font-bold text-base">PlombPro</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-muted-foreground hover:text-foreground transition-colors">Fonctionnalités</button>
            <button onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })} className="text-muted-foreground hover:text-foreground transition-colors">Tarifs</button>
            <button onClick={() => document.getElementById('testimonials')?.scrollIntoView({ behavior: 'smooth' })} className="text-muted-foreground hover:text-foreground transition-colors">Témoignages</button>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle variant="ghost" />
            <Button variant="ghost" size="sm" onClick={() => onNavigate("login")} className="text-sm" data-testid="btn-login-header">
              Connexion
            </Button>
            <Button size="sm" onClick={() => onNavigate("signup")} className="text-sm gap-1.5" data-testid="btn-signup-header">
              Essai gratuit <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
            <Zap className="size-3.5" />
            Le logiciel n°1 des plombiers en France
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-5">
            Gérez votre entreprise de
            <span className="text-primary"> plomberie</span> comme un pro
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            Devis, factures, chantiers, planning, achats, banque — tout dans un seul outil.
            Plus rapide qu'Obat, plus puissant que ServiceTitan, conçu pour les artisans français.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <Button size="lg" onClick={() => onNavigate("signup")} className="gap-2 px-8 h-12 text-base" data-testid="btn-hero-cta">
              Commencer gratuitement <ArrowRight className="size-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="gap-2 px-8 h-12 text-base">
              Découvrir les fonctionnalités
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">14 jours d'essai gratuit — Sans engagement — Sans carte bancaire</p>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="py-8 border-y border-border/40 bg-muted/20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-14">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">2 500+</div>
              <div className="text-xs text-muted-foreground">Artisans actifs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">15M€</div>
              <div className="text-xs text-muted-foreground">Facturés par mois</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">4.8/5</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1 justify-center">
                <Star className="size-3 text-amber-400 fill-amber-400" />
                Sur Trustpilot
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">98%</div>
              <div className="text-xs text-muted-foreground">Taux de satisfaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Tout ce dont vous avez besoin, rien de superflu</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Un outil complet pensé par des plombiers, pour des plombiers.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: FileCheck, title: "Devis professionnels", desc: "Créez des devis en 2 minutes avec votre bibliothèque de prix. Signature électronique incluse." },
              { icon: Receipt, title: "Facturation complète", desc: "Factures, avoirs, acomptes, situations, retenues de garantie. Conforme Factur-X." },
              { icon: HardHat, title: "Gestion de chantiers", desc: "Suivez la rentabilité de chaque chantier en temps réel : matériaux, main-d'œuvre, sous-traitance." },
              { icon: Calendar, title: "Planning intégré", desc: "Planifiez vos interventions et celles de vos équipes. Vue jour, semaine, mois." },
              { icon: ShoppingCart, title: "Achats & Fournisseurs", desc: "Bons de commande, suivi des livraisons, historique des prix fournisseurs." },
              { icon: CreditCard, title: "Rapprochement bancaire", desc: "Connectez votre banque et rapprochez automatiquement factures et paiements." },
              { icon: BarChart3, title: "Pilotage & Analytics", desc: "Tableaux de bord en temps réel : CA, marge, trésorerie, performance par chantier." },
              { icon: Users, title: "Contacts & CRM", desc: "Clients, fournisseurs, sous-traitants. Historique complet de chaque relation." },
              { icon: BookOpen, title: "Bibliothèque de prix", desc: "Catalogue de fournitures, ouvrages et main-d'œuvre avec calcul automatique des marges." },
              { icon: Shield, title: "Conformité légale", desc: "Mentions légales, assurance décennale, e-facturation — tout est conforme." },
              { icon: Globe, title: "Primes énergie", desc: "Gestion MaPrimeRénov', CEE, éco-PTZ directement dans vos devis et factures." },
              { icon: Smartphone, title: "Accès mobile", desc: "Gérez vos devis et chantiers depuis votre téléphone, même sur le terrain." },
            ].map((f, i) => (
              <Card key={i} className="border-border/50 hover:border-primary/30 transition-colors group">
                <CardContent className="p-5">
                  <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                    <f.icon className="size-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="py-16 px-4 bg-muted/20 border-y border-border/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Pourquoi choisir PlombPro ?</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="size-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Gagner 5h par semaine</h3>
              <p className="text-sm text-muted-foreground">Automatisez devis, factures et relances. Concentrez-vous sur vos chantiers.</p>
            </div>
            <div className="text-center">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="size-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">100% conforme</h3>
              <p className="text-sm text-muted-foreground">E-facturation, mentions légales, TVA réduite — jamais de problème avec le fisc.</p>
            </div>
            <div className="text-center">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Building2 className="size-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Fait pour les artisans</h3>
              <p className="text-sm text-muted-foreground">Pas un logiciel générique. Chaque fonctionnalité est pensée pour le BTP.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Des tarifs simples et transparents</h2>
            <p className="text-muted-foreground">14 jours d'essai gratuit sur toutes les formules — Moins cher qu'Obat, plus complet</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                name: "PRO", price: "29", yearlyPrice: "24", obatPrice: "39",
                desc: "Gestion clients, chiffrage et facturation complète",
                features: ["2 utilisateurs", "Devis & factures illimités", "Bibliothèques de prix incluses", "500+ modèles de devis", "Signatures électroniques", "Connexion bancaire", "Accès comptable inclus", "Conformité e-facturation 2026", "Support email & chat"],
                popular: false,
              },
              {
                name: "CROISSANCE", price: "49", yearlyPrice: "41", obatPrice: "69",
                desc: "Planifiez vos chantiers, pilotez votre rentabilité",
                features: ["5 utilisateurs", "Tout PRO +", "Achats & commandes fournisseurs", "Rentabilité chantier temps réel", "Planning & calendrier équipe", "Suivi du temps par intervention", "Connexion bancaire multi-comptes", "Statistiques financières complètes", "Primes énergie (CEE, MaPrimeRénov')", "Accompagnement illimité"],
                popular: true,
              },
              {
                name: "BOOSTER", price: "89", yearlyPrice: "74", obatPrice: "109",
                desc: "Gestion complète multi-sociétés, visibilité maximale",
                features: ["Utilisateurs illimités", "Tout CROISSANCE +", "Multi-sociétés", "Marketplace fournisseurs", "API & intégrations", "Import données (Obat, EBP)", "Manager dédié", "Formation équipe incluse"],
                popular: false,
              },
            ].map((plan, i) => (
              <Card key={i} className={`relative ${plan.popular ? 'border-primary shadow-lg shadow-primary/10' : 'border-border/50'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5"><Zap className="size-3" /> Le plus populaire</span>
                  </div>
                )}
                <CardContent className="p-6 pt-7">
                  <h3 className="font-bold text-base mb-1">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mb-4">{plan.desc}</p>
                  <div className="text-center py-3 mb-4 border-y border-border/30">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-extrabold">{plan.price} €</span>
                      <span className="text-xs text-muted-foreground">HT / mois</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5">ou {plan.yearlyPrice}€/mois en annuel</div>
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">
                      <TrendingUp className="size-3" />
                      {parseInt(plan.obatPrice) - parseInt(plan.price)}€ moins cher qu'Obat
                    </div>
                  </div>
                  <Button
                    className="w-full mb-5 h-11 font-semibold"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => onNavigate("signup")}
                    data-testid={`btn-pricing-${plan.name.toLowerCase()}`}
                  >
                    Choisir ce pack
                  </Button>
                  <ul className="space-y-2.5">
                    {plan.features.map((f, j) => (
                      <li key={j} className={`flex items-start gap-2 text-sm ${j === 1 && i > 0 ? 'font-bold text-foreground mt-2 pt-2 border-t border-border/20' : ''}`}>
                        {(j === 1 && i > 0) ? (
                          <span className="text-xs font-bold">{f}</span>
                        ) : (
                          <>
                            <CheckCircle2 className={`size-4 shrink-0 mt-0.5 ${j === 0 ? 'text-primary' : 'text-emerald-400/80'}`} />
                            <span className={j === 0 ? 'font-semibold' : ''}>{f}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-16 px-4 bg-muted/20 border-y border-border/40">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">Ils nous font confiance</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { name: "Mathieu D.", role: "Plombier chauffagiste, Lyon", text: "Depuis que j'utilise PlombPro, je fais mes devis en 3 minutes au lieu de 30. Mes clients sont impressionnés par le professionnalisme.", rating: 5 },
              { name: "Stéphanie L.", role: "Gérante, Thermo Confort", text: "Le suivi de chantiers est incroyable. Je vois la rentabilité en temps réel et je peux réagir immédiatement si un chantier dérape.", rating: 5 },
              { name: "Jean-Pierre M.", role: "Artisan plombier, Marseille", text: "J'ai quitté Obat pour PlombPro. L'interface est plus claire, les fonctionnalités sont complètes, et le prix est plus juste.", rating: 5 },
            ].map((t, i) => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-5">
                  <div className="flex gap-0.5 mb-3">
                    {[...Array(t.rating)].map((_, j) => (
                      <Star key={j} className="size-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm mb-4 leading-relaxed">"{t.text}"</p>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">Questions fréquentes</h2>
          <div className="space-y-4">
            {[
              { q: "Puis-je essayer gratuitement ?", a: "Oui, 14 jours d'essai gratuit sur toutes les formules, sans carte bancaire. Vous pouvez annuler à tout moment." },
              { q: "Mes données sont-elles sécurisées ?", a: "Absolument. Vos données sont hébergées en France (serveurs OVH), chiffrées et sauvegardées quotidiennement." },
              { q: "Puis-je importer mes données depuis Obat ou un autre logiciel ?", a: "Oui, nous proposons un import gratuit de vos contacts, devis et factures depuis Obat, Batappli, EBP et Excel." },
              { q: "L'application est-elle conforme à la facturation électronique 2026 ?", a: "Oui, PlombPro est conforme Factur-X et sera compatible avec le Portail Public de Facturation (PPF) dès son lancement." },
              { q: "Puis-je gérer la TVA réduite (5.5% et 10%) ?", a: "Bien sûr, la TVA réduite est gérée automatiquement avec les attestations simplifiées incluses." },
            ].map((faq, i) => (
              <details key={i} className="group border border-border/50 rounded-lg">
                <summary className="flex items-center justify-between p-4 cursor-pointer font-medium text-sm hover:text-primary transition-colors">
                  {faq.q}
                  <ChevronRight className="size-4 text-muted-foreground group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 px-4 bg-primary/5 border-t border-border/40">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Prêt à simplifier votre gestion ?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">Rejoignez les 2 500 artisans qui gèrent leur entreprise avec PlombPro. C'est gratuit pendant 14 jours.</p>
          <Button size="lg" onClick={() => onNavigate("signup")} className="gap-2 px-10 h-12 text-base" data-testid="btn-final-cta">
            Démarrer mon essai gratuit <ArrowRight className="size-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded bg-primary text-primary-foreground">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 12V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1" />
                <path d="M6 12h4" />
                <path d="M10 12v6a2 2 0 0 0 2 2h0" />
                <path d="M14 12V8a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v4" />
                <path d="M14 12h4" />
                <path d="M18 12v4a2 2 0 0 1-2 2h-4" />
                <circle cx="12" cy="12" r="1" fill="currentColor" />
              </svg>
            </div>
            <span className="text-sm font-medium">PlombPro</span>
          </div>
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span>CGV</span>
            <span>Mentions légales</span>
            <span>Confidentialité</span>
            <a href="https://www.perplexity.ai/computer" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              Created with Perplexity Computer
            </a>
          </div>
          <div className="text-xs text-muted-foreground">
            © 2026 PlombPro. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}

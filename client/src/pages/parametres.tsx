import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { db } from "@/lib/supabaseData";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Check, Crown, Zap, Rocket, Building2, CreditCard, FileText, Shield, Star,
  Download, Plus, Trash2, ArrowRightLeft, Building, Mail, MessageCircle,
  RefreshCw, CheckCircle2, XCircle, Plug, Palette, Eye,
} from "lucide-react";
import type { CompanySettings, Company, IntegrationSettings } from "@shared/schema";

const PLANS = [
  {
    id: "pro", name: "PRO", price: 29, period: "/mois",
    description: "Pour les artisans indépendants",
    icon: <Zap className="size-5" />,
    color: "border-blue-500/30 bg-blue-500/5",
    features: [
      "Devis et factures illimités", "Signature électronique", "Documents digitalisés",
      "500+ modèles de devis", "Gestion contacts et chantiers", "Bibliothèque de prix",
      "Export comptable (FEC)", "Paiements clients en ligne", "Conformité Factur-X basique", "Support email",
    ],
    limitations: ["1 utilisateur", "Pas de planning", "Pas de pilotage avancé"],
  },
  {
    id: "croissance", name: "CROISSANCE", price: 49, period: "/mois", popular: true,
    description: "Pour les entreprises en développement",
    icon: <Crown className="size-5" />,
    color: "border-primary/50 bg-primary/5",
    features: [
      "Tout PRO inclus", "Suivi du temps par intervention", "Planning et dispatch techniciens",
      "Achats et commandes fournisseurs", "Retenues de garantie", "Primes énergie (CEE, MaPrimeRénov')",
      "Connexion bancaire multi-comptes", "Pilotage et analytics", "Factures de situation",
      "3 utilisateurs", "Support prioritaire",
    ],
    limitations: [],
  },
  {
    id: "booster", name: "BOOSTER", price: 89, period: "/mois",
    description: "Pour les PME du bâtiment",
    icon: <Rocket className="size-5" />,
    color: "border-violet-500/30 bg-violet-500/5",
    features: [
      "Tout CROISSANCE inclus", "Multi-sociétés", "Utilisateurs illimités",
      "Marketplace fournisseurs", "API et intégrations avancées",
      "Import données (Obat, EBP, Excel)", "Factur-X complet (profil EN16931)",
      "Gestion matériel / parc véhicules", "Formations personnalisées", "Support dédié + téléphone",
    ],
    limitations: [],
  },
];

export default function ParametresPage() {
  const { toast } = useToast();
  const { data: company } = useQuery<any>({
    queryKey: ["company"],
    queryFn: () => db.getCompanySettings(),
  });
  const { data: companies = [] } = useQuery<any[]>({
    queryKey: ["companies"],
    queryFn: () => db.getCompanySettings().then(c => c ? [c] : []),
  });
  const [companyForm, setCompanyForm] = useState<Partial<CompanySettings>>({});
  const [multiOpen, setMultiOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", siret: "", legal_form: "", address: "", city: "", postal_code: "", color: "#D97706" });

  const initForm = company && Object.keys(companyForm).length === 0;
  if (initForm && company) {
    setTimeout(() => setCompanyForm({
      name: company.name, siret: company.siret || "", tva_intracom: company.tva_intracom || "",
      address: company.address || "", city: company.city || "", postal_code: company.postal_code || "",
      phone: company.phone || "", email: company.email || "",
      rcs_number: company.rcs_number || "", assurance_decennale: company.assurance_decennale || "",
      iban: company.iban || "", bic: company.bic || "", bank_name: company.bank_name || "",
      capital: company.capital || "", legal_form: company.legal_form || "",
    }), 0);
  }

  const updateMut = useMutation({
    mutationFn: async (data: any) => {
      const mapped: Record<string, unknown> = {};
      if (data.name !== undefined) mapped.name = data.name;
      if (data.siret !== undefined) mapped.siret = data.siret;
      if (data.tva_intracom !== undefined) mapped.tva_intracom = data.tva_intracom;
      if (data.address !== undefined) mapped.address = data.address;
      if (data.city !== undefined) mapped.city = data.city;
      if (data.postal_code !== undefined) mapped.postal_code = data.postal_code;
      if (data.phone !== undefined) mapped.phone = data.phone;
      if (data.email !== undefined) mapped.email = data.email;
      if (data.rcs_number !== undefined) mapped.rcs_number = data.rcs_number;
      if (data.assurance_decennale !== undefined) mapped.assurance_decennale = data.assurance_decennale;
      if (data.iban !== undefined) mapped.iban = data.iban;
      if (data.bic !== undefined) mapped.bic = data.bic;
      if (data.bank_name !== undefined) mapped.bank_name = data.bank_name;
      if (data.capital !== undefined) mapped.capital = data.capital;
      if (data.legal_form !== undefined) mapped.legal_form = data.legal_form;
      if (data.plan !== undefined) mapped.plan = data.plan;
      return db.updateCompanySettings(mapped as any);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["company"] }); toast({ title: "Paramètres sauvegardés" }); },
  });

  const changePlanMut = useMutation({
    mutationFn: async (plan: string) => db.updateCompanySettings({ plan } as any),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["company"] }); toast({ title: "Abonnement mis à jour" }); },
  });

  const createCompanyMut = useMutation({
    mutationFn: async (data: any) => {
      // For multi-company, we just update company settings or create new
      toast({ title: "Fonctionnalité multi-sociétés bientôt disponible" });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["companies"] }); setMultiOpen(false); toast({ title: "Société ajoutée" }); setNewCompany({ name: "", siret: "", legal_form: "", address: "", city: "", postal_code: "", color: "#D97706" }); },
  });

  const deleteCompanyMut = useMutation({
    mutationFn: async (id: number) => {
      toast({ title: "Fonctionnalité multi-sociétés bientôt disponible" });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["companies"] }); toast({ title: "Société supprimée" }); },
  });

  const switchCompanyMut = useMutation({
    mutationFn: async (comp: Company) => db.updateCompanySettings({
      name: comp.name, siret: comp.siret, legal_form: comp.legal_form, address: comp.address, city: comp.city, postal_code: comp.postal_code,
    } as any),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["company"] }); toast({ title: "Société active changée" }); },
  });

  async function handleFecExport() {
    try {
      const year = new Date().getFullYear().toString();
      const csvData = await db.getFECData(year);
      const blob = new Blob(["\uFEFF" + csvData], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `FEC_${company?.siret?.replace(/\s/g, "") || "export"}_${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Export FEC téléchargé", description: "Le fichier des écritures comptables a été généré." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de générer l'export FEC.", variant: "destructive" });
    }
  }

  return (
    <AppLayout title="Paramètres">
      <Tabs defaultValue="subscription" className="space-y-4">
        <TabsList className="h-9 flex-wrap">
          <TabsTrigger value="subscription" className="text-xs h-8 gap-1.5"><CreditCard className="size-3.5" /> Abonnement</TabsTrigger>
          <TabsTrigger value="company" className="text-xs h-8 gap-1.5"><Building2 className="size-3.5" /> Entreprise</TabsTrigger>
          <TabsTrigger value="multi" className="text-xs h-8 gap-1.5"><Building className="size-3.5" /> Multi-sociétés</TabsTrigger>
          <TabsTrigger value="invoicing" className="text-xs h-8 gap-1.5"><FileText className="size-3.5" /> Facturation</TabsTrigger>
          <TabsTrigger value="comptable" className="text-xs h-8 gap-1.5"><Download className="size-3.5" /> Comptabilité</TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs h-8 gap-1.5"><Plug className="size-3.5" /> Intégrations</TabsTrigger>
        </TabsList>

        {/* ─── Subscription Tab ─── */}
        <TabsContent value="subscription">
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-1">Votre abonnement</h2>
            <p className="text-sm text-muted-foreground">
              Abonnement actuel : <Badge variant="outline" className="ml-1 text-primary border-primary/30">{company?.plan?.toUpperCase() || "FREE"}</Badge>
            </p>
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            {PLANS.map(plan => {
              const isCurrent = company?.plan === plan.id;
              return (
                <Card key={plan.id} className={`relative ${plan.color} ${isCurrent ? "ring-2 ring-primary" : ""}`} data-testid={`plan-card-${plan.id}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground text-[10px] gap-1"><Star className="size-3" /> Recommandé</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-3 pt-5">
                    <div className="flex items-center gap-2">{plan.icon}<CardTitle className="text-base">{plan.name}</CardTitle></div>
                    <CardDescription className="text-xs">{plan.description}</CardDescription>
                    <div className="mt-3"><span className="text-3xl font-bold">{plan.price}€</span><span className="text-sm text-muted-foreground">{plan.period}</span></div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {plan.features.map((f, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs"><Check className="size-3.5 text-emerald-400 shrink-0 mt-0.5" /><span>{f}</span></div>
                      ))}
                    </div>
                    {plan.limitations.length > 0 && (
                      <div className="pt-2 border-t border-border/50 space-y-1">
                        {plan.limitations.map((l, i) => (<div key={i} className="text-xs text-muted-foreground">• {l}</div>))}
                      </div>
                    )}
                    <Button className="w-full mt-2" variant={isCurrent ? "outline" : "default"} size="sm" disabled={isCurrent} onClick={() => changePlanMut.mutate(plan.id)} data-testid={`btn-plan-${plan.id}`}>
                      {isCurrent ? "Abonnement actuel" : `Choisir ${plan.name}`}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <Card className="mt-6"><CardContent className="py-4"><div className="flex items-center gap-3"><Shield className="size-5 text-emerald-400" /><div><div className="text-sm font-medium">Essai gratuit 14 jours</div><div className="text-xs text-muted-foreground">Testez toutes les fonctionnalités BOOSTER sans engagement. Annulation en 1 clic.</div></div></div></CardContent></Card>
        </TabsContent>

        {/* ─── Company Tab ─── */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Informations de l'entreprise</CardTitle>
              <CardDescription className="text-xs">Ces informations apparaissent sur vos devis et factures.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); updateMut.mutate(companyForm); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Raison sociale</Label><Input value={companyForm.name || ""} onChange={e => setCompanyForm(f => ({ ...f, name: e.target.value }))} /></div>
                  <div><Label>Forme juridique</Label><Input value={companyForm.legal_form || ""} onChange={e => setCompanyForm(f => ({ ...f, legal_form: e.target.value }))} placeholder="SARL, SAS..." /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>SIRET</Label><Input value={companyForm.siret || ""} onChange={e => setCompanyForm(f => ({ ...f, siret: e.target.value }))} /></div>
                  <div><Label>N° TVA intracommunautaire</Label><Input value={companyForm.tva_intracom || ""} onChange={e => setCompanyForm(f => ({ ...f, tva_intracom: e.target.value }))} /></div>
                </div>
                <div><Label>Adresse</Label><Input value={companyForm.address || ""} onChange={e => setCompanyForm(f => ({ ...f, address: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Ville</Label><Input value={companyForm.city || ""} onChange={e => setCompanyForm(f => ({ ...f, city: e.target.value }))} /></div>
                  <div><Label>Code postal</Label><Input value={companyForm.postal_code || ""} onChange={e => setCompanyForm(f => ({ ...f, postal_code: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Téléphone</Label><Input value={companyForm.phone || ""} onChange={e => setCompanyForm(f => ({ ...f, phone: e.target.value }))} /></div>
                  <div><Label>Email</Label><Input value={companyForm.email || ""} onChange={e => setCompanyForm(f => ({ ...f, email: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>RCS</Label><Input value={companyForm.rcs_number || ""} onChange={e => setCompanyForm(f => ({ ...f, rcs_number: e.target.value }))} /></div>
                  <div><Label>Capital (€)</Label><Input value={companyForm.capital || ""} onChange={e => setCompanyForm(f => ({ ...f, capital: e.target.value }))} /></div>
                </div>
                <div><Label>Assurance décennale</Label><Input value={companyForm.assurance_decennale || ""} onChange={e => setCompanyForm(f => ({ ...f, assurance_decennale: e.target.value }))} /></div>
                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-medium mb-3">Coordonnées bancaires</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>IBAN</Label><Input value={companyForm.iban || ""} onChange={e => setCompanyForm(f => ({ ...f, iban: e.target.value }))} /></div>
                    <div><Label>BIC</Label><Input value={companyForm.bic || ""} onChange={e => setCompanyForm(f => ({ ...f, bic: e.target.value }))} /></div>
                    <div><Label>Banque</Label><Input value={companyForm.bank_name || ""} onChange={e => setCompanyForm(f => ({ ...f, bank_name: e.target.value }))} /></div>
                  </div>
                </div>
                <Button type="submit" disabled={updateMut.isPending} data-testid="btn-save-company">
                  {updateMut.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Multi-sociétés Tab ─── */}
        <TabsContent value="multi">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Multi-sociétés</h2>
              <p className="text-sm text-muted-foreground">Gérez plusieurs entreprises depuis un seul compte PlombPro.</p>
            </div>
            <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setMultiOpen(true)} data-testid="btn-add-company">
              <Plus className="size-3.5" /> Ajouter une société
            </Button>
          </div>

          <div className="grid gap-3">
            {companies.map((comp: any) => (
              <Card key={comp.id} className={`${comp.is_primary ? "ring-2 ring-primary" : ""}`} data-testid={`company-card-${comp.id}`}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: comp.color || "#D97706" }}>
                        {comp.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{comp.name}</span>
                          {comp.is_primary && <Badge className="text-[10px] bg-primary/10 text-primary border-0">Principale</Badge>}
                          {comp.is_active && <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">Active</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {comp.legal_form} · SIRET: {comp.siret || "Non renseigné"} · {comp.city}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!comp.is_primary && (
                        <>
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => switchCompanyMut.mutate(comp)}>
                            <ArrowRightLeft className="size-3" /> Basculer
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400" onClick={() => deleteCompanyMut.mutate(comp.id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {companies.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">Aucune société supplémentaire. Ajoutez-en une pour gérer plusieurs entités.</CardContent></Card>
            )}
          </div>

          <Dialog open={multiOpen} onOpenChange={setMultiOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Ajouter une société</DialogTitle></DialogHeader>
              <form onSubmit={e => { e.preventDefault(); createCompanyMut.mutate({ ...newCompany, isActive: true, isPrimary: false }); }} className="space-y-3">
                <div><Label>Raison sociale *</Label><Input value={newCompany.name} onChange={e => setNewCompany(f => ({ ...f, name: e.target.value }))} required data-testid="input-company-name" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>SIRET</Label><Input value={newCompany.siret} onChange={e => setNewCompany(f => ({ ...f, siret: e.target.value }))} /></div>
                  <div><Label>Forme juridique</Label><Input value={newCompany.legal_form} onChange={e => setNewCompany(f => ({ ...f, legal_form: e.target.value }))} placeholder="SARL, SAS..." /></div>
                </div>
                <div><Label>Adresse</Label><Input value={newCompany.address} onChange={e => setNewCompany(f => ({ ...f, address: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Ville</Label><Input value={newCompany.city} onChange={e => setNewCompany(f => ({ ...f, city: e.target.value }))} /></div>
                  <div><Label>Code postal</Label><Input value={newCompany.postal_code} onChange={e => setNewCompany(f => ({ ...f, postal_code: e.target.value }))} /></div>
                </div>
                <div><Label>Couleur</Label><Input type="color" value={newCompany.color} onChange={e => setNewCompany(f => ({ ...f, color: e.target.value }))} className="h-9 w-20" /></div>
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setMultiOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={createCompanyMut.isPending || !newCompany.name} data-testid="btn-submit-company">
                    {createCompanyMut.isPending ? "Création..." : "Ajouter"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─── Invoicing Tab ─── */}
        <TabsContent value="invoicing">
          <InvoicingSettings company={company} />
        </TabsContent>

        {/* ─── Comptabilité / FEC Export Tab ─── */}
        <TabsContent value="comptable">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Export comptable (FEC)</CardTitle>
                <CardDescription className="text-xs">Générez le Fichier des Écritures Comptables au format légal pour votre expert-comptable.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Fichier des Écritures Comptables (FEC)</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Export conforme à l'article L47 A-1 du Livre des procédures fiscales.
                        Inclut toutes les factures et avoirs avec ventilation TVA.
                      </div>
                    </div>
                    <Button onClick={handleFecExport} className="gap-2" size="sm" data-testid="btn-export-fec">
                      <Download className="size-3.5" /> Télécharger FEC
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="py-3 px-4">
                      <div className="text-xs text-muted-foreground">Format</div>
                      <div className="text-sm font-medium mt-1">Texte tabulé (pipe |)</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="py-3 px-4">
                      <div className="text-xs text-muted-foreground">Encodage</div>
                      <div className="text-sm font-medium mt-1">UTF-8</div>
                    </CardContent>
                  </Card>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-sm font-medium mb-2">Colonnes exportées</div>
                  <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                    {["JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib", "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit", "ValidDate", "Idevise"].map(col => (
                      <div key={col} className="flex items-center gap-1"><Check className="size-3 text-emerald-400" />{col}</div>
                    ))}
                  </div>
                </div>

                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Shield className="size-4 text-primary" />
                      <div>
                        <div className="text-xs font-medium">Accès comptable direct</div>
                        <div className="text-[10px] text-muted-foreground">Partagez un accès en lecture seule à votre comptabilité avec votre expert-comptable via une clé API dédiée (onglet Intégrations).</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Intégrations Tab ─── */}
        <TabsContent value="integrations">
          <IntegrationsPanel />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

// ─── Invoicing Settings Component ─────────────────────────────
const PRESET_COLORS = [
  "#C87941", "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1", "#14B8A6",
];
const PAYMENT_METHODS_OPTIONS = [
  { value: "virement", label: "Virement bancaire" },
  { value: "chèque", label: "Chèque" },
  { value: "CB", label: "Carte bancaire" },
  { value: "espèces", label: "Espèces" },
  { value: "prélèvement", label: "Prélèvement" },
  { value: "traite", label: "Traite / LCR" },
];
const DEFAULT_CGV_BTP = `Conditions Générales de Vente — Travaux de plomberie / chauffage / sanitaire

1. OBJET : Les présentes CGV s'appliquent à l'ensemble des travaux réalisés par l'entreprise.

2. DEVIS : Tout devis signé vaut commande ferme. Le devis est valable 30 jours sauf mention contraire.

3. PRIX : Les prix sont établis HT. La TVA applicable est celle en vigueur au jour de la facturation. Les travaux de rénovation dans un logement de plus de 2 ans bénéficient du taux réduit (10% ou 5,5%).

4. PAIEMENT : Sauf accord contraire, les factures sont payables à 30 jours date de facture. Tout retard de paiement entraîne l'application de pénalités au taux de 3 fois le taux d'intérêt légal, ainsi qu'une indemnité forfaitaire de recouvrement de 40€.

5. ACOMPTE : Un acompte de 30% du montant TTC est demandé à la commande. Le solde est payable à la réception des travaux.

6. GARANTIE : L'entreprise est titulaire d'une assurance décennale couvrant les travaux réalisés. Garantie de parfait achèvement : 1 an. Garantie biennale : 2 ans. Garantie décennale : 10 ans.

7. SOUS-TRAITANCE : L'entreprise se réserve le droit de sous-traiter tout ou partie des travaux.

8. RÉSERVES : Toute réclamation doit être formulée par écrit dans les 8 jours suivant la réception des travaux.

9. LITIGES : En cas de litige, les parties s'engagent à rechercher une solution amiable avant toute action judiciaire. À défaut, le tribunal compétent sera celui du siège de l'entreprise.`;

function InvoicingSettings({ company }: { company: CompanySettings | undefined }) {
  const { toast } = useToast();

  const [docColor, setDocColor] = useState(company?.document_color || "#C87941");
  const [customColor, setCustomColor] = useState("");
  const [logoAlign, setLogoAlign] = useState(company?.logo_alignment || "left");
  const [tableStyle, setTableStyle] = useState(company?.table_style || "striped");
  const [devisPrefix, setDevisPrefix] = useState(company?.devis_prefix || "DEV");
  const [facturePrefix, setFacturePrefix] = useState(company?.facture_prefix || "FAC");
  const [avoirPrefix, setAvoirPrefix] = useState(company?.avoir_prefix || "AV");
  const [numberSep, setNumberSep] = useState(company?.number_separator || "-");
  const [yearFormat, setYearFormat] = useState(company?.number_year_format || "YYYY");
  const [defaultValidity, setDefaultValidity] = useState(String(company?.default_validity ?? 30));
  const [paymentDelay, setPaymentDelay] = useState(String(company?.default_payment_delay ?? 30));
  const [paymentMethods, setPaymentMethods] = useState<string[]>(() => {
    try { return company?.default_payment_methods ? JSON.parse(company.default_payment_methods) : ["virement", "chèque"]; } catch { return ["virement", "chèque"]; }
  });
  const [acompteRate, setAcompteRate] = useState(company?.default_acompte_rate || "30");
  const [cgvText, setCgvText] = useState(company?.cgv_text || "");
  const [showCgv, setShowCgv] = useState(company?.show_cgv ?? false);
  const [autoliquidation, setAutoliquidation] = useState(company?.autoliquidation_mention || "");

  // Sync state when company data loads
  const companyId = company?.id;
  useState(() => {
    if (company) {
      setDocColor(company.document_color || "#C87941");
      setLogoAlign(company.logo_alignment || "left");
      setTableStyle(company.table_style || "striped");
      setDevisPrefix(company.devis_prefix || "DEV");
      setFacturePrefix(company.facture_prefix || "FAC");
      setAvoirPrefix(company.avoir_prefix || "AV");
      setNumberSep(company.number_separator || "-");
      setYearFormat(company.number_year_format || "YYYY");
      setDefaultValidity(String(company.default_validity ?? 30));
      setPaymentDelay(String(company.default_payment_delay ?? 30));
      try { setPaymentMethods(company.default_payment_methods ? JSON.parse(company.default_payment_methods) : ["virement", "chèque"]); } catch { /* keep default */ }
      setAcompteRate(company.default_acompte_rate || "30");
      setCgvText(company.cgv_text || "");
      setShowCgv(company.show_cgv ?? false);
      setAutoliquidation(company.autoliquidation_mention || "");
    }
  });

  const saveMut = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return db.updateCompanySettings(data as any);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["company"] }); toast({ title: "Paramètres de facturation sauvegardés" }); },
  });

  function handleSave() {
    saveMut.mutate({
      document_color: docColor,
      logo_alignment: logoAlign,
      table_style: tableStyle,
      devis_prefix: devisPrefix,
      facture_prefix: facturePrefix,
      avoir_prefix: avoirPrefix,
      number_separator: numberSep,
      number_year_format: yearFormat,
      default_validity: parseInt(defaultValidity) || 30,
      default_payment_delay: parseInt(paymentDelay) || 30,
      default_payment_methods: JSON.stringify(paymentMethods),
      default_acompte_rate: acompteRate,
      cgv_text: cgvText,
      show_cgv: showCgv,
      autoliquidation_mention: autoliquidation || null,
    });
  }

  const togglePaymentMethod = (method: string) => {
    setPaymentMethods(prev =>
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    );
  };

  // Number preview
  const yearStr = yearFormat === "YY" ? "26" : "2026";
  const devisPreview = `${devisPrefix}${numberSep}${yearStr}${numberSep}001`;
  const facturePreview = `${facturePrefix}${numberSep}${yearStr}${numberSep}001`;
  const avoirPreview = `${avoirPrefix}${numberSep}${yearStr}${numberSep}001`;

  return (
    <div className="space-y-6">
      {/* ─── Numérotation ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Numérotation des documents</CardTitle>
          <CardDescription className="text-xs">Configurez les préfixes et le format de numérotation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Préfixe devis</Label><Input value={devisPrefix} onChange={e => setDevisPrefix(e.target.value)} data-testid="input-devis-prefix" /></div>
            <div><Label>Préfixe factures</Label><Input value={facturePrefix} onChange={e => setFacturePrefix(e.target.value)} data-testid="input-facture-prefix" /></div>
            <div><Label>Préfixe avoirs</Label><Input value={avoirPrefix} onChange={e => setAvoirPrefix(e.target.value)} data-testid="input-avoir-prefix" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Séparateur</Label>
              <Select value={numberSep} onValueChange={setNumberSep}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="-">Tiret (-)</SelectItem>
                  <SelectItem value="/">Slash (/)</SelectItem>
                  <SelectItem value=".">Point (.)</SelectItem>
                  <SelectItem value="_">Underscore (_)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Format année</Label>
              <Select value={yearFormat} onValueChange={setYearFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="YYYY">2026 (YYYY)</SelectItem>
                  <SelectItem value="YY">26 (YY)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-xs text-muted-foreground mb-2">Aperçu</div>
            <div className="flex gap-6 text-sm">
              <div><span className="text-muted-foreground">Devis :</span> <span className="font-mono font-medium">{devisPreview}</span></div>
              <div><span className="text-muted-foreground">Facture :</span> <span className="font-mono font-medium">{facturePreview}</span></div>
              <div><span className="text-muted-foreground">Avoir :</span> <span className="font-mono font-medium">{avoirPreview}</span></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Conditions par défaut ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Conditions par défaut</CardTitle>
          <CardDescription className="text-xs">Valeurs utilisées par défaut pour les nouveaux documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Validité devis (jours)</Label>
              <Input type="number" value={defaultValidity} onChange={e => setDefaultValidity(e.target.value)} data-testid="input-validity" />
            </div>
            <div>
              <Label>Délai de paiement (jours)</Label>
              <Input type="number" value={paymentDelay} onChange={e => setPaymentDelay(e.target.value)} data-testid="input-payment-delay" />
            </div>
            <div>
              <Label>Acompte (%)</Label>
              <Input type="number" value={acompteRate} onChange={e => setAcompteRate(e.target.value)} data-testid="input-acompte-rate" />
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Modes de paiement acceptés</Label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS_OPTIONS.map(pm => (
                <button
                  key={pm.value}
                  type="button"
                  onClick={() => togglePaymentMethod(pm.value)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-all ${
                    paymentMethods.includes(pm.value)
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
                  }`}
                  data-testid={`pm-${pm.value}`}
                >
                  {paymentMethods.includes(pm.value) && <Check className="size-3 inline mr-1" />}
                  {pm.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Mentions légales / CGV ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Mentions légales & CGV</CardTitle>
          <CardDescription className="text-xs">Conditions générales de vente imprimées au dos de vos documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={showCgv} onCheckedChange={setShowCgv} data-testid="switch-cgv" />
              <Label>Afficher les CGV sur les documents</Label>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => setCgvText(DEFAULT_CGV_BTP)}
              data-testid="btn-generate-cgv"
            >
              <FileText className="size-3" /> Générer CGV type BTP
            </Button>
          </div>
          <Textarea
            value={cgvText}
            onChange={e => setCgvText(e.target.value)}
            rows={8}
            placeholder="Saisissez vos conditions générales de vente..."
            className="text-xs"
            data-testid="textarea-cgv"
          />
          <Separator />
          <div>
            <Label>Mention autoliquidation de TVA</Label>
            <Input
              value={autoliquidation}
              onChange={e => setAutoliquidation(e.target.value)}
              placeholder="Ex: Autoliquidation de TVA — art. 283-2 nonies du CGI"
              className="mt-1"
              data-testid="input-autoliquidation"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              À remplir si vous travaillez en sous-traitance (régime d'autoliquidation).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── Apparence des documents ─── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Palette className="size-4" /> Apparence des documents</CardTitle>
          <CardDescription className="text-xs">Personnalisez les couleurs et la mise en page de vos PDF.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Couleur principale</Label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  className={`size-8 rounded-full transition-all ${docColor === color ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setDocColor(color)}
                />
              ))}
              <div className="flex items-center gap-1.5 ml-2">
                <Input
                  type="color"
                  value={customColor || docColor}
                  onChange={e => { setCustomColor(e.target.value); setDocColor(e.target.value); }}
                  className="h-8 w-10 p-0.5 cursor-pointer"
                />
                <span className="text-xs text-muted-foreground font-mono">{docColor}</span>
              </div>
            </div>
          </div>
          <Separator />
          <div>
            <Label className="mb-2 block">Position du logo</Label>
            <div className="flex gap-3">
              {(["left", "center", "right"] as const).map(align => (
                <button
                  key={align}
                  type="button"
                  onClick={() => setLogoAlign(align)}
                  className={`flex-1 py-3 px-4 rounded-lg border text-xs font-medium text-center transition-all ${
                    logoAlign === align
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted/20 border-border text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {align === "left" ? "⬅ Gauche" : align === "center" ? "↔ Centre" : "➡ Droite"}
                </button>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <Label className="mb-2 block">Style du tableau</Label>
            <div className="flex gap-3">
              {([
                { value: "striped", label: "Alternées", desc: "Lignes de couleur alternées" },
                { value: "bordered", label: "Bordures", desc: "Tableau avec bordures complètes" },
                { value: "minimal", label: "Minimal", desc: "Style épuré sans bordures" },
              ] as const).map(style => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => setTableStyle(style.value)}
                  className={`flex-1 py-3 px-4 rounded-lg border text-center transition-all ${
                    tableStyle === style.value
                      ? "bg-primary/10 border-primary/30"
                      : "bg-muted/20 border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="text-xs font-medium">{style.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{style.desc}</div>
                </button>
              ))}
            </div>
          </div>
          {/* Preview stripe */}
          <div className="p-3 bg-muted/30 rounded-lg flex items-center gap-3">
            <Eye className="size-4 text-muted-foreground" />
            <div className="flex-1 h-2 rounded" style={{ backgroundColor: docColor }} />
            <span className="text-[10px] text-muted-foreground">Couleur d'en-tête et d'accents</span>
          </div>
        </CardContent>
      </Card>

      {/* Factur-X + Legal info cards */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="bg-muted/10">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-2 mb-2"><FileText className="size-4 text-primary" /><span className="text-sm font-medium">Factur-X / E-invoicing</span></div>
            <p className="text-xs text-muted-foreground">PlombPro génère des factures conformes au format Factur-X minimum. La conformité EN16931 est disponible avec l'abonnement BOOSTER.</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/10">
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-2 mb-2"><Shield className="size-4 text-emerald-400" /><span className="text-sm font-medium">Conformité légale</span></div>
            <p className="text-xs text-muted-foreground">Mentions obligatoires : SIRET, TVA intracom., assurance décennale, RCS, pénalités de retard, indemnité forfaitaire 40€.</p>
          </CardContent>
        </Card>
      </div>

      <Button onClick={handleSave} disabled={saveMut.isPending} data-testid="btn-save-invoicing">
        {saveMut.isPending ? "Enregistrement..." : "Enregistrer les paramètres de facturation"}
      </Button>
    </div>
  );
}

// ─── Integrations Panel Component ─────────────────────────────
function IntegrationsPanel() {
  const { toast } = useToast();
  const { data: integrations = [] } = useQuery<any[]>({
    queryKey: ["integration-settings"],
    queryFn: () => db.getIntegrationSettings(),
  });

  const gmailIntegration = integrations.find((i: any) => i.provider === "gmail");
  const whatsappIntegration = integrations.find((i: any) => i.provider === "whatsapp");
  const [connectingGmail, setConnectingGmail] = useState(false);

  // WhatsApp state
  const [waPhone, setWaPhone] = useState("");
  const [waApiKey, setWaApiKey] = useState("");
  const [waInstanceId, setWaInstanceId] = useState("");

  const gmailConnected = gmailIntegration?.status === "connected";
  const waConnected = whatsappIntegration?.status === "connected";

  // Gmail: One-click connect — email feature stubbed
  const handleConnectGmail = async () => {
    toast({ title: "Fonctionnalité email bientôt disponible" });
  };

  // Gmail: Disconnect — email feature stubbed
  const disconnectGmailMut = useMutation({
    mutationFn: async () => {
      if (gmailIntegration) {
        await db.deleteIntegrationSetting(gmailIntegration.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-settings"] });
      toast({ title: "Gmail déconnecté" });
    },
  });

  // WhatsApp: Connect — stubbed as email/messaging feature
  const connectWhatsappMut = useMutation({
    mutationFn: async () => {
      toast({ title: "Fonctionnalité email bientôt disponible" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-settings"] });
    },
  });

  // WhatsApp: Disconnect
  const disconnectWhatsappMut = useMutation({
    mutationFn: async () => {
      if (whatsappIntegration) {
        await db.deleteIntegrationSetting(whatsappIntegration.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-settings"] });
      setWaPhone("");
      setWaApiKey("");
      setWaInstanceId("");
      toast({ title: "WhatsApp déconnecté" });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold mb-1">Intégrations</h2>
        <p className="text-sm text-muted-foreground">
          Connectez vos comptes Gmail et WhatsApp pour envoyer vos devis et factures directement depuis PlombPro.
        </p>
      </div>

      {/* ─── Gmail Card ─── */}
      <Card data-testid="gmail-integration-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Mail className="size-5 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-sm">Gmail</CardTitle>
                <CardDescription className="text-xs">
                  Envoyez vos devis et factures directement depuis votre boîte Gmail
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={gmailConnected ? "text-emerald-400 border-emerald-400/30" : "text-muted-foreground"}
            >
              {gmailConnected ? (
                <><CheckCircle2 className="size-3 mr-1" /> Connecté</>
              ) : (
                <><XCircle className="size-3 mr-1" /> Déconnecté</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {gmailConnected ? (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <div>
                    <div className="text-sm font-medium">{gmailIntegration?.config?.email || gmailIntegration?.gmail_email}</div>
                    <div className="text-xs text-muted-foreground">Connecté le {gmailIntegration?.created_at ? new Date(gmailIntegration.created_at).toLocaleDateString('fr-FR') : '-'}</div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Vos devis et factures seront envoyés depuis cette adresse Gmail. Vous pouvez choisir Gmail comme canal d'envoi depuis la page devis/facture.
              </p>
              <Button variant="outline" size="sm" className="text-xs text-red-400 hover:text-red-500" onClick={() => disconnectGmailMut.mutate()} data-testid="btn-disconnect-gmail">
                <XCircle className="size-3.5 mr-1.5" /> Déconnecter Gmail
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Connectez votre compte Gmail en un clic pour envoyer vos devis et factures depuis votre propre adresse email.
              </p>
              <Button
                size="default"
                className="gap-3 w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm h-11"
                onClick={handleConnectGmail}
                disabled={connectingGmail}
                data-testid="btn-connect-gmail"
              >
                {connectingGmail ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <svg className="size-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                {connectingGmail ? "Connexion en cours..." : "Connecter avec Google"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── WhatsApp AI Assistant Card ─── */}
      <Card data-testid="whatsapp-integration-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <MessageCircle className="size-5 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-sm">WhatsApp — Assistant IA</CardTitle>
                <CardDescription className="text-xs">
                  Gérez votre activité par la voix ou le texte via WhatsApp — devis, factures, paiements, clients
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={waConnected ? "text-emerald-400 border-emerald-400/30" : "text-muted-foreground"}
            >
              {waConnected ? (
                <><CheckCircle2 className="size-3 mr-1" /> Connecté</>
              ) : (
                <><XCircle className="size-3 mr-1" /> Déconnecté</>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {waConnected ? (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <div>
                    <div className="text-sm font-medium">{whatsappIntegration?.config?.phone || whatsappIntegration?.whatsapp_phone}</div>
                    <div className="text-xs text-muted-foreground">WhatsApp lié — Assistant IA actif</div>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-medium mb-2">Ce que vous pouvez faire par WhatsApp :</p>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                  <div>🎤 "Fais-moi un devis pour Dupont"</div>
                  <div>💳 "Quelles factures sont impayées ?"</div>
                  <div>📊 "Montre-moi mon résumé"</div>
                  <div>📅 "RDV demain 14h chez le client"</div>
                  <div>📤 "Envoie le devis DEV-001"</div>
                  <div>💰 "Le client Martin a payé"</div>
                </div>
              </div>
              <Button variant="outline" size="sm" className="text-xs text-red-400 hover:text-red-500" onClick={() => disconnectWhatsappMut.mutate()} data-testid="btn-disconnect-whatsapp">
                <XCircle className="size-3.5 mr-1.5" /> Déconnecter WhatsApp
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                <p className="text-xs text-emerald-200 font-medium mb-1">🤖 Assistant PlombPro sur WhatsApp</p>
                <p className="text-[11px] text-muted-foreground">
                  Liez votre numéro WhatsApp pour piloter votre activité par la voix ou le texte.
                  Créez des devis, envoyez des factures, suivez vos impayés — tout depuis WhatsApp, même sur le chantier.
                </p>
              </div>
              <div>
                <Label>Votre numéro WhatsApp *</Label>
                <Input
                  value={waPhone}
                  onChange={e => setWaPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  data-testid="input-wa-phone"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Le numéro avec lequel vous utiliserez l'assistant WhatsApp</p>
              </div>
              <Button
                size="sm"
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => connectWhatsappMut.mutate()}
                disabled={!waPhone || connectWhatsappMut.isPending}
                data-testid="btn-connect-whatsapp"
              >
                {connectWhatsappMut.isPending ? <RefreshCw className="size-3.5 animate-spin" /> : <MessageCircle className="size-3.5" />}
                Lier mon WhatsApp
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Info Card ─── */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="size-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium mb-1">Sécurité de vos données</div>
              <p className="text-xs text-muted-foreground">
                Vos identifiants sont stockés de manière sécurisée dans votre espace PlombPro.
                Nous n'avons jamais accès à vos emails. Les tokens OAuth sont utilisés uniquement
                pour envoyer les documents que vous choisissez d'envoyer.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

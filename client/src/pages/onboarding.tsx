import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Wrench, Building2, MapPin, Phone, FileText, CreditCard,
  ChevronRight, ChevronLeft, Check, Shield,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

const TRADES = [
  { value: "plomberie", label: "Plomberie", icon: "🔧" },
  { value: "chauffage", label: "Chauffage", icon: "🔥" },
  { value: "plomberie_chauffage", label: "Plomberie & Chauffage", icon: "🔧🔥" },
  { value: "climatisation", label: "Climatisation", icon: "❄️" },
  { value: "sanitaire", label: "Sanitaire", icon: "🚿" },
  { value: "multi_fluides", label: "Multi-fluides", icon: "💧" },
];

const LEGAL_FORMS = [
  "Auto-entrepreneur", "EIRL", "SARL", "SAS", "SASU", "EURL", "SA",
];

interface OnboardingProps {
  onComplete: () => void;
}

export default function OnboardingWizard({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const { toast } = useToast();

  const [data, setData] = useState({
    // Step 0: Trade
    trade: "",
    // Step 1: Company
    name: "", legalForm: "", siret: "", tvaIntracom: "",
    // Step 2: Address
    address: "", city: "", postalCode: "",
    // Step 3: Contact
    phone: "", email: "",
    // Step 4: Certifications
    assuranceDecennale: "", qualifications: "",
    // Step 5: Bank
    iban: "", bic: "", bankName: "",
  });

  const updateMut = useMutation({
    mutationFn: async (payload: any) => apiRequest("PATCH", "/api/company", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
    },
  });

  const totalSteps = 6;

  function next() {
    if (step < totalSteps - 1) setStep(s => s + 1);
    // Save progress
    updateMut.mutate({ ...data, onboardingStep: step + 1 });
  }

  function prev() {
    if (step > 0) setStep(s => s - 1);
  }

  function finish() {
    updateMut.mutate({ ...data, onboardingCompleted: true, onboardingStep: 6 }, {
      onSuccess: () => {
        toast({ title: "Configuration terminée", description: "Choisissez maintenant votre formule." });
        onComplete();
      },
    });
  }

  const steps = [
    {
      title: "Votre métier",
      description: "Quelle est votre spécialité ?",
      icon: <Wrench className="size-6 text-primary" />,
      content: (
        <div className="grid grid-cols-2 gap-3">
          {TRADES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setData(d => ({ ...d, trade: t.value }))}
              className={`p-4 rounded-lg border text-left transition-all ${data.trade === t.value ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
              data-testid={`trade-${t.value}`}
            >
              <span className="text-2xl">{t.icon}</span>
              <div className="text-sm font-medium mt-2">{t.label}</div>
            </button>
          ))}
        </div>
      ),
      valid: !!data.trade,
    },
    {
      title: "Votre entreprise",
      description: "Informations légales de votre société",
      icon: <Building2 className="size-6 text-primary" />,
      content: (
        <div className="space-y-4">
          <div><Label>Raison sociale *</Label><Input value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} placeholder="Ex: Martin Plomberie" data-testid="input-company-name" /></div>
          <div>
            <Label>Forme juridique *</Label>
            <Select value={data.legalForm} onValueChange={v => setData(d => ({ ...d, legalForm: v }))}>
              <SelectTrigger data-testid="select-legal-form"><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>
                {LEGAL_FORMS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>SIRET</Label><Input value={data.siret} onChange={e => setData(d => ({ ...d, siret: e.target.value }))} placeholder="XXX XXX XXX XXXXX" /></div>
            <div><Label>N° TVA intracom.</Label><Input value={data.tvaIntracom} onChange={e => setData(d => ({ ...d, tvaIntracom: e.target.value }))} placeholder="FRXXXXXXXXX" /></div>
          </div>
        </div>
      ),
      valid: !!data.name && !!data.legalForm,
    },
    {
      title: "Adresse",
      description: "Adresse du siège social",
      icon: <MapPin className="size-6 text-primary" />,
      content: (
        <div className="space-y-4">
          <div><Label>Adresse</Label><Input value={data.address} onChange={e => setData(d => ({ ...d, address: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Ville *</Label><Input value={data.city} onChange={e => setData(d => ({ ...d, city: e.target.value }))} /></div>
            <div><Label>Code postal *</Label><Input value={data.postalCode} onChange={e => setData(d => ({ ...d, postalCode: e.target.value }))} /></div>
          </div>
        </div>
      ),
      valid: !!data.city && !!data.postalCode,
    },
    {
      title: "Contact",
      description: "Comment vous joindre",
      icon: <Phone className="size-6 text-primary" />,
      content: (
        <div className="space-y-4">
          <div><Label>Téléphone *</Label><Input value={data.phone} onChange={e => setData(d => ({ ...d, phone: e.target.value }))} placeholder="06 XX XX XX XX" /></div>
          <div><Label>Email *</Label><Input type="email" value={data.email} onChange={e => setData(d => ({ ...d, email: e.target.value }))} placeholder="contact@entreprise.fr" /></div>
        </div>
      ),
      valid: !!data.phone && !!data.email,
    },
    {
      title: "Certifications",
      description: "Vos assurances et qualifications",
      icon: <Shield className="size-6 text-primary" />,
      content: (
        <div className="space-y-4">
          <div><Label>Assurance décennale</Label><Input value={data.assuranceDecennale} onChange={e => setData(d => ({ ...d, assuranceDecennale: e.target.value }))} placeholder="Ex: AXA N° 12345" /></div>
          <div><Label>Qualifications / Labels</Label><Input value={data.qualifications} onChange={e => setData(d => ({ ...d, qualifications: e.target.value }))} placeholder="Ex: RGE QualiPAC, Qualibat" /></div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">Ces informations seront automatiquement ajoutées à vos devis et factures comme mentions obligatoires.</p>
          </div>
        </div>
      ),
      valid: true,
    },
    {
      title: "Coordonnées bancaires",
      description: "Pour vos RIB sur factures",
      icon: <CreditCard className="size-6 text-primary" />,
      content: (
        <div className="space-y-4">
          <div><Label>IBAN</Label><Input value={data.iban} onChange={e => setData(d => ({ ...d, iban: e.target.value }))} placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>BIC</Label><Input value={data.bic} onChange={e => setData(d => ({ ...d, bic: e.target.value }))} /></div>
            <div><Label>Banque</Label><Input value={data.bankName} onChange={e => setData(d => ({ ...d, bankName: e.target.value }))} /></div>
          </div>
        </div>
      ),
      valid: true,
    },

  ];

  const current = steps[step];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>Étape {step + 1} sur {totalSteps}</span>
            <span>{Math.round(((step + 1) / totalSteps) * 100)}%</span>
          </div>
          <Progress value={((step + 1) / totalSteps) * 100} className="h-1.5" />
        </div>

        <Card>
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-2">{current.icon}</div>
            <CardTitle className="text-lg">{current.title}</CardTitle>
            <CardDescription className="text-sm">{current.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {current.content}

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <Button variant="ghost" onClick={prev} disabled={step === 0} className="gap-1">
                <ChevronLeft className="size-4" /> Retour
              </Button>
              {step < totalSteps - 1 ? (
                <Button onClick={next} disabled={!current.valid} className="gap-1" data-testid="btn-next-step">
                  Suivant <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button onClick={finish} disabled={updateMut.isPending} className="gap-1" data-testid="btn-finish-onboarding">
                  <Check className="size-4" /> {updateMut.isPending ? "Configuration..." : "Commencer"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Skip option */}
        {step < totalSteps - 1 && (
          <div className="text-center mt-3">
            <button
              type="button"
              onClick={() => setStep(totalSteps - 1)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Passer la configuration →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

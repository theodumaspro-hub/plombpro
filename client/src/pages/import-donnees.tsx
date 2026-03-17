import { useState, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { db } from "@/lib/supabaseData";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, ArrowLeft, ArrowRight, Loader2, Users, Package, Download, Sparkles, Table, Eye } from "lucide-react";

type ImportType = "contacts" | "articles" | null;

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

const IMPORT_TYPES = [
  {
    id: "contacts" as const,
    name: "Contacts",
    description: "Importez vos clients, fournisseurs et sous-traitants",
    icon: Users,
    color: "border-blue-500/30 bg-blue-500/5",
    iconColor: "text-blue-400",
    headers: ["Nom", "Prénom", "Société", "Email", "Téléphone", "Adresse", "Ville", "Code postal", "SIRET", "Type"],
    templateCsv: "Nom;Prénom;Société;Email;Téléphone;Adresse;Ville;Code postal;SIRET;Type\nDupont;Jean;Dupont SARL;jean@dupont.fr;06 12 34 56 78;12 rue des Lilas;Paris;75011;12345678901234;client\nMartin;Sophie;;sophie.martin@email.com;06 98 76 54 32;5 av de la République;Lyon;69003;;client",
    templateFilename: "modele_import_contacts.csv",
  },
  {
    id: "articles" as const,
    name: "Articles / Bibliothèque",
    description: "Importez votre catalogue de fournitures et prestations",
    icon: Package,
    color: "border-emerald-500/30 bg-emerald-500/5",
    iconColor: "text-emerald-400",
    headers: ["Référence", "Désignation", "Unité", "Prix achat HT", "Prix vente HT", "TVA", "Famille", "Type"],
    templateCsv: "Référence;Désignation;Unité;Prix achat HT;Prix vente HT;TVA;Famille;Type\nPLB-001;Robinet mitigeur chromé;u;25,00;45,00;10;Robinetterie;fourniture\nPLB-002;Joint torique Ø15;u;0,50;3,50;10;Joints;fourniture\nMO-001;Main d'œuvre plombier;h;0;45,00;10;Main d'œuvre;main_oeuvre",
    templateFilename: "modele_import_articles.csv",
  },
] as const;

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: "Type d'import" },
    { num: 2, label: "Fichier CSV" },
    { num: 3, label: "Aperçu & Import" },
  ];

  return (
    <div className="flex items-center justify-center mb-6">
      {steps.map((step, i) => (
        <div key={step.num} className="flex items-center">
          <div className="flex items-center gap-2">
            <div
              className={`size-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                currentStep >= step.num
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {currentStep > step.num ? (
                <CheckCircle2 className="size-4" />
              ) : (
                step.num
              )}
            </div>
            <span className={`text-xs font-medium ${currentStep >= step.num ? "text-foreground" : "text-muted-foreground"}`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-16 h-px mx-3 ${currentStep > step.num ? "bg-primary" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function parseCSVPreview(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const sep = lines[0].includes(";") ? ";" : ",";

  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { current += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === sep) { fields.push(current.trim()); current = ""; }
        else { current += ch; }
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(l => parseLine(l));
  return { headers, rows };
}

export default function ImportDonneesPage() {
  const [step, setStep] = useState(1);
  const [importType, setImportType] = useState<ImportType>(null);
  const [csvText, setCsvText] = useState("");
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const importMut = useMutation({
    mutationFn: async () => {
      // Parse CSV and import directly via Supabase
      const parsed = parseCSVPreview(csvText);
      if (importType === "contacts") {
        const rows = parsed.rows.map(row => ({
          last_name: row[0] || null,
          first_name: row[1] || null,
          company: row[2] || null,
          email: row[3] || null,
          phone: row[4] || null,
          address: row[5] || null,
          city: row[6] || null,
          postal_code: row[7] || null,
          siret: row[8] || null,
          type: row[9] || "client",
        }));
        return db.importContacts(rows);
      } else {
        const rows = parsed.rows.map(row => ({
          reference: row[0] || null,
          designation: row[1] || "Article importé",
          unit: row[2] || "u",
          purchase_price_ht: row[3]?.replace(",", ".") || null,
          selling_price_ht: row[4]?.replace(",", ".") || "0",
          tva_rate: row[5]?.replace(",", ".") || "10",
          family: row[6] || null,
          type: row[7] || "fourniture",
        }));
        return db.importArticles(rows);
      }
    },
    onSuccess: (data) => {
      setImportResult(data);
      if (importType === "contacts") {
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["library-items"] });
      }
      toast({
        title: `Import terminé — ${data.imported} ${importType === "contacts" ? "contacts" : "articles"} importés`,
      });
    },
    onError: () => {
      toast({ title: "Erreur lors de l'import", variant: "destructive" });
    },
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      const parsed = parseCSVPreview(text);
      setParsedData(parsed);
      setStep(3);
    };
    reader.readAsText(file, "utf-8");
  }

  function handleDownloadTemplate() {
    const typeInfo = IMPORT_TYPES.find(t => t.id === importType);
    if (!typeInfo) return;
    const blob = new Blob(["\uFEFF" + typeInfo.templateCsv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = typeInfo.templateFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleReset() {
    setStep(1);
    setImportType(null);
    setCsvText("");
    setParsedData(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const typeInfo = IMPORT_TYPES.find(t => t.id === importType);

  return (
    <AppLayout title="Import de données">
      {/* CSV highlight banner */}
      <div className="rounded-lg bg-gradient-to-r from-primary/15 via-amber-500/10 to-transparent border border-primary/20 p-4 mb-5 flex items-center gap-3">
        <Sparkles className="size-5 text-primary shrink-0" />
        <div>
          <span className="text-sm font-semibold">Import CSV</span>
          <span className="text-xs text-muted-foreground ml-2">
            Importez vos contacts et articles depuis un fichier CSV (séparateur virgule ou point-virgule). Téléchargez le modèle pour le bon format.
          </span>
        </div>
      </div>

      <StepIndicator currentStep={importResult ? 4 : step} />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* ═══════════════ Step 1: Import Type Selection ═══════════════ */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="text-center mb-4">
            <h2 className="text-base font-semibold">Que souhaitez-vous importer ?</h2>
            <p className="text-xs text-muted-foreground mt-1">Choisissez le type de données à importer depuis un fichier CSV</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {IMPORT_TYPES.map(t => {
              const Icon = t.icon;
              const isSelected = importType === t.id;
              return (
                <Card
                  key={t.id}
                  className={`cursor-pointer transition-all hover:border-primary/40 ${t.color} ${
                    isSelected ? "ring-2 ring-primary border-primary/50" : ""
                  }`}
                  onClick={() => setImportType(t.id)}
                >
                  <CardContent className="py-6 px-4 text-center space-y-3">
                    <Icon className={`size-10 mx-auto ${t.iconColor}`} />
                    <div>
                      <h3 className="text-sm font-bold">{t.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                    </div>
                    {isSelected && (
                      <Badge className="bg-primary text-primary-foreground text-[10px]">
                        <CheckCircle2 className="size-3 mr-1" /> Sélectionné
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-center mt-6">
            <Button
              size="sm"
              className="gap-2 h-8 text-xs"
              disabled={!importType}
              onClick={() => setStep(2)}
            >
              Continuer <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════ Step 2: File Upload ═══════════════ */}
      {step === 2 && typeInfo && (
        <div className="space-y-4 max-w-2xl mx-auto">
          <div className="text-center mb-4">
            <h2 className="text-base font-semibold">Import {typeInfo.name}</h2>
            <p className="text-xs text-muted-foreground mt-1">Déposez votre fichier CSV ou téléchargez le modèle</p>
          </div>

          {/* Template download */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-4 text-primary" />
                <div>
                  <span className="text-xs font-semibold">Modèle CSV</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    Téléchargez le modèle pour préparer vos données
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs" onClick={handleDownloadTemplate}>
                <Download className="size-3" /> Télécharger
              </Button>
            </CardContent>
          </Card>

          {/* Expected columns info */}
          <Card>
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-2 mb-2">
                <Table className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold">Colonnes attendues</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {typeInfo.headers.map(h => (
                  <Badge key={h} variant="outline" className="text-[10px] bg-muted/50">
                    {h}
                  </Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Séparateur : point-virgule (;) ou virgule (,). Les colonnes manquantes seront ignorées.
              </p>
            </CardContent>
          </Card>

          {/* Drop zone */}
          <Card
            className="border-dashed border-2 hover:border-primary/40 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="py-10 px-4 text-center">
              <Upload className="size-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-2">
                Cliquez ou glissez-déposez votre fichier CSV ici
              </p>
              <p className="text-xs text-muted-foreground/60">
                Format accepté : .csv (UTF-8, séparateur ; ou ,)
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8 text-xs"
              onClick={() => { setStep(1); setCsvText(""); setParsedData(null); }}
            >
              <ArrowLeft className="size-3.5" /> Retour
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════ Step 3: Preview & Import ═══════════════ */}
      {step === 3 && !importResult && parsedData && typeInfo && (
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="text-center mb-4">
            <h2 className="text-base font-semibold">Aperçu — {parsedData.rows.length} lignes détectées</h2>
            <p className="text-xs text-muted-foreground mt-1">Vérifiez les données avant de lancer l'import</p>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-4">
            <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3">
              <Eye className="size-3" /> {parsedData.headers.length} colonnes
            </Badge>
            <Badge variant="outline" className="text-xs gap-1.5 py-1 px-3">
              <Table className="size-3" /> {parsedData.rows.length} lignes
            </Badge>
          </div>

          {/* Preview table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 sticky top-0">
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                      {parsedData.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.rows.slice(0, 50).map((row, ri) => (
                      <tr key={ri} className={ri % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                        <td className="px-3 py-1.5 text-muted-foreground">{ri + 1}</td>
                        {parsedData.headers.map((_, ci) => (
                          <td key={ci} className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate">
                            {row[ci] || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedData.rows.length > 50 && (
                  <div className="text-center py-2 text-xs text-muted-foreground bg-muted/30">
                    ... et {parsedData.rows.length - 50} lignes supplémentaires
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8 text-xs"
              onClick={() => { setStep(2); setParsedData(null); setCsvText(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
            >
              <ArrowLeft className="size-3.5" /> Retour
            </Button>
            <Button
              size="sm"
              className="gap-2 h-8 text-xs"
              onClick={() => importMut.mutate()}
              disabled={importMut.isPending || parsedData.rows.length === 0}
            >
              {importMut.isPending ? (
                <><Loader2 className="size-3.5 animate-spin" /> Import en cours...</>
              ) : (
                <>Importer {parsedData.rows.length} {importType === "contacts" ? "contacts" : "articles"} <ArrowRight className="size-3.5" /></>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════ Import Success ═══════════════ */}
      {importResult && (
        <div className="max-w-lg mx-auto text-center space-y-4">
          <div className="py-6">
            <div className="size-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="size-8 text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold">Import terminé</h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="py-3 px-4 text-center">
                <div className="text-lg font-bold text-emerald-400">{importResult.imported}</div>
                <div className="text-xs text-muted-foreground">Importés</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 text-center">
                <div className="text-lg font-bold text-amber-400">{importResult.skipped}</div>
                <div className="text-xs text-muted-foreground">Ignorés</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 text-center">
                <div className="text-lg font-bold text-red-400">{importResult.errors.length}</div>
                <div className="text-xs text-muted-foreground">Erreurs</div>
              </CardContent>
            </Card>
          </div>

          {importResult.errors.length > 0 && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardContent className="py-3 px-4 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="size-4 text-red-400" />
                  <span className="text-sm font-medium text-red-400">Erreurs ({importResult.errors.length})</span>
                </div>
                <ul className="space-y-1 max-h-32 overflow-y-auto">
                  {importResult.errors.slice(0, 20).map((e, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-red-400 mt-0.5">•</span> {e}
                    </li>
                  ))}
                  {importResult.errors.length > 20 && (
                    <li className="text-xs text-muted-foreground">... et {importResult.errors.length - 20} autres erreurs</li>
                  )}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8 text-xs"
              onClick={handleReset}
            >
              Nouvel import
            </Button>
            <Button
              size="sm"
              className="gap-2 h-8 text-xs"
              onClick={() => { window.location.hash = "#/"; }}
            >
              Retour au tableau de bord
            </Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

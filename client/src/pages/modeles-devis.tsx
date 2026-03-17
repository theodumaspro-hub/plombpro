import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { db } from "@/lib/supabaseData";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import {
  Wrench, Flame, Zap, Wind, Bath,
  FileText, Eye, Sparkles, Loader2,
} from "lucide-react";

interface TemplateLineItem {
  designation: string;
  quantity: number;
  unit: string;
  unit_price_ht: number;
  tva_rate: number;
  line_type: string;
  isTitle?: boolean;
}

interface DevisTemplate {
  id: string;
  name: string;
  description: string;
  trade: string;
  category: string;
  lines: TemplateLineItem[];
}

interface TradeInfo {
  label: string;
  icon: string;
  color: string;
}

const TRADE_ICONS: Record<string, React.ReactNode> = {
  Wrench: <Wrench className="size-4" />,
  Flame: <Flame className="size-4" />,
  Zap: <Zap className="size-4" />,
  Wind: <Wind className="size-4" />,
  Bath: <Bath className="size-4" />,
};

const TRADE_COLORS: Record<string, string> = {
  plomberie: "bg-blue-500/15 text-blue-400",
  chauffage: "bg-red-500/15 text-red-400",
  electricite: "bg-amber-500/15 text-amber-400",
  climatisation: "bg-cyan-500/15 text-cyan-400",
  salle_de_bain: "bg-violet-500/15 text-violet-400",
};

function calcTemplateTotal(lines: TemplateLineItem[]): number {
  return lines
    .filter(l => !l.isTitle)
    .reduce((sum, l) => sum + l.quantity * l.unit_price_ht, 0);
}

export default function ModelesDevisPage() {
  const [trade, setTrade] = useState("all");
  const [preview, setPreview] = useState<DevisTemplate | null>(null);
  const { toast } = useToast();

  const { data } = useQuery<{ templates: DevisTemplate[]; trades: Record<string, TradeInfo> }>({
    queryKey: ["devis-templates"],
    queryFn: async () => {
      // Templates are now static/client-side since they were server-generated
      return { templates: [], trades: {} };
    },
  });

  const templates = data?.templates || [];
  const trades = data?.trades || {};

  const createQuoteMut = useMutation({
    mutationFn: async (template: DevisTemplate) => {
      const dataLines = template.lines.filter(l => !l.isTitle);
      const totalHT = dataLines.reduce((s, l) => s + l.quantity * l.unit_price_ht, 0);
      const totalTVA = dataLines.reduce((s, l) => {
        const ht = l.quantity * l.unit_price_ht;
        return s + ht * l.tva_rate / 100;
      }, 0);
      return db.createQuote({
        contact_id: null,
        chantier_id: null,
        number: `DEV-${Date.now().toString(36).toUpperCase()}`,
        status: "brouillon",
        title: template.name,
        description: template.description,
        amount_ht: totalHT.toFixed(2),
        amount_tva: totalTVA.toFixed(2),
        amount_ttc: (totalHT + totalTVA).toFixed(2),
        valid_until: null,
        notes: `Créé depuis le modèle "${template.name}"`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      setPreview(null);
      toast({ title: "Devis créé", description: "Le devis a été ajouté en brouillon." });
    },
  });

  const filtered = trade === "all"
    ? templates
    : templates.filter(t => t.trade === trade);

  return (
    <AppLayout title="Modèles de devis">
      {/* Hero */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Sparkles className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">{templates.length}+ modèles de devis métiers</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Gagnez du temps avec nos modèles pré-remplis pour vos devis plomberie, chauffage, électricité, climatisation et salle de bain.
        </p>
      </div>

      {/* Trade tabs */}
      <Tabs value={trade} onValueChange={setTrade} className="mb-4">
        <TabsList className="h-8 flex-wrap">
          <TabsTrigger value="all" className="text-xs h-7">
            Tous
          </TabsTrigger>
          {Object.entries(trades).map(([key, info]) => (
            <TabsTrigger key={key} value={key} className="text-xs h-7 gap-1.5">
              {TRADE_ICONS[info.icon]}
              {info.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Template grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(tpl => {
          const totalHT = calcTemplateTotal(tpl.lines);
          const tradeInfo = trades[tpl.trade];
          const lineCount = tpl.lines.filter(l => !l.isTitle).length;
          return (
            <Card key={tpl.id} className="hover:bg-muted/20 transition-colors group">
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={`text-[10px] border-0 gap-1 ${TRADE_COLORS[tpl.trade] || "bg-muted text-muted-foreground"}`}>
                      {tradeInfo && TRADE_ICONS[tradeInfo.icon]}
                      {tradeInfo?.label || tpl.trade}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-0 bg-muted/50 text-muted-foreground">
                      {tpl.category}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{lineCount} lignes</span>
                </div>
                <h3 className="text-sm font-medium mb-1">{tpl.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{tpl.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold tabular-nums lining-nums">{formatCurrency(totalHT)} HT</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-7 text-xs"
                    onClick={() => setPreview(tpl)}
                  >
                    <Eye className="size-3" /> Utiliser
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="md:col-span-3">
            <CardContent className="py-8 text-center text-muted-foreground">Aucun modèle dans cette catégorie</CardContent>
          </Card>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {preview && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={`text-[10px] border-0 gap-1 ${TRADE_COLORS[preview.trade] || "bg-muted text-muted-foreground"}`}>
                    {trades[preview.trade] && TRADE_ICONS[trades[preview.trade].icon]}
                    {trades[preview.trade]?.label || preview.trade}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-0 bg-muted/50 text-muted-foreground">
                    {preview.category}
                  </Badge>
                </div>
                <DialogTitle>{preview.name}</DialogTitle>
                <p className="text-sm text-muted-foreground">{preview.description}</p>
              </DialogHeader>

              {/* Lines table */}
              <div className="mt-4">
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="py-2.5 px-4 font-medium">Désignation</th>
                          <th className="py-2.5 px-4 font-medium text-right">Qté</th>
                          <th className="py-2.5 px-4 font-medium">Unité</th>
                          <th className="py-2.5 px-4 font-medium text-right">P.U. HT</th>
                          <th className="py-2.5 px-4 font-medium text-right">Total HT</th>
                          <th className="py-2.5 px-4 font-medium text-right">TVA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.lines.map((line, i) => {
                          if (line.isTitle) {
                            return (
                              <tr key={i} className="bg-muted/30">
                                <td colSpan={6} className="py-2 px-4 text-xs font-bold text-foreground">
                                  {line.designation}
                                </td>
                              </tr>
                            );
                          }
                          const lineTotal = line.quantity * line.unit_price_ht;
                          return (
                            <tr key={i} className="border-b border-border/50">
                              <td className="py-2 px-4 text-sm">{line.designation}</td>
                              <td className="py-2 px-4 text-right text-sm tabular-nums">{line.quantity}</td>
                              <td className="py-2 px-4 text-xs text-muted-foreground">{line.unit}</td>
                              <td className="py-2 px-4 text-right text-sm tabular-nums">{formatCurrency(line.unit_price_ht)}</td>
                              <td className="py-2 px-4 text-right text-sm font-medium tabular-nums">{formatCurrency(lineTotal)}</td>
                              <td className="py-2 px-4 text-right text-xs text-muted-foreground tabular-nums">{line.tva_rate}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-border">
                          <td colSpan={4} className="py-2.5 px-4 text-sm font-medium">Total HT</td>
                          <td className="py-2.5 px-4 text-right text-sm font-semibold tabular-nums">
                            {formatCurrency(calcTemplateTotal(preview.lines))}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              </div>

              <DialogFooter className="mt-4">
                <Button type="button" variant="secondary" onClick={() => setPreview(null)}>Fermer</Button>
                <Button
                  className="gap-2"
                  onClick={() => createQuoteMut.mutate(preview)}
                  disabled={createQuoteMut.isPending}
                >
                  {createQuoteMut.isPending ? (
                    <><Loader2 className="size-3.5 animate-spin" /> Création...</>
                  ) : (
                    <><FileText className="size-3.5" /> Créer le devis</>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

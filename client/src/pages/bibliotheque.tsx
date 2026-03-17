import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Package, Wrench, User, Layers, Users, Truck, MoreHorizontal, FolderTree, Trash2, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LibraryItem } from "@shared/schema";

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  fourniture: { label: "Fourniture", icon: Package, color: "#3B82F6" },
  ouvrage: { label: "Ouvrage", icon: Layers, color: "#8B5CF6" },
  main_oeuvre: { label: "Main d'œuvre", icon: User, color: "#F59E0B" },
  sous_traitance: { label: "Sous-traitance", icon: Users, color: "#EC4899" },
  materiel: { label: "Matériel", icon: Truck, color: "#10B981" },
  divers: { label: "Divers", icon: MoreHorizontal, color: "#6B7280" },
};

const UNITS = [
  "u", "h", "j", "m", "m²", "m³", "ml", "l", "g", "kg", "t",
  "forfait", "ens", "lot", "pce", "roul", "sac", "bte", "pal",
  "cm", "mm", "km", "cl", "dl", "hl", "pair", "pl",
];

export default function BibliothequePage() {
  const [location, setLocation] = useLocation();
  const shouldAutoOpen = typeof window !== 'undefined' && window.location.hash === '#/bibliotheque/nouveau';
  const [open, setOpen] = useState(shouldAutoOpen);

  useEffect(() => {
    if (shouldAutoOpen) {
      setLocation("/bibliotheque", { replace: true });
    }
  }, []);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [manageFamiliesOpen, setManageFamiliesOpen] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");
  const { toast } = useToast();

  const { data: items = [] } = useQuery<LibraryItem[]>({ queryKey: ["/api/library"] });

  // Inline creation form
  const [form, setForm] = useState({
    type: "fourniture", family: "", subFamily: "", reference: "",
    designation: "", description: "", unit: "u",
    purchasePriceHT: "", sellingPriceHT: "", tvaRate: "20",
  });

  // Auto-calculated margin for creation form
  const formPurchase = parseFloat(form.purchasePriceHT) || 0;
  const formSelling = parseFloat(form.sellingPriceHT) || 0;
  const formCoeff = formPurchase > 0 ? (formSelling / formPurchase).toFixed(2) : "—";
  const formMargin = formPurchase > 0 ? (((formSelling - formPurchase) / formPurchase) * 100).toFixed(1) : "—";

  const createMut = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/library", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      setOpen(false);
      toast({ title: "Article ajouté" });
      setForm({ type: "fourniture", family: "", subFamily: "", reference: "", designation: "", description: "", unit: "u", purchasePriceHT: "", sellingPriceHT: "", tvaRate: "20" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/library/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/library"] });
      toast({ title: "Article supprimé" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const purchase = parseFloat(form.purchasePriceHT) || 0;
    const selling = parseFloat(form.sellingPriceHT) || 0;
    const marginPct = purchase > 0 ? ((selling - purchase) / purchase * 100).toFixed(1) : null;
    createMut.mutate({
      ...form,
      purchasePriceHT: form.purchasePriceHT || null,
      sellingPriceHT: form.sellingPriceHT || "0",
      marginPercent: marginPct,
      subFamily: form.subFamily || null,
      reference: form.reference || null,
      description: form.description || null,
    });
  }

  // Families extraction
  const families = useMemo(() => {
    const fams = new Map<string, number>();
    for (const item of items) {
      if (item.family) {
        fams.set(item.family, (fams.get(item.family) || 0) + 1);
      }
    }
    return Array.from(fams.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  // Type counts
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item.type] = (counts[item.type] || 0) + 1;
    }
    return counts;
  }, [items]);

  const filtered = items.filter(i => {
    if (tab !== "all" && i.type !== tab) return false;
    if (familyFilter !== "all" && i.family !== familyFilter) return false;
    if (search) {
      const term = search.toLowerCase();
      return i.designation.toLowerCase().includes(term) || (i.reference || "").toLowerCase().includes(term) || (i.family || "").toLowerCase().includes(term);
    }
    return true;
  });

  return (
    <AppLayout
      title="Bibliothèque"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => setManageFamiliesOpen(true)} data-testid="btn-manage-families">
            <FolderTree className="size-3.5" /> Familles
          </Button>
          <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setOpen(true)} data-testid="btn-new-library-item">
            <Plus className="size-3.5" /> Nouvel article
          </Button>
        </div>
      }
    >
      {/* Type tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="h-8 flex-wrap">
          <TabsTrigger value="all" className="text-xs h-7">Tous ({items.length})</TabsTrigger>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
            const count = typeCounts[key] || 0;
            if (count === 0 && key !== "fourniture" && key !== "ouvrage" && key !== "main_oeuvre") return null;
            const Icon = cfg.icon;
            return (
              <TabsTrigger key={key} value={key} className="text-xs h-7 gap-1">
                <Icon className="size-3" /> {cfg.label} {count > 0 && `(${count})`}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Search + Family filter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher un article..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={familyFilter} onValueChange={setFamilyFilter}>
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue placeholder="Toutes les familles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les familles</SelectItem>
            {families.map(([fam, count]) => (
              <SelectItem key={fam} value={fam}>{fam} ({count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2.5 px-4 font-medium">Réf.</th>
                <th className="py-2.5 px-4 font-medium">Type</th>
                <th className="py-2.5 px-4 font-medium">Désignation</th>
                <th className="py-2.5 px-4 font-medium">Famille</th>
                <th className="py-2.5 px-4 font-medium">Unité</th>
                <th className="py-2.5 px-4 font-medium text-right">Achat HT</th>
                <th className="py-2.5 px-4 font-medium text-right">Vente HT</th>
                <th className="py-2.5 px-4 font-medium text-right">Coeff.</th>
                <th className="py-2.5 px-4 font-medium text-right">Marge</th>
                <th className="py-2.5 px-4 font-medium">TVA</th>
                <th className="py-2.5 px-4 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.divers;
                const Icon = cfg.icon;
                const purchase = parseFloat(item.purchasePriceHT || "0");
                const selling = parseFloat(item.sellingPriceHT || "0");
                const coeff = purchase > 0 ? (selling / purchase).toFixed(2) : "—";
                return (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`library-row-${item.id}`}>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground font-mono">{item.reference || "—"}</td>
                    <td className="py-2.5 px-4">
                      <Badge variant="outline" className="text-[10px] font-normal gap-1" style={{ borderColor: `${cfg.color}40`, color: cfg.color }}>
                        <Icon className="size-3" /> {cfg.label}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium">{item.designation}</div>
                      {item.description && <div className="text-xs text-muted-foreground truncate max-w-[250px]">{item.description}</div>}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{item.family}{item.subFamily ? ` / ${item.subFamily}` : ""}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">{item.unit}</td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground">{item.purchasePriceHT ? formatCurrency(item.purchasePriceHT) : "—"}</td>
                    <td className="py-2.5 px-4 text-right font-medium">{formatCurrency(item.sellingPriceHT)}</td>
                    <td className="py-2.5 px-4 text-right text-muted-foreground text-xs">{coeff}</td>
                    <td className="py-2.5 px-4 text-right">
                      {item.marginPercent ? (
                        <span className={parseFloat(item.marginPercent) >= 40 ? "text-emerald-400" : parseFloat(item.marginPercent) >= 20 ? "text-amber-400" : "text-red-400"}>
                          {parseFloat(item.marginPercent).toFixed(0)}%
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">{item.tvaRate}%</td>
                    <td className="py-2.5 px-4">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                        onClick={() => deleteMut.mutate(item.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={11} className="py-8 text-center text-muted-foreground">Aucun article trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvel article</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Référence</Label><Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} /></div>
            </div>
            <div><Label>Désignation *</Label><Input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} required /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Famille</Label>
                <div className="flex gap-1.5">
                  <Select value={form.family || "__custom__"} onValueChange={v => { if (v !== "__custom__") setForm(f => ({ ...f, family: v })); }}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__custom__">Personnalisée...</SelectItem>
                      {families.map(([fam]) => (
                        <SelectItem key={fam} value={fam}>{fam}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {(!form.family || !families.some(([f]) => f === form.family)) && (
                  <Input className="mt-1" value={form.family} onChange={e => setForm(f => ({ ...f, family: e.target.value }))} placeholder="Ex: Sanitaire" />
                )}
              </div>
              <div><Label>Sous-famille</Label><Input value={form.subFamily} onChange={e => setForm(f => ({ ...f, subFamily: e.target.value }))} placeholder="Ex: Robinetterie" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Unité</Label>
                <Select value={form.unit} onValueChange={v => setForm(f => ({ ...f, unit: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Prix achat HT</Label><Input type="number" step="0.01" value={form.purchasePriceHT} onChange={e => setForm(f => ({ ...f, purchasePriceHT: e.target.value }))} /></div>
              <div><Label>Prix vente HT *</Label><Input type="number" step="0.01" value={form.sellingPriceHT} onChange={e => setForm(f => ({ ...f, sellingPriceHT: e.target.value }))} required /></div>
            </div>
            {/* Auto-calc margin preview */}
            {formPurchase > 0 && formSelling > 0 && (
              <div className="p-3 bg-muted/30 rounded-lg flex gap-6 text-xs">
                <div><span className="text-muted-foreground">Coeff. :</span> <span className="font-medium">{formCoeff}</span></div>
                <div><span className="text-muted-foreground">Marge :</span> <span className={`font-medium ${parseFloat(formMargin) >= 40 ? "text-emerald-400" : parseFloat(formMargin) >= 20 ? "text-amber-400" : "text-red-400"}`}>{formMargin}%</span></div>
              </div>
            )}
            <div>
              <Label>TVA (%)</Label>
              <Select value={form.tvaRate} onValueChange={v => setForm(f => ({ ...f, tvaRate: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20%</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="5.5">5,5%</SelectItem>
                  <SelectItem value="0">0%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMut.isPending} data-testid="btn-submit-library">
                {createMut.isPending ? "Ajout..." : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Manage Families Dialog */}
      <Dialog open={manageFamiliesOpen} onOpenChange={setManageFamiliesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gérer les familles</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {families.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {families.map(([fam, count]) => (
                  <div key={fam} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-2">
                      <FolderTree className="size-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{fam}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{count} article{count > 1 ? "s" : ""}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune famille créée. Ajoutez une famille en créant un article.</p>
            )}
            <div className="pt-3 border-t border-border">
              <Label className="text-xs">Ajouter un article avec une nouvelle famille</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Les familles sont créées automatiquement lors de l'ajout d'articles. Utilisez le bouton "Nouvel article" pour ajouter une nouvelle famille.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setManageFamiliesOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

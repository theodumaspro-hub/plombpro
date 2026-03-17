import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { db } from "@/lib/supabaseData";
import { formatCurrency, formatDate, contactName } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MoreHorizontal, PackageCheck, Truck } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function AchatsPage() {
  const [location, setLocation] = useLocation();
  const shouldAutoOpen = typeof window !== 'undefined' && window.location.hash === '#/achats/nouveau';
  const [open, setOpen] = useState(shouldAutoOpen);

  useEffect(() => {
    if (shouldAutoOpen) {
      setLocation("/achats", { replace: true });
    }
  }, []);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: purchases = [] } = useQuery<any[]>({ queryKey: ["purchases"], queryFn: () => db.getPurchases() });
  const { data: contacts = [] } = useQuery<any[]>({ queryKey: ["contacts"], queryFn: () => db.getContacts() });
  const { data: chantiers = [] } = useQuery<any[]>({ queryKey: ["chantiers"], queryFn: () => db.getChantiers() });
  const contactMap = new Map(contacts.map(c => [c.id, c]));
  const chantierMap = new Map(chantiers.map(c => [c.id, c]));
  const suppliers = contacts.filter(c => c.type === "fournisseur");

  const [form, setForm] = useState({ supplierId: "", chantierId: "", amountHT: "", tvaRate: "20", orderDate: "", notes: "" });

  const createMut = useMutation({
    mutationFn: async (data: any) => db.createPurchase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      setOpen(false);
      toast({ title: "Commande créée" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => db.updatePurchase(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast({ title: "Commande mise à jour" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ht = parseFloat(form.amountHT) || 0;
    const tva = ht * (parseFloat(form.tvaRate) / 100);
    const num = `ACH-2026-${String(purchases.length + 1).padStart(3, "0")}`;
    createMut.mutate({
      supplier_id: Number(form.supplierId),
      chantier_id: form.chantierId ? Number(form.chantierId) : null,
      number: num,
      status: "brouillon",
      amount_ht: String(ht),
      amount_tva: String(tva.toFixed(2)),
      amount_ttc: String((ht + tva).toFixed(2)),
      order_date: form.orderDate || null,
      notes: form.notes || null,
    });
  }

  const filtered = purchases.filter(p => {
    if (search) {
      const s = contactMap.get(p.supplier_id);
      const term = search.toLowerCase();
      return p.number.toLowerCase().includes(term) || (s ? contactName(s) : "").toLowerCase().includes(term);
    }
    return true;
  });

  const totalHT = purchases.filter(p => p.status !== "annulé").reduce((s, p) => s + parseFloat(p.amount_ht || "0"), 0);

  return (
    <AppLayout
      title="Achats"
      actions={
        <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setOpen(true)} data-testid="btn-new-purchase">
          <Plus className="size-3.5" /> Nouvelle commande
        </Button>
      }
    >
      <div className="flex items-center gap-4 mb-4">
        <Card className="flex-1"><CardContent className="py-3 px-4"><div className="text-xs text-muted-foreground">Total achats HT</div><div className="text-base font-bold mt-1">{formatCurrency(totalHT)}</div></CardContent></Card>
        <Card className="flex-1"><CardContent className="py-3 px-4"><div className="text-xs text-muted-foreground">Commandes</div><div className="text-base font-bold mt-1">{purchases.length}</div></CardContent></Card>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2.5 px-4 font-medium">N° commande</th>
                <th className="py-2.5 px-4 font-medium">Fournisseur</th>
                <th className="py-2.5 px-4 font-medium">Chantier</th>
                <th className="py-2.5 px-4 font-medium">Statut</th>
                <th className="py-2.5 px-4 font-medium text-right">Montant HT</th>
                <th className="py-2.5 px-4 font-medium">Date commande</th>
                <th className="py-2.5 px-4 font-medium">Livraison</th>
                <th className="py-2.5 px-4 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const s = contactMap.get(p.supplier_id);
                const ch = p.chantier_id ? chantierMap.get(p.chantier_id) : null;
                return (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`purchase-row-${p.id}`}>
                    <td className="py-2.5 px-4 font-medium">{p.number}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">{s ? contactName(s) : "—"}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{ch ? ch.reference : "—"}</td>
                    <td className="py-2.5 px-4"><StatusBadge status={p.status} /></td>
                    <td className="py-2.5 px-4 text-right font-medium">{formatCurrency(p.amount_ht)}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{formatDate(p.order_date)}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{formatDate(p.delivery_date)}</td>
                    <td className="py-2.5 px-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="size-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {p.status === "brouillon" && (
                            <DropdownMenuItem onClick={() => updateMut.mutate({ id: p.id, data: { status: "commandé", order_date: new Date().toISOString().split("T")[0] } })}>
                              <Truck className="size-3.5 mr-2" /> Commander
                            </DropdownMenuItem>
                          )}
                          {p.status === "commandé" && (
                            <DropdownMenuItem onClick={() => updateMut.mutate({ id: p.id, data: { status: "reçu", delivery_date: new Date().toISOString().split("T")[0] } })}>
                              <PackageCheck className="size-3.5 mr-2" /> Marquer reçu
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Aucune commande</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle commande</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Fournisseur *</Label>
              <Select value={form.supplierId} onValueChange={v => setForm(f => ({ ...f, supplierId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{contactName(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chantier (optionnel)</Label>
              <Select value={form.chantierId} onValueChange={v => setForm(f => ({ ...f, chantierId: v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {chantiers.map(ch => (
                    <SelectItem key={ch.id} value={String(ch.id)}>{ch.reference} — {ch.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Montant HT (€) *</Label><Input type="number" step="0.01" value={form.amountHT} onChange={e => setForm(f => ({ ...f, amountHT: e.target.value }))} required /></div>
              <div>
                <Label>TVA (%)</Label>
                <Select value={form.tvaRate} onValueChange={v => setForm(f => ({ ...f, tvaRate: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20%</SelectItem>
                    <SelectItem value="10">10%</SelectItem>
                    <SelectItem value="5.5">5,5%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Date de commande</Label><Input type="date" value={form.orderDate} onChange={e => setForm(f => ({ ...f, orderDate: e.target.value }))} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMut.isPending || !form.supplierId} data-testid="btn-submit-purchase">
                {createMut.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

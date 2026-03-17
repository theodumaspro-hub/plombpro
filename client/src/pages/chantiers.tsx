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
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { db } from "@/lib/supabaseData";
import { formatCurrency, formatDate, contactName, formatPercent } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, MapPin, MoreHorizontal, TrendingUp, Euro, FileText, Receipt, X, ArrowLeft } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Chantier, Contact, Quote, Invoice } from "@shared/schema";

export default function ChantiersPage() {
  const [location, setLocation] = useLocation();
  const shouldAutoOpen = typeof window !== 'undefined' && window.location.hash === '#/chantiers/nouveau';
  const [open, setOpen] = useState(shouldAutoOpen);

  useEffect(() => {
    if (shouldAutoOpen) {
      setLocation("/chantiers", { replace: true });
    }
  }, []);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const { toast } = useToast();

  const [detailId, setDetailId] = useState<number | null>(null);

  const { data: chantiers = [] } = useQuery<any[]>({ queryKey: ["chantiers"], queryFn: () => db.getChantiers() });
  const { data: contacts = [] } = useQuery<any[]>({ queryKey: ["contacts"], queryFn: () => db.getContacts() });
  const { data: quotes = [] } = useQuery<any[]>({ queryKey: ["quotes"], queryFn: () => db.getQuotes() });
  const { data: invoices = [] } = useQuery<any[]>({ queryKey: ["invoices"], queryFn: () => db.getInvoices() });
  const contactMap = new Map(contacts.map((c: any) => [c.id, c]));
  const clients = contacts.filter((c: any) => c.type === "client");

  // Financial helpers per chantier
  function getChantierFinancials(chId: number) {
    const chQuotes = quotes.filter((q: any) => q.chantier_id === chId);
    const chInvoices = invoices.filter((i: any) => i.chantier_id === chId && i.type !== "avoir");
    const deviseTTC = chQuotes.filter((q: any) => q.status === "signé").reduce((s: number, q: any) => s + parseFloat(q.amount_ttc || "0"), 0);
    const factureTTC = chInvoices.reduce((s: number, i: any) => s + parseFloat(i.amount_ttc || "0"), 0);
    const encaisseTTC = chInvoices.reduce((s: number, i: any) => s + parseFloat(i.amount_paid || "0"), 0);
    return { deviseTTC, factureTTC, encaisseTTC, quotes: chQuotes, invoices: chInvoices };
  }

  const [form, setForm] = useState({
    contactId: "", title: "", type: "rénovation", priority: "normale",
    address: "", city: "", postalCode: "", estimatedAmountHT: "",
    startDate: "", endDate: "", description: "",
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => db.createChantier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chantiers"] });
      setOpen(false);
      toast({ title: "Chantier créé" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => db.updateChantier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chantiers"] });
      toast({ title: "Chantier mis à jour" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ref = `CH-2026-${String(chantiers.length + 1).padStart(3, "0")}`;
    createMut.mutate({
      contact_id: Number(form.contactId),
      reference: ref,
      title: form.title,
      status: "prospect",
      type: form.type,
      priority: form.priority,
      address: form.address || null,
      city: form.city || null,
      postal_code: form.postalCode || null,
      estimated_amount_ht: form.estimatedAmountHT || "0",
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      description: form.description || null,
    });
  }

  const filtered = chantiers.filter((ch: any) => {
    if (filterStatus !== "all" && ch.status !== filterStatus) return false;
    if (search) {
      const c = contactMap.get(ch.contact_id);
      const cName = c ? contactName(c).toLowerCase() : "";
      const term = search.toLowerCase();
      return ch.reference.toLowerCase().includes(term) || ch.title.toLowerCase().includes(term) || cName.includes(term);
    }
    return true;
  });

  return (
    <AppLayout
      title="Chantiers"
      actions={
        <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setOpen(true)} data-testid="btn-new-chantier">
          <Plus className="size-3.5" /> Nouveau chantier
        </Button>
      }
    >
      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="planifié">Planifié</SelectItem>
            <SelectItem value="en_cours">En cours</SelectItem>
            <SelectItem value="terminé">Terminé</SelectItem>
            <SelectItem value="facturé">Facturé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chantier Detail View */}
      {detailId && (() => {
        const ch = chantiers.find((c: any) => c.id === detailId);
        if (!ch) return null;
        const c = contactMap.get(ch.contact_id);
        const fin = getChantierFinancials(ch.id);
        const pct = ch.completion_percent || 0;
        const margin = ch.margin ? parseFloat(ch.margin) : null;
        const maxFin = Math.max(fin.deviseTTC, fin.factureTTC, fin.encaisseTTC, 1);
        return (
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setDetailId(null)}>
                <ArrowLeft className="size-3.5" /> Retour
              </Button>
              <h2 className="text-base font-semibold">{ch.reference} — {ch.title}</h2>
              <StatusBadge status={ch.status} />
            </div>

            {/* Financial KPIs */}
            <div className="grid grid-cols-3 gap-3">
              <Card><CardContent className="py-3 px-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="size-3" /> Devisé TTC</div>
                <div className="text-lg font-bold mt-1">{formatCurrency(fin.deviseTTC)}</div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-violet-500/70" style={{ width: `${(fin.deviseTTC / maxFin) * 100}%` }} />
                </div>
              </CardContent></Card>
              <Card><CardContent className="py-3 px-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Euro className="size-3" /> Facturé TTC</div>
                <div className="text-lg font-bold mt-1 text-primary">{formatCurrency(fin.factureTTC)}</div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${(fin.factureTTC / maxFin) * 100}%` }} />
                </div>
              </CardContent></Card>
              <Card><CardContent className="py-3 px-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Receipt className="size-3" /> Encaissé TTC</div>
                <div className="text-lg font-bold mt-1 text-emerald-400">{formatCurrency(fin.encaisseTTC)}</div>
                <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${(fin.encaisseTTC / maxFin) * 100}%` }} />
                </div>
              </CardContent></Card>
            </div>

            {/* Tabs: Résumé + Documents */}
            <Tabs defaultValue="resume">
              <TabsList className="h-8">
                <TabsTrigger value="resume" className="text-xs h-7">Résumé</TabsTrigger>
                <TabsTrigger value="documents" className="text-xs h-7">Documents ({fin.quotes.length + fin.invoices.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="resume">
                <Card><CardContent className="py-4 px-5 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div><div className="text-xs text-muted-foreground">Client</div><div className="text-sm font-medium">{c ? contactName(c) : "—"}</div></div>
                    <div><div className="text-xs text-muted-foreground">Adresse</div><div className="text-sm">{ch.address || "—"}{ch.city ? `, ${ch.city}` : ""}</div></div>
                    <div><div className="text-xs text-muted-foreground">Dates</div><div className="text-sm">{formatDate(ch.start_date)} → {formatDate(ch.end_date)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Type / Priorité</div><div className="text-sm capitalize">{ch.type || "—"} · {ch.priority || "normale"}</div></div>
                  </div>
                  <div className="pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Avancement</span><span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/50">
                    <div><div className="text-xs text-muted-foreground">Budget HT</div><div className="text-sm font-medium">{formatCurrency(ch.estimated_amount_ht)}</div></div>
                    <div><div className="text-xs text-muted-foreground">Réalisé HT</div><div className="text-sm font-medium">{formatCurrency(ch.actual_amount_ht)}</div></div>
                    {margin !== null && (
                      <div><div className="text-xs text-muted-foreground">Marge</div>
                        <div className={`text-sm font-medium ${margin >= 40 ? "text-emerald-400" : margin >= 20 ? "text-amber-400" : "text-red-400"}`}>{formatPercent(margin)}</div>
                      </div>
                    )}
                  </div>
                  {ch.description && <p className="text-xs text-muted-foreground pt-3 border-t border-border/50">{ch.description}</p>}
                </CardContent></Card>
              </TabsContent>
              <TabsContent value="documents">
                <Card><div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2.5 px-4 font-medium">Type</th>
                        <th className="py-2.5 px-4 font-medium">N°</th>
                        <th className="py-2.5 px-4 font-medium">Statut</th>
                        <th className="py-2.5 px-4 font-medium text-right">Montant TTC</th>
                        <th className="py-2.5 px-4 font-medium text-right">Payé</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fin.quotes.map((q: any) => (
                        <tr key={`q-${q.id}`} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2.5 px-4"><Badge variant="outline" className="text-[10px]">Devis</Badge></td>
                          <td className="py-2.5 px-4 font-mono text-xs">{q.number}</td>
                          <td className="py-2.5 px-4"><StatusBadge status={q.status} /></td>
                          <td className="py-2.5 px-4 text-right font-medium">{formatCurrency(q.amount_ttc)}</td>
                          <td className="py-2.5 px-4 text-right text-muted-foreground">—</td>
                        </tr>
                      ))}
                      {fin.invoices.map((inv: any) => (
                        <tr key={`i-${inv.id}`} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-2.5 px-4"><Badge variant="outline" className="text-[10px] capitalize">{inv.type}</Badge></td>
                          <td className="py-2.5 px-4 font-mono text-xs">{inv.number}</td>
                          <td className="py-2.5 px-4"><StatusBadge status={inv.status} /></td>
                          <td className="py-2.5 px-4 text-right font-medium">{formatCurrency(inv.amount_ttc)}</td>
                          <td className="py-2.5 px-4 text-right text-emerald-400">{formatCurrency(inv.amount_paid)}</td>
                        </tr>
                      ))}
                      {fin.quotes.length + fin.invoices.length === 0 && (
                        <tr><td colSpan={5} className="py-6 text-center text-muted-foreground text-xs">Aucun document lié à ce chantier</td></tr>
                      )}
                    </tbody>
                  </table>
                </div></Card>
              </TabsContent>
            </Tabs>
          </div>
        );
      })()}

      {/* Chantier Cards */}
      {!detailId && (
      <div className="grid gap-3">
        {filtered.map((ch: any) => {
          const c = contactMap.get(ch.contact_id);
          const pct = ch.completion_percent || 0;
          const margin = ch.margin ? parseFloat(ch.margin) : null;
          const fin = getChantierFinancials(ch.id);
          const maxFin = Math.max(fin.deviseTTC, fin.factureTTC, fin.encaisseTTC, 1);
          return (
            <Card key={ch.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setDetailId(ch.id)} data-testid={`chantier-card-${ch.id}`}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{ch.reference}</span>
                      <StatusBadge status={ch.status} />
                      <StatusBadge status={ch.priority || "normale"} />
                    </div>
                    <h3 className="text-base font-medium mt-1">{ch.title}</h3>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {c ? contactName(c) : "—"}
                      {ch.city && <span className="ml-2"><MapPin className="size-3 inline" /> {ch.city}</span>}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={e => e.stopPropagation()}><MoreHorizontal className="size-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {ch.status === "prospect" && (
                        <DropdownMenuItem onClick={() => updateMut.mutate({ id: ch.id, data: { status: "planifié" } })}>Planifier</DropdownMenuItem>
                      )}
                      {ch.status === "planifié" && (
                        <DropdownMenuItem onClick={() => updateMut.mutate({ id: ch.id, data: { status: "en_cours" } })}>Démarrer</DropdownMenuItem>
                      )}
                      {ch.status === "en_cours" && (
                        <DropdownMenuItem onClick={() => updateMut.mutate({ id: ch.id, data: { status: "terminé", completion_percent: 100 } })}>Terminer</DropdownMenuItem>
                      )}
                      {ch.status === "terminé" && (
                        <DropdownMenuItem onClick={() => updateMut.mutate({ id: ch.id, data: { status: "facturé" } })}>Marquer facturé</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Financial summary bars */}
                {(fin.deviseTTC > 0 || fin.factureTTC > 0) && (
                  <div className="grid grid-cols-3 gap-3 mt-3 mb-2">
                    <div>
                      <div className="text-[10px] text-muted-foreground">Devisé</div>
                      <div className="text-xs font-medium">{formatCurrency(fin.deviseTTC)}</div>
                      <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-violet-500/70" style={{ width: `${(fin.deviseTTC / maxFin) * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Facturé</div>
                      <div className="text-xs font-medium text-primary">{formatCurrency(fin.factureTTC)}</div>
                      <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${(fin.factureTTC / maxFin) * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground">Encaissé</div>
                      <div className="text-xs font-medium text-emerald-400">{formatCurrency(fin.encaisseTTC)}</div>
                      <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${(fin.encaisseTTC / maxFin) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 mt-2">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Avancement</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">Budget HT</div>
                    <div className="text-sm font-medium">{formatCurrency(ch.estimated_amount_ht)}</div>
                  </div>
                  {margin !== null && (
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="size-3" />Marge</div>
                      <div className={`text-sm font-medium ${margin >= 40 ? "text-emerald-400" : margin >= 20 ? "text-amber-400" : "text-red-400"}`}>{formatPercent(margin)}</div>
                    </div>
                  )}
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">Dates</div>
                    <div className="text-xs">{formatDate(ch.start_date)} → {formatDate(ch.end_date)}</div>
                  </div>
                </div>

                {ch.description && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{ch.description}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Aucun chantier trouvé</CardContent></Card>
        )}
      </div>
      )}

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau chantier</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Client *</Label>
              <Select value={form.contactId} onValueChange={v => setForm(f => ({ ...f, contactId: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{contactName(c)}{c.company ? ` — ${c.company}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Titre du chantier *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Rénovation SdB" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dépannage">Dépannage</SelectItem>
                    <SelectItem value="rénovation">Rénovation</SelectItem>
                    <SelectItem value="neuf">Neuf</SelectItem>
                    <SelectItem value="entretien">Entretien</SelectItem>
                    <SelectItem value="diagnostic">Diagnostic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priorité</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basse">Basse</SelectItem>
                    <SelectItem value="normale">Normale</SelectItem>
                    <SelectItem value="haute">Haute</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Adresse</Label>
              <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ville</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
              <div>
                <Label>Code postal</Label>
                <Input value={form.postalCode} onChange={e => setForm(f => ({ ...f, postalCode: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Budget estimé HT (€)</Label>
              <Input type="number" step="0.01" value={form.estimatedAmountHT} onChange={e => setForm(f => ({ ...f, estimatedAmountHT: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date début</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <Label>Date fin prévue</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMut.isPending || !form.contactId || !form.title} data-testid="btn-submit-chantier">
                {createMut.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

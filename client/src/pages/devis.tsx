import { useState, useEffect, useRef, useCallback } from "react";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatDate, contactName } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, FileCheck, Send, Eye, Copy, Trash2, MoreHorizontal, PenTool, FileText, Package } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Quote, Contact } from "@shared/schema";

export default function DevisPage() {
  const [location, setLocation] = useLocation();
  const shouldAutoOpen = typeof window !== 'undefined' && window.location.hash === '#/devis/nouveau';
  const [open, setOpen] = useState(shouldAutoOpen);

  useEffect(() => {
    if (shouldAutoOpen) {
      setLocation("/devis", { replace: true });
    }
  }, []);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const { toast } = useToast();

  const { data: quotes = [], isLoading } = useQuery<Quote[]>({ queryKey: ["/api/quotes"] });
  const { data: contacts = [] } = useQuery<Contact[]>({ queryKey: ["/api/contacts"] });
  const { data: templates = [] } = useQuery<any[]>({ queryKey: ["/api/quote-templates"] });
  const contactMap = new Map(contacts.map(c => [c.id, c]));
  const clients = contacts.filter(c => c.type === "client");

  const [form, setForm] = useState({
    contactId: "", title: "", tvaRate: "10", validUntil: "", notes: "", conditions: "Validité 30 jours. Acompte 30% à la commande.",
    templateId: "",
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/quotes", data);
      return res.json();
    },
    onSuccess: (newQuote) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setOpen(false);
      resetForm();
      // Navigate to edit page after creation
      setLocation(`/devis/${newQuote.id}`);
      toast({ title: "Devis créé", description: "Ajoutez maintenant les lignes du devis." });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/quotes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Devis mis à jour" });
    },
  });

  const duplicateMut = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/quotes/${id}/duplicate`);
      return res.json();
    },
    onSuccess: (newQuote) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Devis dupliqué", description: `${newQuote.number} créé en brouillon.` });
      // Navigate to the duplicate
      setLocation(`/devis/${newQuote.id}`);
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/quotes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Devis supprimé" });
    },
  });

  // ─── Signature électronique ────────────────────
  const [signOpen, setSignOpen] = useState(false);
  const [signQuote, setSignQuote] = useState<Quote | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.strokeStyle = "#D97706";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    if (signOpen) {
      const t = setTimeout(initCanvas, 50);
      return () => clearTimeout(t);
    }
  }, [signOpen, initCanvas]);

  function onCanvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  }

  function onCanvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  }

  function onCanvasMouseUp() {
    isDrawing.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  const signMut = useMutation({
    mutationFn: async ({ id, signatureData }: { id: number; signatureData: string }) =>
      apiRequest("PATCH", `/api/quotes/${id}`, {
        status: "signé",
        signedAt: new Date().toISOString().split("T")[0],
        signatureData,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setSignOpen(false);
      setSignQuote(null);
      toast({ title: "Devis signé avec succès" });
    },
  });

  function handleSign() {
    const canvas = canvasRef.current;
    if (!canvas || !signQuote) return;
    const base64data = canvas.toDataURL();
    signMut.mutate({ id: signQuote.id, signatureData: base64data });
  }

  function resetForm() {
    setForm({ contactId: "", title: "", tvaRate: "10", validUntil: "", notes: "", conditions: "Validité 30 jours. Acompte 30% à la commande.", templateId: "" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = `DEV-2026-${String(quotes.length + 1).padStart(3, "0")}`;
    createMut.mutate({
      contactId: Number(form.contactId),
      number: num,
      status: "brouillon",
      title: form.title,
      amountHT: "0",
      amountTVA: "0",
      amountTTC: "0",
      validUntil: form.validUntil || null,
      notes: form.notes || null,
      conditions: form.conditions || null,
    });
  }

  const filtered = quotes.filter(q => {
    if (filterStatus !== "all" && q.status !== filterStatus) return false;
    if (search) {
      const c = contactMap.get(q.contactId);
      const cName = c ? contactName(c).toLowerCase() : "";
      const term = search.toLowerCase();
      return q.number.toLowerCase().includes(term) || (q.title || "").toLowerCase().includes(term) || cName.includes(term);
    }
    return true;
  });

  const totals = {
    brouillon: quotes.filter(q => q.status === "brouillon").reduce((s, q) => s + parseFloat(q.amountTTC || "0"), 0),
    envoyé: quotes.filter(q => q.status === "envoyé").reduce((s, q) => s + parseFloat(q.amountTTC || "0"), 0),
    signé: quotes.filter(q => q.status === "signé").reduce((s, q) => s + parseFloat(q.amountTTC || "0"), 0),
  };

  return (
    <AppLayout
      title="Devis"
      actions={
        <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setOpen(true)} data-testid="btn-new-devis">
          <Plus className="size-3.5" /> Nouveau devis
        </Button>
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-xs text-muted-foreground">Brouillons</div>
            <div className="text-base font-bold mt-1">{formatCurrency(totals.brouillon)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-xs text-muted-foreground">Envoyés</div>
            <div className="text-base font-bold mt-1 text-blue-400">{formatCurrency(totals.envoyé)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-xs text-muted-foreground">Signés</div>
            <div className="text-base font-bold mt-1 text-emerald-400">{formatCurrency(totals.signé)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" data-testid="input-search-devis" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-sm" data-testid="filter-status-devis">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="brouillon">Brouillon</SelectItem>
            <SelectItem value="envoyé">Envoyé</SelectItem>
            <SelectItem value="signé">Signé</SelectItem>
            <SelectItem value="refusé">Refusé</SelectItem>
            <SelectItem value="expiré">Expiré</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2.5 px-4 font-medium">N°</th>
                <th className="py-2.5 px-4 font-medium">Client</th>
                <th className="py-2.5 px-4 font-medium">Objet</th>
                <th className="py-2.5 px-4 font-medium">Statut</th>
                <th className="py-2.5 px-4 font-medium text-right">Montant TTC</th>
                <th className="py-2.5 px-4 font-medium">Valide jusqu'au</th>
                <th className="py-2.5 px-4 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(q => {
                const c = contactMap.get(q.contactId);
                return (
                  <tr
                    key={q.id}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                    data-testid={`devis-row-${q.id}`}
                    onClick={() => setLocation(`/devis/${q.id}`)}
                  >
                    <td className="py-2.5 px-4 font-medium">{q.number}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">{c ? contactName(c) : "—"}</td>
                    <td className="py-2.5 px-4 max-w-[200px] truncate">{q.title || "—"}</td>
                    <td className="py-2.5 px-4"><StatusBadge status={q.status} /></td>
                    <td className="py-2.5 px-4 text-right font-medium">{formatCurrency(q.amountTTC)}</td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{formatDate(q.validUntil)}</td>
                    <td className="py-2.5 px-4" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="size-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/devis/${q.id}`)}>
                            <FileText className="size-3.5 mr-2" /> Éditer
                          </DropdownMenuItem>
                          {q.status === "brouillon" && (
                            <DropdownMenuItem onClick={() => updateMut.mutate({ id: q.id, data: { status: "envoyé" } })}>
                              <Send className="size-3.5 mr-2" /> Marquer envoyé
                            </DropdownMenuItem>
                          )}
                          {q.status === "envoyé" && (
                            <DropdownMenuItem onClick={() => updateMut.mutate({ id: q.id, data: { status: "signé", signedAt: new Date().toISOString().split("T")[0] } })}>
                              <FileCheck className="size-3.5 mr-2" /> Marquer signé
                            </DropdownMenuItem>
                          )}
                          {q.status === "envoyé" && (
                            <DropdownMenuItem onClick={() => { setSignQuote(q); setSignOpen(true); }}>
                              <PenTool className="size-3.5 mr-2" /> Signer
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => duplicateMut.mutate(q.id)}>
                            <Copy className="size-3.5 mr-2" /> Dupliquer
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { if (confirm("Supprimer ce devis ?")) deleteMut.mutate(q.id); }}
                          >
                            <Trash2 className="size-3.5 mr-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Aucun devis trouvé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Signature Dialog */}
      <Dialog open={signOpen} onOpenChange={(v) => { setSignOpen(v); if (!v) setSignQuote(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Signature électronique</DialogTitle>
          </DialogHeader>
          {signQuote && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Devis</span>
                  <span className="font-medium">{signQuote.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Client</span>
                  <span className="font-medium">{contactMap.get(signQuote.contactId) ? contactName(contactMap.get(signQuote.contactId)!) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant TTC</span>
                  <span className="font-bold">{formatCurrency(signQuote.amountTTC)}</span>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Dessinez votre signature ci-dessous</Label>
                <div className="border-2 border-dashed border-border rounded-lg h-40 flex items-center justify-center cursor-crosshair bg-muted/20 relative">
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full rounded-lg"
                    onMouseDown={onCanvasMouseDown}
                    onMouseMove={onCanvasMouseMove}
                    onMouseUp={onCanvasMouseUp}
                    onMouseLeave={onCanvasMouseUp}
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" size="sm" onClick={clearCanvas}>Effacer</Button>
                <Button type="button" size="sm" onClick={handleSign} disabled={signMut.isPending}>
                  {signMut.isPending ? "Validation..." : "Valider la signature"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog — Now with template selection */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouveau devis</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Client *</Label>
              <Select value={form.contactId} onValueChange={v => setForm(f => ({ ...f, contactId: v }))}>
                <SelectTrigger data-testid="select-client"><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{contactName(c)}{c.company ? ` — ${c.company}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Objet du devis *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Rénovation salle de bain" required data-testid="input-title" />
            </div>

            {/* Template Selection */}
            {templates.length > 0 && (
              <div>
                <Label className="flex items-center gap-2">
                  <Package className="size-3.5" /> Modèle (optionnel)
                </Label>
                <Select value={form.templateId} onValueChange={v => setForm(f => ({ ...f, templateId: v }))}>
                  <SelectTrigger data-testid="select-template"><SelectValue placeholder="Démarrer avec un modèle" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun modèle</SelectItem>
                    {templates.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name} ({t.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.templateId && form.templateId !== "none" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Les lignes du modèle seront pré-remplies. Vous pourrez les modifier ensuite.
                  </p>
                )}
              </div>
            )}

            <div>
              <Label>Valide jusqu'au</Label>
              <Input type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} data-testid="input-valid-until" />
            </div>
            <div>
              <Label>Conditions</Label>
              <Textarea value={form.conditions} onChange={e => setForm(f => ({ ...f, conditions: e.target.value }))} rows={2} data-testid="input-conditions" />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMut.isPending || !form.contactId || !form.title} data-testid="btn-submit-devis">
                {createMut.isPending ? "Création..." : "Créer le devis"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

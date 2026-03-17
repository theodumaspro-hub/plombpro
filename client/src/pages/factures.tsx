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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatDate, contactName, invoiceTypeLabel } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Send, CreditCard, MoreHorizontal, FileText, AlertTriangle, Download, Link2, Copy, CheckCircle2, Undo2, Banknote, Receipt, Eye, Mail } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { Invoice, Contact, PaymentLink } from "@shared/schema";

export default function FacturesPage() {
  const [location, setLocation] = useLocation();
  const shouldAutoOpen = typeof window !== 'undefined' && window.location.hash === '#/factures/nouveau';
  const [open, setOpen] = useState(shouldAutoOpen);

  useEffect(() => {
    if (shouldAutoOpen) {
      setLocation("/factures", { replace: true });
    }
  }, []);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const { toast } = useToast();

  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["/api/invoices"] });
  const { data: contacts = [] } = useQuery<Contact[]>({ queryKey: ["/api/contacts"] });
  const contactMap = new Map(contacts.map(c => [c.id, c]));
  const clients = contacts.filter(c => c.type === "client");

  const { data: paymentLinks = [] } = useQuery<PaymentLink[]>({ queryKey: ["/api/payment-links"] });
  const paymentLinksByInvoice = new Map<number, PaymentLink[]>();
  paymentLinks.forEach(pl => {
    const existing = paymentLinksByInvoice.get(pl.invoiceId) || [];
    existing.push(pl);
    paymentLinksByInvoice.set(pl.invoiceId, existing);
  });

  // Payment link dialog
  const [payLinkOpen, setPayLinkOpen] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [payLinkForm, setPayLinkForm] = useState({
    invoiceId: "", amount: "", paymentMethod: "carte", expiresAt: "",
  });

  // Avoir dialog
  const [avoirOpen, setAvoirOpen] = useState(false);
  const [avoirInvoice, setAvoirInvoice] = useState<Invoice | null>(null);
  const [avoirMode, setAvoirMode] = useState<"total" | "partial">("total");
  const [avoirAmount, setAvoirAmount] = useState("");
  const [avoirReason, setAvoirReason] = useState("");

  // Payment tracking dialog (Règlements)
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "", date: new Date().toISOString().split("T")[0], method: "virement", reference: "",
  });
  const [payments, setPayments] = useState<any[]>([]);

  // Send invoice dialog
  const [sendOpen, setSendOpen] = useState(false);
  const [sendInvoice, setSendInvoice] = useState<Invoice | null>(null);
  const [sendForm, setSendForm] = useState({ email: "", subject: "", message: "" });

  const createPayLinkMut = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/payment-links", data),
    onSuccess: async (res) => {
      const link = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      setCreatedLink(link.linkUrl || `https://pay.plombpro.fr/${link.id}`);
      toast({ title: "Lien de paiement créé" });
    },
  });

  function handlePayLinkSubmit(e: React.FormEvent) {
    e.preventDefault();
    const inv = invoices.find(i => i.id === Number(payLinkForm.invoiceId));
    createPayLinkMut.mutate({
      invoiceId: Number(payLinkForm.invoiceId),
      contactId: inv?.contactId || null,
      amount: payLinkForm.amount,
      paymentMethod: payLinkForm.paymentMethod,
      status: "active",
      expiresAt: payLinkForm.expiresAt || null,
      linkUrl: `https://pay.plombpro.fr/lnk-${Date.now()}`,
    });
  }

  function openPayLinkDialog() {
    setCreatedLink(null);
    setPayLinkForm({ invoiceId: "", amount: "", paymentMethod: "carte", expiresAt: "" });
    setPayLinkOpen(true);
  }

  const unpaidInvoices = invoices.filter(i => i.status === "envoyée" || i.status === "en_retard" || i.status === "partiellement_payée");

  const [form, setForm] = useState({
    contactId: "", type: "facture", title: "", amountHT: "", tvaRate: "20",
    dueDate: "", paymentMethod: "", notes: "",
    retenueGarantiePercent: "", primeEnergieAmount: "", primeEnergieType: "",
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/invoices", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setOpen(false);
      toast({ title: "Facture créée" });
      setForm({ contactId: "", type: "facture", title: "", amountHT: "", tvaRate: "20", dueDate: "", paymentMethod: "", notes: "", retenueGarantiePercent: "", primeEnergieAmount: "", primeEnergieType: "" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest("PATCH", `/api/invoices/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Facture mise à jour" });
    },
  });

  // Avoir mutation
  const avoirMut = useMutation({
    mutationFn: async () => {
      if (!avoirInvoice) throw new Error("Facture manquante");
      return apiRequest("POST", `/api/invoices/${avoirInvoice.id}/avoir`, {
        mode: avoirMode,
        amount: avoirMode === "partial" ? avoirAmount : null,
        reason: avoirReason || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setAvoirOpen(false);
      toast({ title: "Avoir créé" });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Payment mutation
  const addPaymentMut = useMutation({
    mutationFn: async () => {
      if (!paymentInvoice) throw new Error("Facture manquante");
      return apiRequest("POST", `/api/invoices/${paymentInvoice.id}/payments`, paymentForm);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      // Reload payments
      if (paymentInvoice) {
        const res = await apiRequest("GET", `/api/invoices/${paymentInvoice.id}/payments`);
        const data = await res.json();
        setPayments(Array.isArray(data) ? data : []);
      }
      setPaymentForm(f => ({ ...f, amount: "", reference: "" }));
      toast({ title: "Règlement enregistré" });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Send invoice mutation
  const sendInvoiceMut = useMutation({
    mutationFn: async () => {
      if (!sendInvoice) throw new Error("Facture manquante");
      return apiRequest("POST", `/api/invoices/${sendInvoice.id}/send`, sendForm);
    },
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setSendOpen(false);
      toast({ title: "Facture envoyée", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  function openSendDialog(inv: Invoice) {
    const c = contactMap.get(inv.contactId);
    const docLabel = inv.type === "avoir" ? "Avoir" : "Facture";
    setSendInvoice(inv);
    setSendForm({
      email: c?.email || "",
      subject: `${docLabel} ${inv.number}${inv.title ? ` — ${inv.title}` : ""}`,
      message: `Bonjour${c ? ` ${contactName(c)}` : ""},\n\nVeuillez trouver ci-joint la ${docLabel.toLowerCase()} n° ${inv.number}${inv.title ? ` pour ${inv.title}` : ""}.\n\nN'hésitez pas à nous contacter pour toute question.\n\nCordialement,`,
    });
    setSendOpen(true);
  }

  async function handleDownloadPDF(inv: Invoice) {
    try {
      const res = await apiRequest("GET", `/api/invoices/${inv.id}/pdf`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const prefix = inv.type === "avoir" ? "Avoir" : "Facture";
      a.download = `${prefix}-${inv.number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Erreur PDF", description: err.message, variant: "destructive" });
    }
  }

  async function handlePreviewPDF(inv: Invoice) {
    try {
      const res = await apiRequest("GET", `/api/invoices/${inv.id}/pdf`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err: any) {
      toast({ title: "Erreur PDF", description: err.message, variant: "destructive" });
    }
  }

  function openAvoirDialog(inv: Invoice) {
    setAvoirInvoice(inv);
    setAvoirMode("total");
    setAvoirAmount("");
    setAvoirReason("");
    setAvoirOpen(true);
  }

  async function openPaymentDialog(inv: Invoice) {
    setPaymentInvoice(inv);
    const remaining = parseFloat(inv.amountTTC || "0") - parseFloat(inv.amountPaid || "0");
    setPaymentForm({ amount: remaining > 0 ? remaining.toFixed(2) : "", date: new Date().toISOString().split("T")[0], method: "virement", reference: "" });
    try {
      const res = await apiRequest("GET", `/api/invoices/${inv.id}/payments`);
      const data = await res.json();
      setPayments(Array.isArray(data) ? data : []);
    } catch { setPayments([]); }
    setPaymentOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ht = parseFloat(form.amountHT) || 0;
    const tva = ht * (parseFloat(form.tvaRate) / 100);
    const ttc = ht + tva;
    const prefix = form.type === "avoir" ? "AV" : "FAC";
    const num = `${prefix}-2026-${String(invoices.length + 1).padStart(3, "0")}`;
    const retPct = parseFloat(form.retenueGarantiePercent) || 0;
    createMut.mutate({
      contactId: Number(form.contactId),
      number: num,
      type: form.type,
      status: "brouillon",
      title: form.title,
      amountHT: String(form.type === "avoir" ? -Math.abs(ht) : ht),
      amountTVA: String(form.type === "avoir" ? -Math.abs(tva).toFixed(2) : tva.toFixed(2)),
      amountTTC: String(form.type === "avoir" ? -Math.abs(ttc).toFixed(2) : ttc.toFixed(2)),
      amountPaid: "0",
      dueDate: form.dueDate || null,
      paymentMethod: form.paymentMethod || null,
      notes: form.notes || null,
      retenueGarantiePercent: retPct > 0 ? String(retPct) : null,
      retenueGarantieAmount: retPct > 0 ? String((ttc * retPct / 100).toFixed(2)) : null,
      primeEnergieAmount: form.primeEnergieAmount || null,
      primeEnergieType: form.primeEnergieType || null,
    });
  }

  // Status-based filtering
  const now = new Date();
  const filtered = invoices.filter(inv => {
    // Status tabs
    if (tab === "brouillons" && inv.status !== "brouillon") return false;
    if (tab === "envoyees" && inv.status !== "envoyée") return false;
    if (tab === "en_retard") {
      const isOverdue = (inv.status === "envoyée" || inv.status === "partiellement_payée") && inv.dueDate && new Date(inv.dueDate) < now;
      if (!isOverdue) return false;
    }
    if (tab === "payees" && inv.status !== "payée") return false;
    if (tab === "avoirs" && inv.type !== "avoir") return false;
    if (tab === "factures" && inv.type === "avoir") return false;
    if (search) {
      const c = contactMap.get(inv.contactId);
      const cName = c ? contactName(c).toLowerCase() : "";
      const term = search.toLowerCase();
      return inv.number.toLowerCase().includes(term) || (inv.title || "").toLowerCase().includes(term) || cName.includes(term);
    }
    return true;
  });

  const totalTTC = invoices.filter(i => i.type !== "avoir").reduce((s, i) => s + parseFloat(i.amountTTC || "0"), 0);
  const totalPaid = invoices.reduce((s, i) => s + parseFloat(i.amountPaid || "0"), 0);
  const totalPending = invoices.filter(i => i.status === "envoyée").reduce((s, i) => s + parseFloat(i.amountTTC || "0"), 0);
  const totalAvoirs = invoices.filter(i => i.type === "avoir").reduce((s, i) => s + Math.abs(parseFloat(i.amountTTC || "0")), 0);

  // Count for tabs
  const brouillonsCount = invoices.filter(i => i.status === "brouillon").length;
  const envoyeesCount = invoices.filter(i => i.status === "envoyée").length;
  const enRetardCount = invoices.filter(i => (i.status === "envoyée" || i.status === "partiellement_payée") && i.dueDate && new Date(i.dueDate) < now).length;
  const payeesCount = invoices.filter(i => i.status === "payée").length;
  const avoirsCount = invoices.filter(i => i.type === "avoir").length;

  return (
    <AppLayout
      title="Factures"
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2 h-8 text-xs" onClick={openPayLinkDialog} data-testid="btn-payment-link">
            <CreditCard className="size-3.5" /> Lien de paiement
          </Button>
          <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setOpen(true)} data-testid="btn-new-facture">
            <Plus className="size-3.5" /> Nouvelle facture
          </Button>
        </div>
      }
    >
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card><CardContent className="py-3 px-4"><div className="text-xs text-muted-foreground">Total facturé TTC</div><div className="text-base font-bold mt-1">{formatCurrency(totalTTC)}</div></CardContent></Card>
        <Card><CardContent className="py-3 px-4"><div className="text-xs text-muted-foreground">Encaissé</div><div className="text-base font-bold mt-1 text-emerald-400">{formatCurrency(totalPaid)}</div></CardContent></Card>
        <Card><CardContent className="py-3 px-4"><div className="text-xs text-muted-foreground">En attente</div><div className="text-base font-bold mt-1 text-amber-400">{formatCurrency(totalPending)}</div></CardContent></Card>
        <Card><CardContent className="py-3 px-4"><div className="text-xs text-muted-foreground">Avoirs émis</div><div className="text-base font-bold mt-1 text-red-400">{formatCurrency(totalAvoirs)}</div></CardContent></Card>
      </div>

      {/* Status Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs h-7">Toutes</TabsTrigger>
          <TabsTrigger value="brouillons" className="text-xs h-7">
            Brouillons{brouillonsCount > 0 && <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-4">{brouillonsCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="envoyees" className="text-xs h-7">
            Envoyées{envoyeesCount > 0 && <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-4">{envoyeesCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="en_retard" className="text-xs h-7">
            En retard{enRetardCount > 0 && <Badge className="ml-1 text-[9px] px-1 py-0 h-4 bg-red-500">{enRetardCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="payees" className="text-xs h-7">
            Payées{payeesCount > 0 && <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-4">{payeesCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="avoirs" className="text-xs h-7">
            Avoirs{avoirsCount > 0 && <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0 h-4">{avoirsCount}</Badge>}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" data-testid="input-search-factures" />
        </div>
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2.5 px-4 font-medium">N°</th>
                <th className="py-2.5 px-4 font-medium">Type</th>
                <th className="py-2.5 px-4 font-medium">Client</th>
                <th className="py-2.5 px-4 font-medium">Objet</th>
                <th className="py-2.5 px-4 font-medium">Statut</th>
                <th className="py-2.5 px-4 font-medium text-right">TTC</th>
                <th className="py-2.5 px-4 font-medium" style={{ minWidth: 130 }}>Paiement</th>
                <th className="py-2.5 px-4 font-medium">Échéance</th>
                <th className="py-2.5 px-4 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(inv => {
                const c = contactMap.get(inv.contactId);
                const isOverdue = (inv.status === "envoyée" || inv.status === "partiellement_payée") && inv.dueDate && new Date(inv.dueDate) < now;
                const ttc = Math.abs(parseFloat(inv.amountTTC || "0"));
                const paid = parseFloat(inv.amountPaid || "0");
                const paidPct = ttc > 0 ? Math.min((paid / ttc) * 100, 100) : 0;
                return (
                  <tr key={inv.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${isOverdue ? "bg-red-500/5" : ""}`} data-testid={`facture-row-${inv.id}`}>
                    <td className="py-2.5 px-4 font-medium">{inv.number}</td>
                    <td className="py-2.5 px-4">
                      <Badge variant="outline" className="text-[10px] font-normal">{invoiceTypeLabel(inv.type)}</Badge>
                      {inv.retenueGarantieAmount && <Badge variant="outline" className="text-[10px] font-normal ml-1 bg-violet-500/10 text-violet-400 border-0">RG</Badge>}
                      {inv.primeEnergieType && <Badge variant="outline" className="text-[10px] font-normal ml-1 bg-teal-500/10 text-teal-400 border-0">{inv.primeEnergieType}</Badge>}
                      {(paymentLinksByInvoice.get(inv.id) || []).some(pl => pl.status === "active") && (
                        <Badge variant="outline" className="text-[10px] font-normal ml-1 bg-blue-500/10 text-blue-400 border-0">
                          <Link2 className="size-2.5 mr-0.5" /> Lien actif
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">{c ? contactName(c) : "—"}</td>
                    <td className="py-2.5 px-4 max-w-[180px] truncate">{inv.title || "—"}</td>
                    <td className="py-2.5 px-4">
                      <StatusBadge status={inv.status} />
                      {isOverdue && <AlertTriangle className="size-3 text-red-400 inline ml-1" />}
                    </td>
                    <td className="py-2.5 px-4 text-right font-medium">{formatCurrency(inv.amountTTC)}</td>
                    <td className="py-2.5 px-4">
                      {inv.type !== "avoir" && ttc > 0 ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${paidPct >= 100 ? "bg-emerald-400" : paidPct > 0 ? "bg-blue-400" : "bg-muted-foreground/20"}`}
                                style={{ width: `${paidPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0 w-8 text-right">{Math.round(paidPct)}%</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">{formatCurrency(paid)} / {formatCurrency(ttc)}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">{formatCurrency(inv.amountPaid)}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground text-xs">{formatDate(inv.dueDate)}</td>
                    <td className="py-2.5 px-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="size-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {inv.status === "brouillon" && (
                            <DropdownMenuItem onClick={() => openSendDialog(inv)}>
                              <Send className="size-3.5 mr-2" /> Envoyer par email
                            </DropdownMenuItem>
                          )}
                          {(inv.status === "envoyée" || inv.status === "partiellement_payée") && (
                            <>
                              <DropdownMenuItem onClick={() => openPaymentDialog(inv)}>
                                <Banknote className="size-3.5 mr-2" /> Règlements
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateMut.mutate({ id: inv.id, data: { status: "payée", amountPaid: inv.amountTTC, paymentDate: new Date().toISOString().split("T")[0] } })}>
                                <CreditCard className="size-3.5 mr-2" /> Marquer payée
                              </DropdownMenuItem>
                            </>
                          )}
                          {inv.status === "payée" && (
                            <DropdownMenuItem onClick={() => openPaymentDialog(inv)}>
                              <Receipt className="size-3.5 mr-2" /> Voir règlements
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handlePreviewPDF(inv)}>
                            <Eye className="size-3.5 mr-2" /> Aperçu PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadPDF(inv)}>
                            <Download className="size-3.5 mr-2" /> Télécharger PDF
                          </DropdownMenuItem>
                          {inv.status !== "brouillon" && (
                            <DropdownMenuItem onClick={() => openSendDialog(inv)}>
                              <Mail className="size-3.5 mr-2" /> Renvoyer par email
                            </DropdownMenuItem>
                          )}
                          {inv.facturXStatus === "conforme" && (
                            <DropdownMenuItem>
                              <FileText className="size-3.5 mr-2" /> Factur-X ✓
                            </DropdownMenuItem>
                          )}
                          {inv.type !== "avoir" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openAvoirDialog(inv)} className="text-red-400">
                                <Undo2 className="size-3.5 mr-2" /> Créer un avoir
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Aucune facture trouvée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle facture</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Client *</Label>
                <Select value={form.contactId} onValueChange={v => setForm(f => ({ ...f, contactId: v }))}>
                  <SelectTrigger data-testid="select-client-fac"><SelectValue placeholder="Client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{contactName(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="select-type-fac"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facture">Facture</SelectItem>
                    <SelectItem value="acompte">Acompte</SelectItem>
                    <SelectItem value="situation">Situation</SelectItem>
                    <SelectItem value="avoir">Avoir</SelectItem>
                    <SelectItem value="retenue_garantie">Retenue de garantie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Objet *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Facture travaux SdB" required data-testid="input-title-fac" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Montant HT (€)</Label>
                <Input type="number" step="0.01" value={form.amountHT} onChange={e => setForm(f => ({ ...f, amountHT: e.target.value }))} required data-testid="input-amount-fac" />
              </div>
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
              <div>
                <Label>Échéance</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Retenue de garantie (%)</Label>
              <Input type="number" step="0.5" value={form.retenueGarantiePercent} onChange={e => setForm(f => ({ ...f, retenueGarantiePercent: e.target.value }))} placeholder="Ex: 5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prime énergie (€)</Label>
                <Input type="number" step="0.01" value={form.primeEnergieAmount} onChange={e => setForm(f => ({ ...f, primeEnergieAmount: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <Label>Type de prime</Label>
                <Select value={form.primeEnergieType} onValueChange={v => setForm(f => ({ ...f, primeEnergieType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MaPrimeRenov">MaPrimeRénov'</SelectItem>
                    <SelectItem value="CEE">CEE</SelectItem>
                    <SelectItem value="eco-PTZ">Éco-PTZ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMut.isPending || !form.contactId || !form.title} data-testid="btn-submit-facture">
                {createMut.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Link Dialog */}
      <Dialog open={payLinkOpen} onOpenChange={(v) => { setPayLinkOpen(v); if (!v) setCreatedLink(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un lien de paiement</DialogTitle>
          </DialogHeader>
          {createdLink ? (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 rounded-lg p-4 text-center space-y-2">
                <CheckCircle2 className="size-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-medium">Lien créé avec succès</p>
              </div>
              <div className="flex items-center gap-2">
                <Input value={createdLink} readOnly className="text-xs" />
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => {
                  navigator.clipboard.writeText(createdLink);
                  toast({ title: "Lien copié" });
                }}>
                  <Copy className="size-3.5" />
                </Button>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => { setPayLinkOpen(false); setCreatedLink(null); }}>Fermer</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handlePayLinkSubmit} className="space-y-4">
              <div>
                <Label>Facture *</Label>
                <Select value={payLinkForm.invoiceId} onValueChange={v => {
                  const inv = invoices.find(i => i.id === Number(v));
                  setPayLinkForm(f => ({ ...f, invoiceId: v, amount: inv?.amountTTC || "" }));
                }}>
                  <SelectTrigger data-testid="select-invoice-paylink"><SelectValue placeholder="Sélectionner une facture" /></SelectTrigger>
                  <SelectContent>
                    {unpaidInvoices.map(inv => {
                      const c = contactMap.get(inv.contactId);
                      return (
                        <SelectItem key={inv.id} value={String(inv.id)}>
                          {inv.number} — {c ? contactName(c) : "—"} — {formatCurrency(inv.amountTTC)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Montant (€)</Label>
                  <Input type="number" step="0.01" value={payLinkForm.amount} onChange={e => setPayLinkForm(f => ({ ...f, amount: e.target.value }))} required data-testid="input-amount-paylink" />
                </div>
                <div>
                  <Label>Méthode</Label>
                  <Select value={payLinkForm.paymentMethod} onValueChange={v => setPayLinkForm(f => ({ ...f, paymentMethod: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="carte">Carte bancaire</SelectItem>
                      <SelectItem value="virement">Virement</SelectItem>
                      <SelectItem value="prelevement">Prélèvement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Date d'expiration</Label>
                <Input type="date" value={payLinkForm.expiresAt} onChange={e => setPayLinkForm(f => ({ ...f, expiresAt: e.target.value }))} />
              </div>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setPayLinkOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={createPayLinkMut.isPending || !payLinkForm.invoiceId} data-testid="btn-submit-paylink">
                  {createPayLinkMut.isPending ? "Création..." : "Créer le lien"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Avoir Dialog */}
      <Dialog open={avoirOpen} onOpenChange={setAvoirOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="size-5 text-red-400" /> Créer un avoir
            </DialogTitle>
          </DialogHeader>
          {avoirInvoice && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Facture : <span className="font-medium text-foreground">{avoirInvoice.number}</span> — {formatCurrency(avoirInvoice.amountTTC)} TTC
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`rounded-lg border p-3 text-left transition-all ${
                    avoirMode === "total" ? "ring-2 ring-primary bg-primary/5 border-primary" : "bg-card border-border hover:bg-muted/30"
                  }`}
                  onClick={() => setAvoirMode("total")}
                >
                  <div className="text-sm font-medium">Avoir total</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Annule l'intégralité</div>
                </button>
                <button
                  type="button"
                  className={`rounded-lg border p-3 text-left transition-all ${
                    avoirMode === "partial" ? "ring-2 ring-primary bg-primary/5 border-primary" : "bg-card border-border hover:bg-muted/30"
                  }`}
                  onClick={() => setAvoirMode("partial")}
                >
                  <div className="text-sm font-medium">Avoir partiel</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Montant personnalisé</div>
                </button>
              </div>

              {avoirMode === "partial" && (
                <div>
                  <Label>Montant TTC de l'avoir (€)</Label>
                  <Input
                    type="number" step="0.01" min="0.01"
                    max={Math.abs(parseFloat(avoirInvoice.amountTTC || "0")).toString()}
                    value={avoirAmount}
                    onChange={e => setAvoirAmount(e.target.value)}
                    placeholder={`Max: ${Math.abs(parseFloat(avoirInvoice.amountTTC || "0")).toFixed(2)}`}
                    data-testid="input-avoir-amount"
                  />
                </div>
              )}

              <div>
                <Label>Motif (optionnel)</Label>
                <Input
                  value={avoirReason}
                  onChange={e => setAvoirReason(e.target.value)}
                  placeholder="Ex: Erreur de facturation, remise commerciale..."
                />
              </div>

              <div className="bg-red-500/5 rounded-lg p-3 border border-red-500/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant de l'avoir :</span>
                  <span className="font-bold text-red-400">
                    -{formatCurrency(avoirMode === "partial" && avoirAmount ? parseFloat(avoirAmount) : Math.abs(parseFloat(avoirInvoice.amountTTC || "0")))}
                  </span>
                </div>
              </div>

              <DialogFooter>
                <Button variant="secondary" onClick={() => setAvoirOpen(false)}>Annuler</Button>
                <Button
                  onClick={() => avoirMut.mutate()}
                  disabled={avoirMut.isPending || (avoirMode === "partial" && (!avoirAmount || parseFloat(avoirAmount) <= 0))}
                  variant="destructive"
                  data-testid="btn-submit-avoir"
                >
                  {avoirMut.isPending ? "Création..." : "Créer l'avoir"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Tracking Dialog (Règlements) */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="size-5 text-primary" /> Règlements — {paymentInvoice?.number}
            </DialogTitle>
          </DialogHeader>
          {paymentInvoice && (
            <div className="space-y-4">
              {/* Invoice summary */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant TTC</span>
                  <span className="font-bold">{formatCurrency(paymentInvoice.amountTTC)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Déjà payé</span>
                  <span className="font-bold text-emerald-400">{formatCurrency(paymentInvoice.amountPaid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reste à payer</span>
                  <span className="font-bold text-amber-400">
                    {formatCurrency(Math.max(0, parseFloat(paymentInvoice.amountTTC || "0") - parseFloat(paymentInvoice.amountPaid || "0")))}
                  </span>
                </div>
                {/* Progress bar */}
                {(() => {
                  const ttc = Math.abs(parseFloat(paymentInvoice.amountTTC || "0"));
                  const paid = parseFloat(paymentInvoice.amountPaid || "0");
                  const pct = ttc > 0 ? Math.min((paid / ttc) * 100, 100) : 0;
                  return (
                    <div className="flex items-center gap-2 pt-1">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-emerald-400" : "bg-blue-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{Math.round(pct)}%</span>
                    </div>
                  );
                })()}
              </div>

              {/* Payment history */}
              {payments.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">Historique des règlements</div>
                  <div className="space-y-1.5">
                    {payments.map((p: any, i: number) => (
                      <div key={p.id || i} className="flex items-center justify-between py-2 px-3 bg-muted/20 rounded-lg text-sm">
                        <div>
                          <span className="font-medium">{formatCurrency(p.amount)}</span>
                          <span className="text-muted-foreground ml-2">{p.method || "virement"}</span>
                          {p.reference && <span className="text-muted-foreground ml-1">({p.reference})</span>}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDate(p.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add payment form */}
              {parseFloat(paymentInvoice.amountTTC || "0") > parseFloat(paymentInvoice.amountPaid || "0") && (
                <div className="border-t border-border pt-4 space-y-3">
                  <div className="text-xs font-medium text-muted-foreground">Ajouter un règlement</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Montant (€)</Label>
                      <Input
                        type="number" step="0.01" min="0.01"
                        value={paymentForm.amount}
                        onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                        data-testid="input-payment-amount"
                      />
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input type="date" value={paymentForm.date} onChange={e => setPaymentForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Méthode</Label>
                      <Select value={paymentForm.method} onValueChange={v => setPaymentForm(f => ({ ...f, method: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="virement">Virement</SelectItem>
                          <SelectItem value="cheque">Chèque</SelectItem>
                          <SelectItem value="especes">Espèces</SelectItem>
                          <SelectItem value="carte">Carte bancaire</SelectItem>
                          <SelectItem value="prelevement">Prélèvement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Référence</Label>
                      <Input
                        value={paymentForm.reference}
                        onChange={e => setPaymentForm(f => ({ ...f, reference: e.target.value }))}
                        placeholder="N° chèque, virement..."
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => addPaymentMut.mutate()}
                    disabled={addPaymentMut.isPending || !paymentForm.amount || parseFloat(paymentForm.amount) <= 0}
                    className="w-full"
                    data-testid="btn-add-payment"
                  >
                    {addPaymentMut.isPending ? "Enregistrement..." : "Enregistrer le règlement"}
                  </Button>
                </div>
              )}

              <DialogFooter>
                <Button variant="secondary" onClick={() => setPaymentOpen(false)}>Fermer</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Send Invoice Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-5 text-primary" /> Envoyer la facture
            </DialogTitle>
          </DialogHeader>
          {sendInvoice && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {sendInvoice.type === "avoir" ? "Avoir" : "Facture"} : <span className="font-medium text-foreground">{sendInvoice.number}</span> — {formatCurrency(sendInvoice.amountTTC)} TTC
              </div>
              <div>
                <Label>Destinataire *</Label>
                <Input
                  type="email"
                  value={sendForm.email}
                  onChange={e => setSendForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="email@client.fr"
                  data-testid="input-send-invoice-email"
                />
              </div>
              <div>
                <Label>Objet</Label>
                <Input
                  value={sendForm.subject}
                  onChange={e => setSendForm(f => ({ ...f, subject: e.target.value }))}
                  data-testid="input-send-invoice-subject"
                />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea
                  value={sendForm.message}
                  onChange={e => setSendForm(f => ({ ...f, message: e.target.value }))}
                  rows={6}
                  data-testid="input-send-invoice-message"
                />
              </div>
              <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
                <FileText className="size-3.5 inline mr-1.5 text-primary" />
                Le PDF de la facture sera généré et joint automatiquement à l'email.
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSendOpen(false)}>Annuler</Button>
                <Button
                  onClick={() => sendInvoiceMut.mutate()}
                  disabled={!sendForm.email || sendInvoiceMut.isPending}
                  className="gap-2"
                  data-testid="btn-confirm-send-invoice"
                >
                  <Send className="size-4" />
                  {sendInvoiceMut.isPending ? "Envoi..." : "Envoyer"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

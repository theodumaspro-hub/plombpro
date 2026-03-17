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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { db } from "@/lib/supabaseData";
import { formatCurrency, contactName } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Phone, Mail, MapPin, Building2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Contact } from "@shared/schema";

export default function ContactsPage() {
  const [location, setLocation] = useLocation();
  const shouldAutoOpen = typeof window !== 'undefined' && window.location.hash === '#/contacts/nouveau';
  const [open, setOpen] = useState(shouldAutoOpen);

  useEffect(() => {
    if (shouldAutoOpen) {
      setLocation("/contacts", { replace: true });
    }
  }, []);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const { toast } = useToast();

  const { data: contacts = [] } = useQuery<Contact[]>({ queryKey: ["contacts"], queryFn: () => db.getContacts() });

  const [form, setForm] = useState({
    type: "client", category: "particulier", firstName: "", lastName: "",
    company: "", email: "", phone: "", mobile: "",
    address: "", city: "", postalCode: "", siret: "", notes: "",
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => db.createContact(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setOpen(false);
      toast({ title: "Contact créé" });
      setForm({ type: "client", category: "particulier", firstName: "", lastName: "", company: "", email: "", phone: "", mobile: "", address: "", city: "", postalCode: "", siret: "", notes: "" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMut.mutate({
      ...form,
      firstName: form.firstName || null,
      lastName: form.lastName || null,
      company: form.company || null,
      email: form.email || null,
      phone: form.phone || null,
      mobile: form.mobile || null,
      address: form.address || null,
      city: form.city || null,
      postalCode: form.postalCode || null,
      siret: form.siret || null,
      notes: form.notes || null,
    });
  }

  const filtered = contacts.filter(c => {
    if (tab === "clients" && c.type !== "client") return false;
    if (tab === "fournisseurs" && c.type !== "fournisseur") return false;
    if (search) {
      const term = search.toLowerCase();
      return contactName(c).toLowerCase().includes(term) || (c.company || "").toLowerCase().includes(term) || (c.email || "").toLowerCase().includes(term);
    }
    return true;
  });

  const clientCount = contacts.filter(c => c.type === "client").length;
  const supplierCount = contacts.filter(c => c.type === "fournisseur").length;

  return (
    <AppLayout
      title="Contacts"
      actions={
        <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setOpen(true)} data-testid="btn-new-contact">
          <Plus className="size-3.5" /> Nouveau contact
        </Button>
      }
    >
      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs h-7">Tous ({contacts.length})</TabsTrigger>
          <TabsTrigger value="clients" className="text-xs h-7">Clients ({clientCount})</TabsTrigger>
          <TabsTrigger value="fournisseurs" className="text-xs h-7">Fournisseurs ({supplierCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher un contact..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" data-testid="input-search-contacts" />
        </div>
      </div>

      {/* Contact Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(c => (
          <Card key={c.id} className="hover:bg-muted/20 transition-colors" data-testid={`contact-card-${c.id}`}>
            <CardContent className="py-4 px-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`size-10 rounded-full flex items-center justify-center text-sm font-semibold ${c.type === "client" ? "bg-primary/15 text-primary" : "bg-blue-500/15 text-blue-400"}`}>
                    {c.type === "client" ? <User className="size-4" /> : <Building2 className="size-4" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{contactName(c)}</div>
                    {c.company && <div className="text-xs text-muted-foreground">{c.company}</div>}
                  </div>
                </div>
                <Badge variant="outline" className={`text-[10px] border-0 ${c.type === "client" ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-400"}`}>
                  {c.type === "client" ? "Client" : "Fournisseur"}
                </Badge>
              </div>

              <div className="mt-3 space-y-1">
                {c.email && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="size-3" />{c.email}</div>}
                {c.phone && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="size-3" />{c.phone}</div>}
                {c.city && <div className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="size-3" />{c.city} {c.postalCode}</div>}
              </div>

              {c.type === "client" && (
                <div className="mt-3 pt-3 border-t border-border/50 flex justify-between text-xs">
                  <span className="text-muted-foreground">Devisé: <span className="text-foreground font-medium">{formatCurrency(c.totalQuoted)}</span></span>
                  <span className="text-muted-foreground">Facturé: <span className="text-foreground font-medium">{formatCurrency(c.totalBilled)}</span></span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card className="md:col-span-3"><CardContent className="py-8 text-center text-muted-foreground">Aucun contact trouvé</CardContent></Card>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouveau contact</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="fournisseur">Fournisseur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Catégorie</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="particulier">Particulier</SelectItem>
                    <SelectItem value="professionnel">Professionnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.category === "professionnel" || form.type === "fournisseur" ? (
              <div>
                <Label>Raison sociale *</Label>
                <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Nom de l'entreprise" required />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prénom</Label>
                <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div>
                <Label>Nom</Label>
                <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
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
            {(form.category === "professionnel" || form.type === "fournisseur") && (
              <div>
                <Label>SIRET</Label>
                <Input value={form.siret} onChange={e => setForm(f => ({ ...f, siret: e.target.value }))} placeholder="XXX XXX XXX XXXXX" />
              </div>
            )}
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMut.isPending} data-testid="btn-submit-contact">
                {createMut.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

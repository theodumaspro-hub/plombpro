import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { db } from "@/lib/supabaseData";
import { formatCurrency, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Phone, Mail, Wrench, Truck, HardHat, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const typeIcons: Record<string, any> = {
  employe: HardHat, interimaire: Users2, sous_traitant: Wrench, materiel: Truck,
};
const typeLabels: Record<string, string> = {
  employe: "Employé", interimaire: "Intérimaire", sous_traitant: "Sous-traitant", materiel: "Matériel",
};
const typeColors: Record<string, string> = {
  employe: "bg-primary/15 text-primary", interimaire: "bg-amber-500/15 text-amber-400",
  sous_traitant: "bg-violet-500/15 text-violet-400", materiel: "bg-blue-500/15 text-blue-400",
};

export default function RessourcesPage() {
  const [location, setLocation] = useLocation();
  const shouldAutoOpen = typeof window !== 'undefined' && window.location.hash === '#/ressources/nouveau';
  const [open, setOpen] = useState(shouldAutoOpen);

  useEffect(() => {
    if (shouldAutoOpen) {
      setLocation("/ressources", { replace: true });
    }
  }, []);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const { toast } = useToast();

  const { data: resources = [] } = useQuery<any[]>({ queryKey: ["resources"], queryFn: () => db.getResources() });

  const [form, setForm] = useState({
    type: "employe", name: "", role: "", phone: "", email: "",
    hourly_rate: "", status: "actif", skills: "", company: "", siret: "",
    category: "", serial_number: "",
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => db.createResource(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      setOpen(false);
      toast({ title: "Ressource créée" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMut.mutate({
      type: form.type, name: form.name, role: form.role || null,
      phone: form.phone || null, email: form.email || null,
      hourly_rate: form.hourly_rate || null, status: form.status,
      skills: form.skills || null, company: form.company || null,
      siret: form.siret || null, category: form.category || null,
      serial_number: form.serial_number || null,
    });
  }

  const filtered = resources.filter(r => {
    if (tab !== "all" && r.type !== tab) return false;
    if (search) {
      const term = search.toLowerCase();
      return r.name.toLowerCase().includes(term) || (r.role || "").toLowerCase().includes(term) || (r.company || "").toLowerCase().includes(term);
    }
    return true;
  });

  const counts = {
    all: resources.length,
    employe: resources.filter(r => r.type === "employe").length,
    sous_traitant: resources.filter(r => r.type === "sous_traitant").length,
    materiel: resources.filter(r => r.type === "materiel").length,
  };

  return (
    <AppLayout
      title="Ressources"
      actions={
        <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setOpen(true)} data-testid="btn-new-resource">
          <Plus className="size-3.5" /> Ajouter
        </Button>
      }
    >
      <Tabs value={tab} onValueChange={setTab} className="mb-4">
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs h-7">Tous ({counts.all})</TabsTrigger>
          <TabsTrigger value="employe" className="text-xs h-7">Employés ({counts.employe})</TabsTrigger>
          <TabsTrigger value="sous_traitant" className="text-xs h-7">Sous-traitants ({counts.sous_traitant})</TabsTrigger>
          <TabsTrigger value="materiel" className="text-xs h-7">Matériels ({counts.materiel})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(r => {
          const Icon = typeIcons[r.type] || HardHat;
          return (
            <Card key={r.id} className="hover:bg-muted/20 transition-colors" data-testid={`resource-card-${r.id}`}>
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`size-10 rounded-full flex items-center justify-center ${typeColors[r.type]}`} style={r.color ? { borderLeft: `3px solid ${r.color}` } : {}}>
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{r.name}</div>
                      {r.role && <div className="text-xs text-muted-foreground">{r.role}</div>}
                      {r.company && <div className="text-xs text-muted-foreground">{r.company}</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={r.status} />
                    <Badge variant="outline" className={`text-[10px] border-0 ${typeColors[r.type]}`}>{typeLabels[r.type]}</Badge>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  {r.phone && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="size-3" />{r.phone}</div>}
                  {r.email && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="size-3" />{r.email}</div>}
                  {r.hourly_rate && <div className="text-xs text-muted-foreground">Taux horaire: <span className="text-foreground font-medium">{formatCurrency(r.hourly_rate)}/h</span></div>}
                  {r.category && <div className="text-xs text-muted-foreground">Catégorie: {r.category}</div>}
                  {r.serial_number && <div className="text-xs text-muted-foreground">N° série: {r.serial_number}</div>}
                  {r.next_maintenance_date && <div className="text-xs text-muted-foreground">Proch. maintenance: {formatDate(r.next_maintenance_date)}</div>}
                  {r.certifications && <div className="text-xs text-muted-foreground mt-1">{r.certifications}</div>}
                  {r.assurance_expiry && <div className="text-xs text-muted-foreground">Assurance exp.: {formatDate(r.assurance_expiry)}</div>}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="md:col-span-3"><CardContent className="py-8 text-center text-muted-foreground">Aucune ressource trouvée</CardContent></Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle ressource</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employe">Employé</SelectItem>
                    <SelectItem value="interimaire">Intérimaire</SelectItem>
                    <SelectItem value="sous_traitant">Sous-traitant</SelectItem>
                    <SelectItem value="materiel">Matériel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="actif">Actif</SelectItem>
                    <SelectItem value="inactif">Inactif</SelectItem>
                    <SelectItem value="en_mission">En mission</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Nom *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            {form.type !== "materiel" && (
              <>
                <div><Label>Rôle / Poste</Label><Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Téléphone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                  <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                </div>
                <div><Label>Taux horaire (€/h)</Label><Input type="number" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))} /></div>
                <div><Label>Compétences</Label><Input value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))} placeholder="Ex: Plomberie, Chauffage, PAC" /></div>
              </>
            )}
            {form.type === "sous_traitant" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Entreprise</Label><Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></div>
                <div><Label>SIRET</Label><Input value={form.siret} onChange={e => setForm(f => ({ ...f, siret: e.target.value }))} /></div>
              </div>
            )}
            {form.type === "materiel" && (
              <>
                <div><Label>Catégorie</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="véhicule">Véhicule</SelectItem>
                      <SelectItem value="outillage">Outillage</SelectItem>
                      <SelectItem value="machine">Machine</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>N° série</Label><Input value={form.serial_number} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} /></div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMut.isPending || !form.name} data-testid="btn-submit-resource">
                {createMut.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

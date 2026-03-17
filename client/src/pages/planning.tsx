import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { contactName } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { Plus, MapPin, Clock, User, ChevronLeft, ChevronRight } from "lucide-react";
import type { Appointment, Contact, Resource, Chantier } from "@shared/schema";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const HOURS = ["07:00", "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

export default function PlanningPage() {
  const [location, setLocation] = useLocation();
  const shouldAutoOpen = typeof window !== 'undefined' && window.location.hash === '#/planning/nouveau';
  const [open, setOpen] = useState(shouldAutoOpen);

  useEffect(() => {
    if (shouldAutoOpen) {
      setLocation("/planning", { replace: true });
    }
  }, []);
  const { toast } = useToast();

  const { data: appointments = [] } = useQuery<Appointment[]>({ queryKey: ["/api/appointments"] });
  const { data: contacts = [] } = useQuery<Contact[]>({ queryKey: ["/api/contacts"] });
  const { data: resources = [] } = useQuery<Resource[]>({ queryKey: ["/api/resources"] });
  const { data: chantiers = [] } = useQuery<Chantier[]>({ queryKey: ["/api/chantiers"] });
  const contactMap = new Map(contacts.map(c => [c.id, c]));
  const resourceMap = new Map(resources.map(r => [r.id, r]));
  const people = resources.filter(r => r.type !== "materiel");

  const [form, setForm] = useState({
    title: "", type: "intervention", date: "", startTime: "08:00", endTime: "17:00",
    resourceId: "", contactId: "", chantierId: "", address: "", city: "", notes: "",
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/appointments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setOpen(false);
      toast({ title: "Rendez-vous créé" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMut.mutate({
      ...form,
      resourceId: form.resourceId ? Number(form.resourceId) : null,
      contactId: form.contactId ? Number(form.contactId) : null,
      chantierId: form.chantierId ? Number(form.chantierId) : null,
      status: "planifié",
      address: form.address || null,
      city: form.city || null,
      notes: form.notes || null,
    });
  }

  // Group by date
  const grouped = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    if (!acc[a.date]) acc[a.date] = [];
    acc[a.date].push(a);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  const typeColors: Record<string, string> = {
    intervention: "border-l-primary bg-primary/5",
    visite_technique: "border-l-blue-400 bg-blue-500/5",
    reunion: "border-l-violet-400 bg-violet-500/5",
    livraison: "border-l-amber-400 bg-amber-500/5",
    rdv_client: "border-l-emerald-400 bg-emerald-500/5",
  };
  const typeLabels: Record<string, string> = {
    intervention: "Intervention", visite_technique: "Visite technique",
    reunion: "Réunion", livraison: "Livraison", rdv_client: "RDV Client",
  };

  return (
    <AppLayout
      title="Planning"
      actions={
        <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setOpen(true)} data-testid="btn-new-appointment">
          <Plus className="size-3.5" /> Nouveau RDV
        </Button>
      }
    >
      {/* Timeline View */}
      <div className="space-y-6">
        {sortedDates.map(date => {
          const dayAppts = grouped[date];
          const d = new Date(date);
          const dayName = d.toLocaleDateString("fr-FR", { weekday: "long" });
          const dateStr = d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
          const isToday = date === new Date().toISOString().split("T")[0];

          return (
            <div key={date}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`px-3 py-1 rounded-md text-sm font-medium ${isToday ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                  {dayName.charAt(0).toUpperCase() + dayName.slice(1)}
                </div>
                <span className="text-sm text-muted-foreground">{dateStr}</span>
                <span className="text-xs text-muted-foreground">({dayAppts.length} RDV)</span>
              </div>

              <div className="grid gap-2 pl-4 border-l-2 border-border ml-2">
                {dayAppts.sort((a, b) => a.startTime.localeCompare(b.startTime)).map(appt => {
                  const r = appt.resourceId ? resourceMap.get(appt.resourceId) : null;
                  const c = appt.contactId ? contactMap.get(appt.contactId) : null;

                  return (
                    <Card key={appt.id} className={`border-l-4 ${typeColors[appt.type] || "border-l-muted"}`} data-testid={`appointment-card-${appt.id}`}>
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Clock className="size-3 text-muted-foreground" />
                              <span className="text-xs font-medium">{appt.startTime} — {appt.endTime}</span>
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{typeLabels[appt.type] || appt.type}</span>
                            </div>
                            <h3 className="text-sm font-medium mt-1">{appt.title}</h3>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {r && <span className="flex items-center gap-1"><User className="size-3" />{r.name}</span>}
                              {c && <span>{contactName(c)}</span>}
                              {appt.city && <span className="flex items-center gap-1"><MapPin className="size-3" />{appt.city}</span>}
                            </div>
                          </div>
                          <StatusBadge status={appt.status} />
                        </div>
                        {appt.notes && <p className="text-xs text-muted-foreground mt-2">{appt.notes}</p>}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
        {sortedDates.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Aucun rendez-vous planifié</CardContent></Card>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouveau rendez-vous</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Titre *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="intervention">Intervention</SelectItem>
                    <SelectItem value="visite_technique">Visite technique</SelectItem>
                    <SelectItem value="reunion">Réunion</SelectItem>
                    <SelectItem value="livraison">Livraison</SelectItem>
                    <SelectItem value="rdv_client">RDV Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Début</Label><Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} /></div>
              <div><Label>Fin</Label><Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Technicien</Label>
              <Select value={form.resourceId} onValueChange={v => setForm(f => ({ ...f, resourceId: v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  {people.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name} — {r.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={form.contactId} onValueChange={v => setForm(f => ({ ...f, contactId: v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  {contacts.filter(c => c.type === "client").map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{contactName(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Adresse</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div><Label>Ville</Label><Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMut.isPending || !form.title || !form.date} data-testid="btn-submit-appointment">
                {createMut.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

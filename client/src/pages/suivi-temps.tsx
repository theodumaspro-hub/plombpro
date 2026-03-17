import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { db } from "@/lib/supabaseData";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Plus, Clock, Download, Check, X, Filter } from "lucide-react";
import type { TimeEntry, Resource, Chantier } from "@shared/schema";

function calcDuration(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}

const TYPE_LABELS: Record<string, string> = {
  intervention: "Intervention",
  deplacement: "Déplacement",
  administratif: "Administratif",
  pause: "Pause",
};

export default function SuiviTempsPage() {
  const [open, setOpen] = useState(false);
  const [filterResource, setFilterResource] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const { toast } = useToast();

  const { data: entries = [] } = useQuery<any[]>({ queryKey: ["time-entries"], queryFn: () => db.getTimeEntries() });
  const { data: resources = [] } = useQuery<any[]>({ queryKey: ["resources"], queryFn: () => db.getResources() });
  const { data: chantiers = [] } = useQuery<any[]>({ queryKey: ["chantiers"], queryFn: () => db.getChantiers() });
  const resourceMap = new Map(resources.map(r => [r.id, r]));
  const chantierMap = new Map(chantiers.map(c => [c.id, c]));
  const people = resources.filter(r => r.type !== "materiel");

  const [form, setForm] = useState({
    resource_id: "", chantier_id: "", date: "", start_time: "08:00", end_time: "17:00",
    type: "intervention", description: "", billable: true,
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => db.createTimeEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      setOpen(false);
      toast({ title: "Saisie enregistrée" });
      setForm({ resource_id: "", chantier_id: "", date: "", start_time: "08:00", end_time: "17:00", type: "intervention", description: "", billable: true });
    },
  });

  const validateMut = useMutation({
    mutationFn: async ({ id, validated }: { id: number; validated: boolean }) =>
      db.updateTimeEntry(id, { validated }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      toast({ title: "Statut mis à jour" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dur = calcDuration(form.start_time, form.end_time);
    createMut.mutate({
      resource_id: Number(form.resource_id),
      chantier_id: form.chantier_id ? Number(form.chantier_id) : null,
      appointment_id: null,
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time,
      duration: String(dur.toFixed(2)),
      type: form.type,
      description: form.description || null,
      billable: form.billable,
      validated: false,
    });
  }

  // Filtering
  const filtered = entries.filter(e => {
    if (filterResource !== "all" && String(e.resource_id) !== filterResource) return false;
    if (filterType !== "all" && e.type !== filterType) return false;
    if (filterDateFrom && e.date < filterDateFrom) return false;
    if (filterDateTo && e.date > filterDateTo) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date) || b.start_time.localeCompare(a.start_time));

  // Summary stats
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  const mondayStr = monday.toISOString().split("T")[0];
  const weekEntries = entries.filter(e => e.date >= mondayStr);
  const totalWeekHours = weekEntries.reduce((s, e) => s + parseFloat(e.duration || "0"), 0);
  const billableHours = weekEntries.filter(e => e.billable).reduce((s, e) => s + parseFloat(e.duration || "0"), 0);
  const nonBillableHours = weekEntries.filter(e => !e.billable).reduce((s, e) => s + parseFloat(e.duration || "0"), 0);
  const toValidateHours = entries.filter(e => !e.validated).reduce((s, e) => s + parseFloat(e.duration || "0"), 0);

  const formDuration = calcDuration(form.start_time, form.end_time);

  return (
    <AppLayout
      title="Suivi du temps"
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2 h-8 text-xs"
            onClick={() => toast({ title: "Export lancé", description: "Le fichier CSV sera téléchargé sous peu." })}
            data-testid="btn-export-time"
          >
            <Download className="size-3.5" /> Exporter
          </Button>
          <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setOpen(true)} data-testid="btn-new-time-entry">
            <Plus className="size-3.5" /> Nouvelle saisie
          </Button>
        </div>
      }
    >
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-xs text-muted-foreground">Total heures semaine</div>
            <div className="text-lg font-bold mt-1 tabular-nums lining-nums">{totalWeekHours.toFixed(1)} h</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-xs text-muted-foreground">Heures facturables</div>
            <div className="text-lg font-bold mt-1 text-emerald-400 tabular-nums lining-nums">{billableHours.toFixed(1)} h</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-xs text-muted-foreground">Heures non-facturables</div>
            <div className="text-lg font-bold mt-1 text-amber-400 tabular-nums lining-nums">{nonBillableHours.toFixed(1)} h</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-xs text-muted-foreground">Heures à valider</div>
            <div className="text-lg font-bold mt-1 text-blue-400 tabular-nums lining-nums">{toValidateHours.toFixed(1)} h</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Filter className="size-3.5 text-muted-foreground" />
        <Select value={filterResource} onValueChange={setFilterResource}>
          <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue placeholder="Technicien" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les techniciens</SelectItem>
            {people.map(r => (
              <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="intervention">Intervention</SelectItem>
            <SelectItem value="deplacement">Déplacement</SelectItem>
            <SelectItem value="administratif">Administratif</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={filterDateFrom}
          onChange={e => setFilterDateFrom(e.target.value)}
          className="w-[140px] h-8 text-xs"
          placeholder="Du"
          data-testid="filter-date-from"
        />
        <Input
          type="date"
          value={filterDateTo}
          onChange={e => setFilterDateTo(e.target.value)}
          className="w-[140px] h-8 text-xs"
          placeholder="Au"
          data-testid="filter-date-to"
        />
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2.5 px-4 font-medium">Date</th>
                <th className="py-2.5 px-4 font-medium">Technicien</th>
                <th className="py-2.5 px-4 font-medium">Chantier</th>
                <th className="py-2.5 px-4 font-medium">Horaires</th>
                <th className="py-2.5 px-4 font-medium text-right">Durée</th>
                <th className="py-2.5 px-4 font-medium">Type</th>
                <th className="py-2.5 px-4 font-medium text-center">Facturable</th>
                <th className="py-2.5 px-4 font-medium text-center">Validé</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(entry => {
                const r = resourceMap.get(entry.resource_id);
                const ch = entry.chantier_id ? chantierMap.get(entry.chantier_id) : null;
                return (
                  <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`time-entry-row-${entry.id}`}>
                    <td className="py-2.5 px-4 text-xs">{formatDate(entry.date)}</td>
                    <td className="py-2.5 px-4">
                      {r ? (
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full flex items-center justify-center text-[10px] font-semibold bg-primary/15 text-primary">
                            {r.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2)}
                          </div>
                          <span className="text-xs">{r.name}</span>
                        </div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground">{ch ? ch.reference : "—"}</td>
                    <td className="py-2.5 px-4 text-xs tabular-nums lining-nums">{entry.start_time} — {entry.end_time}</td>
                    <td className="py-2.5 px-4 text-right font-medium text-xs tabular-nums lining-nums">{parseFloat(entry.duration || "0").toFixed(1)} h</td>
                    <td className="py-2.5 px-4">
                      <Badge variant="outline" className="text-[10px] border-0 bg-muted text-muted-foreground">
                        {TYPE_LABELS[entry.type] || entry.type}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {entry.billable ? (
                        <Check className="size-3.5 text-emerald-400 mx-auto" />
                      ) : (
                        <X className="size-3.5 text-muted-foreground mx-auto" />
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => validateMut.mutate({ id: entry.id, validated: !entry.validated })}
                        className="inline-flex items-center justify-center"
                        data-testid={`toggle-validated-${entry.id}`}
                      >
                        {entry.validated ? (
                          <Check className="size-3.5 text-emerald-400" />
                        ) : (
                          <div className="size-3.5 rounded border border-muted-foreground/40" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Aucune saisie de temps</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouvelle saisie de temps</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Technicien *</Label>
              <Select value={form.resource_id} onValueChange={v => setForm(f => ({ ...f, resource_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {people.map(r => (
                    <SelectItem key={r.id} value={String(r.id)}>{r.name} — {r.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chantier</Label>
              <Select value={form.chantier_id} onValueChange={v => setForm(f => ({ ...f, chantier_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {chantiers.map(ch => (
                    <SelectItem key={ch.id} value={String(ch.id)}>{ch.reference} — {ch.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required data-testid="input-time-date" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Début</Label><Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} data-testid="input-time-start" /></div>
              <div><Label>Fin</Label><Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} data-testid="input-time-end" /></div>
            </div>
            {form.start_time && form.end_time && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="size-3" />
                Durée calculée : <span className="font-medium text-foreground tabular-nums lining-nums">{formDuration.toFixed(1)} h</span>
              </div>
            )}
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="intervention">Intervention</SelectItem>
                  <SelectItem value="deplacement">Déplacement</SelectItem>
                  <SelectItem value="administratif">Administratif</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, billable: !f.billable }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${form.billable ? "bg-emerald-500" : "bg-muted"}`}
                data-testid="toggle-billable"
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.billable ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <Label className="cursor-pointer" onClick={() => setForm(f => ({ ...f, billable: !f.billable }))}>
                Facturable
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMut.isPending || !form.resource_id || !form.date} data-testid="btn-submit-time-entry">
                {createMut.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

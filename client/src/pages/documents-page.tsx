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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { db } from "@/lib/supabaseData";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, FileText, Image, FileSpreadsheet, File, Trash2,
  LayoutGrid, List, Search, Camera, ClipboardList, Map,
} from "lucide-react";
import type { Document as DocType } from "@shared/schema";

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function fileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="size-5 text-muted-foreground" />;
  if (mimeType.startsWith("image/")) return <Image className="size-5 text-blue-400" />;
  if (mimeType.includes("pdf")) return <FileText className="size-5 text-red-400" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return <FileSpreadsheet className="size-5 text-emerald-400" />;
  return <File className="size-5 text-muted-foreground" />;
}

const TYPE_LABELS: Record<string, string> = {
  devis: "Devis",
  facture: "Facture",
  chantier: "Chantier",
  photo: "Photo",
  attestation: "Attestation",
  autre: "Autre",
};

const CATEGORY_LABELS: Record<string, string> = {
  technique: "Technique",
  administratif: "Administratif",
  photo: "Photo",
  plan: "Plan",
};

export default function DocumentsPage() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: documents = [] } = useQuery<any[]>({ queryKey: ["documents"], queryFn: () => db.getDocuments() });

  const [form, setForm] = useState({
    name: "", type: "autre", category: "technique", relatedType: "", relatedId: "", notes: "",
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => db.createDocument(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      setOpen(false);
      toast({ title: "Document ajouté" });
      setForm({ name: "", type: "autre", category: "technique", relatedType: "", relatedId: "", notes: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => db.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document supprimé" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const mimeTypes: Record<string, string> = {
      devis: "application/pdf", facture: "application/pdf",
      photo: "image/jpeg", attestation: "application/pdf",
      chantier: "application/pdf", autre: "application/octet-stream",
    };
    createMut.mutate({
      name: form.name,
      type: form.type,
      category: form.category || null,
      related_type: form.relatedType || null,
      related_id: form.relatedId ? Number(form.relatedId) : null,
      size: Math.floor(Math.random() * 3000000) + 50000,
      mime_type: mimeTypes[form.type] || "application/octet-stream",
      url: `/docs/${form.name.toLowerCase().replace(/\s/g, "-")}`,
      notes: form.notes || null,
      uploaded_by: "Lucas Martin",
    });
  }

  // Filtering
  const filtered = documents.filter(d => {
    if (filterType !== "all" && d.type !== filterType) return false;
    if (search) {
      const term = search.toLowerCase();
      return d.name.toLowerCase().includes(term) || (d.notes || "").toLowerCase().includes(term);
    }
    return true;
  });

  // Summary stats
  const totalDocs = documents.length;
  const photoCount = documents.filter(d => d.type === "photo").length;
  const adminCount = documents.filter(d => d.category === "administratif").length;
  const planCount = documents.filter(d => d.category === "plan").length;

  return (
    <AppLayout
      title="Documents"
      actions={
        <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setOpen(true)} data-testid="btn-new-document">
          <Plus className="size-3.5" /> Ajouter un document
        </Button>
      }
    >
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">Total documents</div>
                <div className="text-lg font-bold mt-0.5 tabular-nums lining-nums">{totalDocs}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Camera className="size-4 text-blue-400" />
              <div>
                <div className="text-xs text-muted-foreground">Photos</div>
                <div className="text-lg font-bold mt-0.5 tabular-nums lining-nums">{photoCount}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-amber-400" />
              <div>
                <div className="text-xs text-muted-foreground">Administratif</div>
                <div className="text-lg font-bold mt-0.5 tabular-nums lining-nums">{adminCount}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2">
              <Map className="size-4 text-emerald-400" />
              <div>
                <div className="text-xs text-muted-foreground">Plans</div>
                <div className="text-lg font-bold mt-0.5 tabular-nums lining-nums">{planCount}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher un document..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" data-testid="input-search-documents" />
        </div>
        <Tabs value={filterType} onValueChange={setFilterType}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs h-7">Tous</TabsTrigger>
            <TabsTrigger value="devis" className="text-xs h-7">Devis</TabsTrigger>
            <TabsTrigger value="facture" className="text-xs h-7">Factures</TabsTrigger>
            <TabsTrigger value="photo" className="text-xs h-7">Photos</TabsTrigger>
            <TabsTrigger value="attestation" className="text-xs h-7">Attestations</TabsTrigger>
            <TabsTrigger value="autre" className="text-xs h-7">Autre</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant={view === "grid" ? "default" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setView("grid")}
            data-testid="btn-view-grid"
          >
            <LayoutGrid className="size-3.5" />
          </Button>
          <Button
            variant={view === "list" ? "default" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setView("list")}
            data-testid="btn-view-list"
          >
            <List className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Grid View */}
      {view === "grid" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(doc => (
            <Card key={doc.id} className="hover:bg-muted/20 transition-colors group" data-testid={`document-card-${doc.id}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-muted/50 flex items-center justify-center">
                      {fileIcon(doc.mime_type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{doc.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{formatFileSize(doc.size)}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-400"
                    onClick={() => deleteMut.mutate(doc.id)}
                    data-testid={`btn-delete-doc-${doc.id}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className="text-[10px] border-0 bg-muted text-muted-foreground">
                    {TYPE_LABELS[doc.type] || doc.type}
                  </Badge>
                  {doc.category && (
                    <Badge variant="outline" className="text-[10px] border-0 bg-primary/10 text-primary">
                      {CATEGORY_LABELS[doc.category] || doc.category}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>{doc.uploaded_by}</span>
                  <span>{formatDate(doc.created_at ? new Date(doc.created_at).toISOString() : null)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <Card className="md:col-span-3"><CardContent className="py-8 text-center text-muted-foreground">Aucun document trouvé</CardContent></Card>
          )}
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2.5 px-4 font-medium">Nom</th>
                  <th className="py-2.5 px-4 font-medium">Type</th>
                  <th className="py-2.5 px-4 font-medium">Catégorie</th>
                  <th className="py-2.5 px-4 font-medium text-right">Taille</th>
                  <th className="py-2.5 px-4 font-medium">Uploadé par</th>
                  <th className="py-2.5 px-4 font-medium">Date</th>
                  <th className="py-2.5 px-4 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(doc => (
                  <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`document-row-${doc.id}`}>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        {fileIcon(doc.mime_type)}
                        <span className="text-sm font-medium">{doc.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge variant="outline" className="text-[10px] border-0 bg-muted text-muted-foreground">
                        {TYPE_LABELS[doc.type] || doc.type}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground">{doc.category ? (CATEGORY_LABELS[doc.category] || doc.category) : "—"}</td>
                    <td className="py-2.5 px-4 text-right text-xs tabular-nums lining-nums">{formatFileSize(doc.size)}</td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground">{doc.uploaded_by || "—"}</td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground">{formatDate(doc.created_at ? new Date(doc.created_at).toISOString() : null)}</td>
                    <td className="py-2.5 px-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-400"
                        onClick={() => deleteMut.mutate(doc.id)}
                        data-testid={`btn-delete-doc-list-${doc.id}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Aucun document trouvé</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Ajouter un document</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nom du document *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="ex: Facture FAC-2026-005.pdf" required data-testid="input-doc-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="devis">Devis</SelectItem>
                    <SelectItem value="facture">Facture</SelectItem>
                    <SelectItem value="chantier">Chantier</SelectItem>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="attestation">Attestation</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Catégorie</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technique">Technique</SelectItem>
                    <SelectItem value="administratif">Administratif</SelectItem>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="plan">Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Lié à (type)</Label>
                <Select value={form.relatedType} onValueChange={v => setForm(f => ({ ...f, relatedType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucun</SelectItem>
                    <SelectItem value="quote">Devis</SelectItem>
                    <SelectItem value="invoice">Facture</SelectItem>
                    <SelectItem value="chantier">Chantier</SelectItem>
                    <SelectItem value="contact">Contact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>ID lié</Label>
                <Input type="number" value={form.relatedId} onChange={e => setForm(f => ({ ...f, relatedId: e.target.value }))} placeholder="Optionnel" />
              </div>
            </div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createMut.isPending || !form.name} data-testid="btn-submit-document">
                {createMut.isPending ? "Ajout..." : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

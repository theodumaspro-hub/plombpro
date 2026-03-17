import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { db } from "@/lib/supabaseData";
import { formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Key, Webhook, Plus, Trash2, Ban, Play, Pause, Copy, Code2, ExternalLink, AlertTriangle } from "lucide-react";
import type { ApiKey, Webhook as WebhookType } from "@shared/schema";

const API_PERMISSIONS = [
  { value: "read:quotes", label: "Lire devis" },
  { value: "write:quotes", label: "Écrire devis" },
  { value: "read:invoices", label: "Lire factures" },
  { value: "write:invoices", label: "Écrire factures" },
  { value: "read:contacts", label: "Lire contacts" },
  { value: "write:contacts", label: "Écrire contacts" },
  { value: "read:chantiers", label: "Lire chantiers" },
  { value: "write:chantiers", label: "Écrire chantiers" },
  { value: "read:all", label: "Lecture totale" },
  { value: "write:all", label: "Écriture totale" },
] as const;

const WEBHOOK_EVENTS = [
  { value: "invoice.created", label: "Facture créée" },
  { value: "invoice.paid", label: "Facture payée" },
  { value: "invoice.overdue", label: "Facture en retard" },
  { value: "quote.created", label: "Devis créé" },
  { value: "quote.signed", label: "Devis signé" },
  { value: "chantier.updated", label: "Chantier mis à jour" },
  { value: "payment.received", label: "Paiement reçu" },
] as const;

const API_DOC_EXAMPLES = [
  { method: "GET", path: "/api/quotes", desc: "Liste des devis" },
  { method: "POST", path: "/api/invoices", desc: "Créer une facture" },
  { method: "GET", path: "/api/contacts", desc: "Liste des contacts" },
  { method: "GET", path: "/api/chantiers", desc: "Liste des chantiers" },
  { method: "PATCH", path: "/api/invoices/:id", desc: "Modifier une facture" },
  { method: "GET", path: "/api/export/fec", desc: "Export FEC comptable" },
];

function genHex(len: number): string {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function maskKey(key: string): string {
  if (key.length <= 8) return key;
  return "••••••••••••" + key.slice(-4);
}

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

export default function IntegrationsPage() {
  const { toast } = useToast();

  // ─── API Keys state ─────────────────────
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [keyForm, setKeyForm] = useState({ name: "", expires_at: "", permissions: [] as string[] });

  const { data: apiKeys = [] } = useQuery<any[]>({
    queryKey: ["api-keys"],
    queryFn: () => db.getApiKeys(),
  });

  const createKeyMut = useMutation({
    mutationFn: async (data: any) => db.createApiKey({
      name: data.name,
      key: data.key,
      permissions: data.permissions,
      expires_at: data.expires_at || null,
      status: data.status,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setKeyDialogOpen(false);
      setKeyForm({ name: "", expires_at: "", permissions: [] });
      toast({ title: "Clé API créée" });
    },
  });

  const revokeKeyMut = useMutation({
    mutationFn: async (id: number) => db.updateApiKey(id, { status: "revoked" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "Clé révoquée" });
    },
  });

  const deleteKeyMut = useMutation({
    mutationFn: async (id: number) => db.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast({ title: "Clé supprimée" });
    },
  });

  function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    createKeyMut.mutate({
      name: keyForm.name,
      key: `ppro_live_${genHex(24)}`,
      permissions: JSON.stringify(keyForm.permissions),
      expires_at: keyForm.expires_at || null,
      status: "active",
    });
  }

  function toggleKeyPermission(perm: string) {
    setKeyForm(f => ({
      ...f,
      permissions: f.permissions.includes(perm)
        ? f.permissions.filter(p => p !== perm)
        : [...f.permissions, perm],
    }));
  }

  // ─── Webhooks state ─────────────────────
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ name: "", url: "", events: [] as string[] });

  const { data: webhooks = [] } = useQuery<any[]>({
    queryKey: ["webhooks"],
    queryFn: () => db.getWebhooks(),
  });

  const createWebhookMut = useMutation({
    mutationFn: async (data: any) => db.createWebhook({
      name: data.name,
      url: data.url,
      events: data.events,
      secret: data.secret,
      status: data.status,
      failure_count: data.failure_count,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      setWebhookDialogOpen(false);
      setWebhookForm({ name: "", url: "", events: [] });
      toast({ title: "Webhook créé" });
    },
  });

  const toggleWebhookMut = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => db.updateWebhook(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast({ title: "Webhook mis à jour" });
    },
  });

  const deleteWebhookMut = useMutation({
    mutationFn: async (id: number) => db.deleteWebhook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast({ title: "Webhook supprimé" });
    },
  });

  function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    createWebhookMut.mutate({
      name: webhookForm.name,
      url: webhookForm.url,
      events: JSON.stringify(webhookForm.events),
      secret: `whsec_${genHex(32)}`,
      status: "active",
      failure_count: 0,
    });
  }

  function toggleWebhookEvent(evt: string) {
    setWebhookForm(f => ({
      ...f,
      events: f.events.includes(evt)
        ? f.events.filter(e => e !== evt)
        : [...f.events, evt],
    }));
  }

  return (
    <AppLayout title="Intégrations & API">
      <Tabs defaultValue="api-keys" className="space-y-4">
        <TabsList className="h-9">
          <TabsTrigger value="api-keys" className="text-xs h-8 gap-1.5"><Key className="size-3.5" /> Clés API</TabsTrigger>
          <TabsTrigger value="webhooks" className="text-xs h-8 gap-1.5"><Webhook className="size-3.5" /> Webhooks</TabsTrigger>
        </TabsList>

        {/* ═══════════════ API Keys Tab ═══════════════ */}
        <TabsContent value="api-keys" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Clés API</h2>
              <p className="text-xs text-muted-foreground">Gérez vos clés d'accès à l'API PlombPro</p>
            </div>
            <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setKeyDialogOpen(true)} data-testid="btn-new-api-key">
              <Plus className="size-3.5" /> Nouvelle clé
            </Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2.5 px-4 font-medium">Nom</th>
                    <th className="py-2.5 px-4 font-medium">Clé</th>
                    <th className="py-2.5 px-4 font-medium">Permissions</th>
                    <th className="py-2.5 px-4 font-medium">Dernier usage</th>
                    <th className="py-2.5 px-4 font-medium">Statut</th>
                    <th className="py-2.5 px-4 font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((k: any) => {
                    const perms = parseJsonArray(k.permissions);
                    return (
                      <tr key={k.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`api-key-row-${k.id}`}>
                        <td className="py-2.5 px-4 font-medium">{k.name}</td>
                        <td className="py-2.5 px-4">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{maskKey(k.key)}</code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-1"
                            onClick={() => { navigator.clipboard.writeText(k.key); toast({ title: "Clé copiée" }); }}
                            data-testid={`copy-key-${k.id}`}
                          >
                            <Copy className="size-3" />
                          </Button>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {perms.slice(0, 3).map(p => (
                              <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                            ))}
                            {perms.length > 3 && (
                              <Badge variant="outline" className="text-[10px]">+{perms.length - 3}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground">{formatDate(k.last_used_at)}</td>
                        <td className="py-2.5 px-4">
                          {k.status === "active" ? (
                            <Badge variant="outline" className="text-[10px] border-0 bg-emerald-500/15 text-emerald-400">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-0 bg-red-500/15 text-red-400">Révoquée</Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1">
                            {k.status === "active" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-amber-400"
                                onClick={() => revokeKeyMut.mutate(k.id)}
                                data-testid={`revoke-key-${k.id}`}
                              >
                                <Ban className="size-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-400"
                              onClick={() => deleteKeyMut.mutate(k.id)}
                              data-testid={`delete-key-${k.id}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {apiKeys.length === 0 && (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground text-sm">Aucune clé API</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ═══════════════ Webhooks Tab ═══════════════ */}
        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Webhooks</h2>
              <p className="text-xs text-muted-foreground">Recevez des notifications en temps réel sur vos événements</p>
            </div>
            <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setWebhookDialogOpen(true)} data-testid="btn-new-webhook">
              <Plus className="size-3.5" /> Nouveau webhook
            </Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2.5 px-4 font-medium">Nom</th>
                    <th className="py-2.5 px-4 font-medium">URL</th>
                    <th className="py-2.5 px-4 font-medium">Événements</th>
                    <th className="py-2.5 px-4 font-medium">Statut</th>
                    <th className="py-2.5 px-4 font-medium">Dernière exécution</th>
                    <th className="py-2.5 px-4 font-medium">Échecs</th>
                    <th className="py-2.5 px-4 font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map((w: any) => {
                    const events = parseJsonArray(w.events);
                    return (
                      <tr key={w.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`webhook-row-${w.id}`}>
                        <td className="py-2.5 px-4 font-medium">{w.name}</td>
                        <td className="py-2.5 px-4">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono truncate max-w-[200px] inline-block">
                            {w.url.length > 40 ? w.url.slice(0, 40) + "…" : w.url}
                          </code>
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {events.slice(0, 2).map(e => (
                              <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>
                            ))}
                            {events.length > 2 && (
                              <Badge variant="outline" className="text-[10px]">+{events.length - 2}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          {w.status === "active" ? (
                            <Badge variant="outline" className="text-[10px] border-0 bg-emerald-500/15 text-emerald-400">Actif</Badge>
                          ) : w.status === "paused" ? (
                            <Badge variant="outline" className="text-[10px] border-0 bg-amber-500/15 text-amber-400">Pause</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] border-0 bg-red-500/15 text-red-400">Erreur</Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-xs text-muted-foreground">{formatDate(w.last_triggered_at)}</td>
                        <td className="py-2.5 px-4">
                          {(w.failure_count || 0) > 0 ? (
                            <span className="text-xs text-red-400 flex items-center gap-1">
                              <AlertTriangle className="size-3" /> {w.failure_count}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">0</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-1">
                            {w.status === "active" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-amber-400"
                                onClick={() => toggleWebhookMut.mutate({ id: w.id, status: "paused" })}
                                data-testid={`pause-webhook-${w.id}`}
                              >
                                <Pause className="size-3.5" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-emerald-400"
                                onClick={() => toggleWebhookMut.mutate({ id: w.id, status: "active" })}
                                data-testid={`activate-webhook-${w.id}`}
                              >
                                <Play className="size-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-400"
                              onClick={() => deleteWebhookMut.mutate(w.id)}
                              data-testid={`delete-webhook-${w.id}`}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {webhooks.length === 0 && (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground text-sm">Aucun webhook</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── API Documentation Section ─── */}
      <Card className="mt-6">
        <CardContent className="py-4 px-4">
          <div className="flex items-center gap-2 mb-3">
            <Code2 className="size-4 text-primary" />
            <h3 className="text-sm font-semibold">Documentation API</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            L'API PlombPro utilise une authentification par clé API via l'en-tête <code className="bg-muted px-1 py-0.5 rounded">Authorization: Bearer ppro_live_xxx</code>
          </p>
          <div className="space-y-1.5">
            {API_DOC_EXAMPLES.map((ex, i) => (
              <div key={i} className="flex items-center gap-3 text-xs font-mono bg-muted/50 rounded px-3 py-1.5">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono border-0 min-w-[50px] justify-center ${
                    ex.method === "GET" ? "bg-blue-500/15 text-blue-400" :
                    ex.method === "POST" ? "bg-emerald-500/15 text-emerald-400" :
                    "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {ex.method}
                </Badge>
                <code className="text-muted-foreground">{ex.path}</code>
                <span className="text-muted-foreground/60 ml-auto font-sans">{ex.desc}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <ExternalLink className="size-3 text-primary" />
            <span className="text-xs text-primary">Documentation complète disponible dans l'onglet Développeurs</span>
          </div>
        </CardContent>
      </Card>

      {/* ─── Create API Key Dialog ─── */}
      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouvelle clé API</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateKey} className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input
                value={keyForm.name}
                onChange={e => setKeyForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Comptabilité, Mobile..."
                required
                data-testid="input-key-name"
              />
            </div>
            <div>
              <Label>Date d'expiration (optionnel)</Label>
              <Input
                type="date"
                value={keyForm.expires_at}
                onChange={e => setKeyForm(f => ({ ...f, expires_at: e.target.value }))}
                data-testid="input-key-expiry"
              />
            </div>
            <div>
              <Label className="mb-2 block">Permissions</Label>
              <div className="grid grid-cols-2 gap-2">
                {API_PERMISSIONS.map(p => (
                  <label key={p.value} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={keyForm.permissions.includes(p.value)}
                      onCheckedChange={() => toggleKeyPermission(p.value)}
                      data-testid={`perm-${p.value}`}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setKeyDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createKeyMut.isPending || !keyForm.name || keyForm.permissions.length === 0} data-testid="btn-submit-api-key">
                {createKeyMut.isPending ? "Création..." : "Créer la clé"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Create Webhook Dialog ─── */}
      <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nouveau webhook</DialogTitle></DialogHeader>
          <form onSubmit={handleCreateWebhook} className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input
                value={webhookForm.name}
                onChange={e => setWebhookForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Notification Slack..."
                required
                data-testid="input-webhook-name"
              />
            </div>
            <div>
              <Label>URL *</Label>
              <Input
                type="url"
                value={webhookForm.url}
                onChange={e => setWebhookForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
                required
                data-testid="input-webhook-url"
              />
            </div>
            <div>
              <Label className="mb-2 block">Événements</Label>
              <div className="space-y-2">
                {WEBHOOK_EVENTS.map(ev => (
                  <label key={ev.value} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={webhookForm.events.includes(ev.value)}
                      onCheckedChange={() => toggleWebhookEvent(ev.value)}
                      data-testid={`event-${ev.value}`}
                    />
                    <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{ev.value}</code>
                    <span className="text-muted-foreground">{ev.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setWebhookDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createWebhookMut.isPending || !webhookForm.name || !webhookForm.url || webhookForm.events.length === 0} data-testid="btn-submit-webhook">
                {createWebhookMut.isPending ? "Création..." : "Créer le webhook"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

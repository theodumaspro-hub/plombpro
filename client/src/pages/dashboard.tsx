import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/supabaseData";
import { formatCurrency, formatDate, contactName, statusLabel } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  TrendingUp, TrendingDown, Receipt, FileCheck, HardHat,
  Users, Clock, ArrowRight, Plus, AlertTriangle,
  Euro, CreditCard, FileText, Banknote, CircleDollarSign,
} from "lucide-react";
import type { Quote, Invoice, Chantier, Contact } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { data: quotes = [] } = useQuery<Quote[]>({ queryKey: ["quotes"], queryFn: () => db.getQuotes() });
  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ["invoices"], queryFn: () => db.getInvoices() });
  const { data: contacts = [] } = useQuery<Contact[]>({ queryKey: ["contacts"], queryFn: () => db.getContacts() });
  const { data: chantiers = [] } = useQuery<Chantier[]>({ queryKey: ["chantiers"], queryFn: () => db.getChantiers() });

  const contactMap = new Map((contacts || []).map(c => [c.id, c]));

  const statsLoading = !quotes.length && !invoices.length;

  const stats = useMemo(() => {
    const signedQuotes = quotes.filter(q => q.status === "signé");
    const caHT = signedQuotes.reduce((s, q) => s + parseFloat(q.amount_ht || "0"), 0);

    const paidInvoices = invoices.filter(i => i.type !== "avoir");
    const encaissements = paidInvoices.reduce((s, i) => s + parseFloat(i.amount_paid || "0"), 0);

    const totalTTC = paidInvoices.reduce((s, i) => s + parseFloat(i.amount_ttc || "0"), 0);
    const resteAEncaisser = totalTTC - encaissements;

    const overdueInvoices = invoices.filter(i => i.due_date && new Date(i.due_date) < new Date() && i.status === "envoyée");
    const enRetard = overdueInvoices.reduce((s, i) => s + parseFloat(i.amount_ttc || "0"), 0);
    const enRetardCount = overdueInvoices.length;

    const devisEnCours = quotes.filter(q => q.status === "envoyé").length;
    const devisSignes = signedQuotes.length;
    const chantiersActifs = chantiers.filter(c => c.status === "en_cours").length;
    const clientsCount = contacts.filter(c => c.type === "client").length;

    // Monthly data (last 6 months) - simplified
    const now = new Date();
    const monthlyData = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const monthStr = d.toLocaleDateString("fr-FR", { month: "short" });
      const year = d.getFullYear();
      const month = d.getMonth();
      const monthInvoices = invoices.filter(inv => {
        if (!inv.created_at) return false;
        const invDate = new Date(inv.created_at);
        return invDate.getFullYear() === year && invDate.getMonth() === month && inv.type !== "avoir";
      });
      const ca = monthInvoices.reduce((s, i) => s + parseFloat(i.amount_ht || "0"), 0);
      return { month: monthStr, ca, achats: 0 };
    });

    // Unpaid breakdown
    const envoyeeUnpaid = invoices.filter(i => i.status === "envoyée" && i.type !== "avoir").reduce((s, i) => s + parseFloat(i.amount_ttc || "0") - parseFloat(i.amount_paid || "0"), 0);
    const partielleUnpaid = invoices.filter(i => i.status === "partiellement_payée").reduce((s, i) => s + parseFloat(i.amount_ttc || "0") - parseFloat(i.amount_paid || "0"), 0);

    const recentQuotes = [...quotes].sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    }).slice(0, 5);

    const recentInvoices = [...invoices].sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dbi = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dbi - da;
    }).slice(0, 5);

    return {
      caHT, encaissements, resteAEncaisser, enRetard, enRetardCount,
      devisEnCours, devisSignes, chantiersActifs, clientsCount,
      monthlyData,
      unpaidByStatus: { envoyee: envoyeeUnpaid, partielle: partielleUnpaid, enRetard },
      recentQuotes, recentInvoices,
    };
  }, [quotes, invoices, contacts, chantiers]);

  return (
    <AppLayout title="Tableau de bord">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Link href="/devis/nouveau">
          <Button size="sm" className="gap-2 h-8 text-xs" data-testid="btn-new-devis">
            <Plus className="size-3.5" /> Nouveau devis
          </Button>
        </Link>
        <Link href="/factures/nouveau">
          <Button size="sm" variant="secondary" className="gap-2 h-8 text-xs" data-testid="btn-new-facture">
            <Plus className="size-3.5" /> Nouvelle facture
          </Button>
        </Link>
        <Link href="/chantiers/nouveau">
          <Button size="sm" variant="secondary" className="gap-2 h-8 text-xs" data-testid="btn-new-chantier">
            <Plus className="size-3.5" /> Nouveau chantier
          </Button>
        </Link>
        <Link href="/contacts/nouveau">
          <Button size="sm" variant="secondary" className="gap-2 h-8 text-xs" data-testid="btn-new-contact">
            <Plus className="size-3.5" /> Nouveau contact
          </Button>
        </Link>
      </div>

      {/* KPI Cards — Real metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard
          title="CA HT"
          value={statsLoading ? null : formatCurrency(stats.caHT || 0)}
          icon={<Euro className="size-4 text-emerald-400" />}
          sub={`${stats.devisSignes || 0} devis signés`}
        />
        <KPICard
          title="Encaissé"
          value={statsLoading ? null : formatCurrency(stats.encaissements || 0)}
          icon={<Banknote className="size-4 text-blue-400" />}
          sub={`${stats.chantiersActifs || 0} chantiers actifs`}
        />
        <KPICard
          title="Reste à encaisser"
          value={statsLoading ? null : formatCurrency(stats.resteAEncaisser || 0)}
          icon={<Clock className="size-4 text-amber-400" />}
          sub={`${stats.devisEnCours || 0} devis en cours`}
        />
        <KPICard
          title="En retard"
          value={statsLoading ? null : formatCurrency(stats.enRetard || 0)}
          icon={<AlertTriangle className="size-4 text-red-400" />}
          sub={`${stats.enRetardCount || 0} facture${(stats.enRetardCount || 0) > 1 ? "s" : ""}`}
          alert={stats.enRetardCount > 0}
        />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* Bar Chart — Monthly CA */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Chiffre d'affaires mensuel (6 mois)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.monthlyData ? (
              <div className="flex items-end gap-3 h-44">
                {stats.monthlyData.map((m: any, i: number) => {
                  const maxVal = Math.max(...stats.monthlyData.map((d: any) => Math.max(d.ca, d.achats)), 1);
                  const caH = Math.max((m.ca / maxVal) * 150, 2);
                  const achH = Math.max((m.achats / maxVal) * 150, 2);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex items-end gap-1 w-full justify-center" style={{ height: 150 }}>
                        <div className="w-3 rounded-t bg-primary/80 transition-all" style={{ height: caH }} title={`CA: ${formatCurrency(m.ca)}`} />
                        <div className="w-3 rounded-t bg-blue-500/50 transition-all" style={{ height: achH }} title={`Achats: ${formatCurrency(m.achats)}`} />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Skeleton className="h-44 w-full" />
            )}
            <div className="flex gap-4 mt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary/80" /> CA HT</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500/50" /> Achats</span>
            </div>
          </CardContent>
        </Card>

        {/* Donut Chart — Unpaid breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Impayés</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.unpaidByStatus ? (
              <DonutChart
                segments={[
                  { label: "Envoyées", value: stats.unpaidByStatus.envoyee || 0, color: "#F59E0B" },
                  { label: "Partielles", value: stats.unpaidByStatus.partielle || 0, color: "#3B82F6" },
                  { label: "En retard", value: stats.unpaidByStatus.enRetard || 0, color: "#EF4444" },
                ]}
              />
            ) : (
              <Skeleton className="h-40 w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overdue Invoices Alert */}
      {(stats.recentInvoices || []).filter((i: any) => i.due_date && new Date(i.due_date) < new Date() && i.status === "envoyée").length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5 mb-6">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="size-4 text-red-400" />
              <span className="text-sm font-medium text-red-400">Factures en retard</span>
            </div>
            <div className="space-y-1">
              {(stats.recentInvoices || [])
                .filter((i: any) => i.due_date && new Date(i.due_date) < new Date() && i.status === "envoyée")
                .map((inv: any) => {
                  const c = contactMap.get(inv.contact_id);
                  return (
                    <div key={inv.id} className="flex items-center justify-between text-sm">
                      <span>{inv.number} — {c ? contactName(c) : "—"}</span>
                      <span className="text-red-400 font-medium">{formatCurrency(inv.amount_ttc)}</span>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        {/* Recent Quotes */}
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Derniers devis</CardTitle>
            <Link href="/devis">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="link-all-devis">
                Voir tout <ArrowRight className="size-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {(stats.recentQuotes || []).map((q: any) => {
              const c = contactMap.get(q.contact_id);
              return (
                <div key={q.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0" data-testid={`quote-row-${q.id}`}>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{q.number}</div>
                    <div className="text-xs text-muted-foreground truncate">{c ? contactName(c) : "—"} — {q.title || ""}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={q.status} />
                    <span className="text-sm font-medium w-20 text-right">{formatCurrency(q.amount_ttc)}</span>
                  </div>
                </div>
              );
            })}
            {(stats.recentQuotes || []).length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Aucun devis</p>}
          </CardContent>
        </Card>

        {/* Recent Invoices with payment progress */}
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Dernières factures</CardTitle>
            <Link href="/factures">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" data-testid="link-all-factures">
                Voir tout <ArrowRight className="size-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {(stats.recentInvoices || []).map((inv: any) => {
              const c = contactMap.get(inv.contact_id);
              const ttc = Math.abs(parseFloat(inv.amount_ttc || "0"));
              const paid = parseFloat(inv.amount_paid || "0");
              const paidPct = ttc > 0 ? Math.min((paid / ttc) * 100, 100) : 0;
              return (
                <div key={inv.id} className="py-1.5 border-b border-border/50 last:border-0" data-testid={`invoice-row-${inv.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{inv.number}</div>
                      <div className="text-xs text-muted-foreground truncate">{c ? contactName(c) : "—"}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={inv.status} />
                      <span className="text-sm font-medium w-20 text-right">{formatCurrency(inv.amount_ttc)}</span>
                    </div>
                  </div>
                  {inv.type !== "avoir" && ttc > 0 && (
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${paidPct >= 100 ? "bg-emerald-400" : paidPct > 0 ? "bg-blue-400" : "bg-muted-foreground/20"}`}
                          style={{ width: `${paidPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">{Math.round(paidPct)}%</span>
                    </div>
                  )}
                </div>
              );
            })}
            {(stats.recentInvoices || []).length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">Aucune facture</p>}
          </CardContent>
        </Card>
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MiniStat icon={<FileText className="size-3.5 text-primary" />} label="Devis en cours" value={stats.devisEnCours || 0} />
        <MiniStat icon={<FileCheck className="size-3.5 text-emerald-400" />} label="Devis signés" value={stats.devisSignes || 0} />
        <MiniStat icon={<HardHat className="size-3.5 text-amber-400" />} label="Chantiers actifs" value={stats.chantiersActifs || 0} />
        <MiniStat icon={<Users className="size-3.5 text-blue-400" />} label="Clients" value={stats.clientsCount || 0} />
      </div>
    </AppLayout>
  );
}

function KPICard({ title, value, icon, sub, alert }: { title: string; value: string | null; icon: React.ReactNode; sub: string; alert?: boolean }) {
  return (
    <Card className={alert ? "border-red-500/30 bg-red-500/5" : ""}>
      <CardContent className="py-4 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
          {icon}
        </div>
        {value ? (
          <div className={`text-lg font-bold ${alert ? "text-red-400" : ""}`} data-testid={`kpi-${title}`}>{value}</div>
        ) : (
          <Skeleton className="h-7 w-24" />
        )}
        <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-3 px-4 flex items-center gap-3">
        {icon}
        <div>
          <div className="text-base font-bold">{value}</div>
          <div className="text-[10px] text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40">
        <div className="size-24 rounded-full border-4 border-muted flex items-center justify-center">
          <span className="text-xs text-muted-foreground">0 €</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Aucun impayé</p>
      </div>
    );
  }

  // CSS conic gradient donut
  let gradientParts: string[] = [];
  let currentAngle = 0;
  for (const seg of segments) {
    if (seg.value <= 0) continue;
    const angle = (seg.value / total) * 360;
    gradientParts.push(`${seg.color} ${currentAngle}deg ${currentAngle + angle}deg`);
    currentAngle += angle;
  }
  const gradient = `conic-gradient(${gradientParts.join(", ")})`;

  return (
    <div className="flex flex-col items-center">
      <div className="relative size-28">
        <div
          className="size-28 rounded-full"
          style={{ background: gradient }}
        />
        <div className="absolute inset-3 rounded-full bg-card flex items-center justify-center">
          <span className="text-xs font-bold">{formatCurrency(total)}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 justify-center">
        {segments.filter(s => s.value > 0).map(seg => (
          <div key={seg.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="size-2 rounded-full" style={{ backgroundColor: seg.color }} />
            {seg.label}: {formatCurrency(seg.value)}
          </div>
        ))}
      </div>
    </div>
  );
}

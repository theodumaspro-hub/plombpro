import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { db } from "@/lib/supabaseData";
import { formatCurrency, formatPercent, contactName } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Euro, Receipt, FileCheck, HardHat,
  Package, Wrench, Layers, Users, Truck, MoreHorizontal,
  BarChart3, PieChart, AlertTriangle,
} from "lucide-react";
import type { Quote, Invoice, Chantier, Contact, Purchase } from "@shared/schema";

const LINE_TYPE_COLORS: Record<string, string> = {
  fourniture: "#3B82F6",
  main_oeuvre: "#F59E0B",
  ouvrage: "#8B5CF6",
  sous_traitance: "#EC4899",
  materiel: "#10B981",
  divers: "#6B7280",
};
const LINE_TYPE_LABELS: Record<string, string> = {
  fourniture: "Fournitures",
  main_oeuvre: "Main d'œuvre",
  ouvrage: "Ouvrages",
  sous_traitance: "Sous-traitance",
  materiel: "Matériel",
  divers: "Divers",
};

interface PilotageStats {
  monthlyRevenue: { month: string; facturation: number; encaissement: number }[];
  revenueByType: Record<string, number>;
  paymentStatus: { payee: number; partiellement: number; envoyee: number; enRetard: number; brouillon: number };
  topOutstanding: { contact_id: number; name: string; amount: number }[];
  profitability: { totalInvoicedHT: number; totalPurchasesHT: number; margeBrute: number; tauxMarge: number };
}

export default function PilotagePage() {
  const [revenueMode, setRevenueMode] = useState<"facturation" | "encaissement">("facturation");

  const { data: quotes = [] } = useQuery<any[]>({ queryKey: ["quotes"], queryFn: () => db.getQuotes() });
  const { data: invoices = [] } = useQuery<any[]>({ queryKey: ["invoices"], queryFn: () => db.getInvoices() });
  const { data: chantiers = [] } = useQuery<any[]>({ queryKey: ["chantiers"], queryFn: () => db.getChantiers() });
  const { data: contacts = [] } = useQuery<any[]>({ queryKey: ["contacts"], queryFn: () => db.getContacts() });
  const { data: purchases = [] } = useQuery<any[]>({ queryKey: ["purchases"], queryFn: () => db.getPurchases() });

  // KPIs from local data
  const totalQuoted = quotes.reduce((s, q) => s + parseFloat(q.amount_ht || "0"), 0);
  const totalSigned = quotes.filter(q => q.status === "signé").reduce((s, q) => s + parseFloat(q.amount_ht || "0"), 0);
  const conversionRate = quotes.length > 0 ? (quotes.filter(q => q.status === "signé").length / quotes.length * 100) : 0;
  const totalInvoicedHT = invoices.filter(i => i.type !== "avoir").reduce((s, i) => s + parseFloat(i.amount_ht || "0"), 0);
  const totalPaid = invoices.reduce((s, i) => s + parseFloat(i.amount_paid || "0"), 0);
  const totalPurchases = purchases.filter(p => p.status !== "annulé").reduce((s, p) => s + parseFloat(p.amount_ht || "0"), 0);
  const grossMargin = totalInvoicedHT > 0 ? ((totalInvoicedHT - totalPurchases) / totalInvoicedHT * 100) : 0;

  // Top clients by billed
  const topClients = contacts
    .filter(c => c.type === "client" && parseFloat(c.total_billed || "0") > 0)
    .sort((a, b) => parseFloat(b.total_billed || "0") - parseFloat(a.total_billed || "0"))
    .slice(0, 5);

  // Chantier profitability
  const chantierProfit = chantiers
    .filter(c => c.margin !== null && c.margin !== undefined)
    .sort((a, b) => parseFloat(b.margin || "0") - parseFloat(a.margin || "0"));

  // Monthly revenue data — compute client-side from invoices
  const monthlyData: { month: string; facturation: number; encaissement: number }[] = (() => {
    const now = new Date();
    const months: { month: string; facturation: number; encaissement: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", { month: "short" });
      const monthInvoices = invoices.filter(inv => {
        const ca = inv.created_at ? new Date(inv.created_at) : null;
        return ca && `${ca.getFullYear()}-${String(ca.getMonth() + 1).padStart(2, "0")}` === key;
      });
      const facturation = monthInvoices.reduce((s, inv) => s + parseFloat(inv.amount_ht || "0"), 0);
      const encaissement = monthInvoices.reduce((s, inv) => s + parseFloat(inv.amount_paid || "0"), 0);
      months.push({ month: label, facturation, encaissement });
    }
    return months;
  })();
  const maxMonthlyVal = Math.max(...monthlyData.map(m => Math.max(m.facturation, m.encaissement)), 1);

  // Revenue by type — compute from invoice lines (approximate from invoices)
  const revenueByType: Record<string, number> = {};
  const totalByType = Object.values(revenueByType).reduce((s, v) => s + v, 0);

  // Payment status donut — compute from invoices
  const ps = (() => {
    let payee = 0, partiellement = 0, envoyee = 0, enRetard = 0, brouillon = 0;
    for (const inv of invoices) {
      if (inv.status === "payée") payee++;
      else if (inv.status === "partiellement_payée") partiellement++;
      else if (inv.status === "envoyée") envoyee++;
      else if (inv.status === "en_retard") enRetard++;
      else if (inv.status === "brouillon") brouillon++;
    }
    return { payee, partiellement, envoyee, enRetard, brouillon };
  })();
  const totalStatusCount = ps.payee + ps.partiellement + ps.envoyee + ps.enRetard + ps.brouillon;
  const donutSegments = [
    { label: "Payée", count: ps.payee, color: "#10B981" },
    { label: "Partielle", count: ps.partiellement, color: "#F59E0B" },
    { label: "Envoyée", count: ps.envoyee, color: "#3B82F6" },
    { label: "En retard", count: ps.enRetard, color: "#EF4444" },
    { label: "Brouillon", count: ps.brouillon, color: "#6B7280" },
  ].filter(s => s.count > 0);

  // Profitability
  const prof = {
    totalInvoicedHT,
    totalPurchasesHT: totalPurchases,
    margeBrute: totalInvoicedHT - totalPurchases,
    tauxMarge: totalInvoicedHT > 0 ? ((totalInvoicedHT - totalPurchases) / totalInvoicedHT * 100) : 0,
  };

  // Top outstanding — compute from invoices
  const topOutstanding: { contact_id: number; name: string; amount: number }[] = (() => {
    const byContact: Record<number, { contact_id: number; name: string; amount: number }> = {};
    for (const inv of invoices) {
      if (!inv.contact_id) continue;
      const owed = parseFloat(inv.amount_ttc || "0") - parseFloat(inv.amount_paid || "0");
      if (owed <= 0) continue;
      if (!byContact[inv.contact_id]) {
        const c = contacts.find(ct => ct.id === inv.contact_id);
        byContact[inv.contact_id] = {
          contact_id: inv.contact_id,
          name: c ? contactName({ first_name: c.first_name, last_name: c.last_name, company: c.company }) : `Contact #${inv.contact_id}`,
          amount: 0,
        };
      }
      byContact[inv.contact_id].amount += owed;
    }
    return Object.values(byContact).sort((a, b) => b.amount - a.amount).slice(0, 5);
  })();

  return (
    <AppLayout title="Pilotage">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KPICard title="CA facturé HT" value={formatCurrency(totalInvoicedHT)} icon={<Euro className="size-4 text-emerald-400" />} trend={null} />
        <KPICard title="Encaissements" value={formatCurrency(totalPaid)} icon={<Receipt className="size-4 text-blue-400" />} trend={null} />
        <KPICard title="Marge brute" value={formatPercent(grossMargin)} icon={<TrendingUp className="size-4 text-primary" />} trend={grossMargin >= 40 ? "up" : "down"} />
        <KPICard title="Taux conversion devis" value={formatPercent(conversionRate)} icon={<FileCheck className="size-4 text-violet-400" />} trend={conversionRate >= 50 ? "up" : "down"} />
      </div>

      {/* Monthly Revenue Bar Chart + Revenue by Type */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* Monthly Revenue */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="size-4" /> CA mensuel (12 mois)
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant={revenueMode === "facturation" ? "default" : "ghost"}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => setRevenueMode("facturation")}
                >
                  Facturation
                </Button>
                <Button
                  variant={revenueMode === "encaissement" ? "default" : "ghost"}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => setRevenueMode("encaissement")}
                >
                  Encaissement
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <div className="flex items-end gap-1.5 h-44">
                {monthlyData.map((m, i) => {
                  const val = revenueMode === "facturation" ? m.facturation : m.encaissement;
                  const h = maxMonthlyVal > 0 ? (val / maxMonthlyVal) * 160 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex items-end w-full justify-center" style={{ height: 160 }}>
                        <div
                          className={`w-full max-w-[28px] rounded-t transition-all ${revenueMode === "facturation" ? "bg-primary/80" : "bg-emerald-500/70"}`}
                          style={{ height: Math.max(h, 2) }}
                          title={`${m.month}: ${formatCurrency(val)}`}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground whitespace-nowrap">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-44 flex items-center justify-center text-muted-foreground text-sm">Chargement...</div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Line Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">CA par type de ligne</CardTitle>
          </CardHeader>
          <CardContent>
            {totalByType > 0 ? (
              <div className="space-y-3">
                {Object.entries(revenueByType)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, amount]) => {
                    const pct = (amount / totalByType) * 100;
                    return (
                      <div key={type}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-full" style={{ backgroundColor: LINE_TYPE_COLORS[type] || "#6B7280" }} />
                            {LINE_TYPE_LABELS[type] || type}
                          </span>
                          <span className="font-medium">{formatCurrency(amount)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: LINE_TYPE_COLORS[type] || "#6B7280" }} />
                        </div>
                      </div>
                    );
                  })}
                <div className="pt-2 border-t border-border/50 text-xs text-muted-foreground text-right">
                  Total : <span className="font-medium text-foreground">{formatCurrency(totalByType)}</span>
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-xs">Aucune donnée de type</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Status + Top Outstanding + Pipeline */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* Payment Status Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <PieChart className="size-4" /> Statut des factures
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalStatusCount > 0 ? (
              <div className="flex flex-col items-center">
                {/* CSS Donut */}
                <div className="relative size-32 mb-4">
                  <svg viewBox="0 0 36 36" className="size-full -rotate-90">
                    {(() => {
                      let offset = 0;
                      return donutSegments.map((seg, i) => {
                        const pct = (seg.count / totalStatusCount) * 100;
                        const dashArray = `${pct} ${100 - pct}`;
                        const el = (
                          <circle
                            key={i}
                            cx="18" cy="18" r="15.91549431"
                            fill="none"
                            stroke={seg.color}
                            strokeWidth="3"
                            strokeDasharray={dashArray}
                            strokeDashoffset={`${-offset}`}
                          />
                        );
                        offset += pct;
                        return el;
                      });
                    })()}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold">{totalStatusCount}</span>
                    <span className="text-[10px] text-muted-foreground">factures</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs w-full">
                  {donutSegments.map(seg => (
                    <div key={seg.label} className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ backgroundColor: seg.color }} />
                      <span className="text-muted-foreground">{seg.label}</span>
                      <span className="font-medium ml-auto">{seg.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-xs">Aucune facture</div>
            )}
          </CardContent>
        </Card>

        {/* Top 5 Outstanding Clients */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-400" /> Top impayés
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topOutstanding.length > 0 ? (
              <div className="space-y-2.5">
                {topOutstanding.map((item, i) => (
                  <div key={item.contact_id} className="flex items-center justify-between py-1" data-testid={`outstanding-${item.contact_id}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                      <span className="text-sm font-medium truncate max-w-[140px]">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-red-400">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-xs">Aucun impayé</div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pipeline commercial</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <PipelineBar label="Devisé" value={totalQuoted} max={totalQuoted} color="bg-muted-foreground/30" />
              <PipelineBar label="Signé" value={totalSigned} max={totalQuoted} color="bg-emerald-500/60" />
              <PipelineBar label="Facturé" value={totalInvoicedHT} max={totalQuoted} color="bg-primary/70" />
              <PipelineBar label="Encaissé" value={totalPaid} max={totalQuoted} color="bg-blue-500/60" />
            </div>
            <div className="mt-4 pt-3 border-t border-border/50 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xs text-muted-foreground">Devis en cours</div>
                <div className="text-lg font-bold">{quotes.filter(q => q.status === "envoyé").length}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Chantiers actifs</div>
                <div className="text-lg font-bold">{chantiers.filter(c => c.status === "en_cours").length}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Factures impayées</div>
                <div className="text-lg font-bold text-amber-400">{invoices.filter(i => i.status === "envoyée").length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profitability Summary + Top Clients + Chantier Profitability */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Profitability Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rentabilité globale</CardTitle>
          </CardHeader>
          <CardContent>
            {prof ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">CA facturé HT</span>
                  <span className="text-sm font-medium">{formatCurrency(prof.totalInvoicedHT)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Achats HT</span>
                  <span className="text-sm font-medium text-red-400">- {formatCurrency(prof.totalPurchasesHT)}</span>
                </div>
                <div className="border-t border-border/50 pt-2 flex items-center justify-between">
                  <span className="text-xs font-medium">Marge brute HT</span>
                  <span className={`text-sm font-bold ${prof.margeBrute >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatCurrency(prof.margeBrute)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Taux de marge</span>
                  <span className={`text-sm font-bold ${prof.tauxMarge >= 40 ? "text-emerald-400" : prof.tauxMarge >= 20 ? "text-amber-400" : "text-red-400"}`}>
                    {formatPercent(prof.tauxMarge)}
                  </span>
                </div>
                {/* Visual bar */}
                <div className="pt-2">
                  <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                    <div className="h-full bg-emerald-500/70 transition-all" style={{ width: `${Math.max(0, Math.min(100, prof.tauxMarge))}%` }} />
                    <div className="h-full bg-red-500/30 flex-1" />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Marge</span>
                    <span>Achats</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-40 flex items-center justify-center text-muted-foreground text-xs">Chargement...</div>
            )}
          </CardContent>
        </Card>

        {/* Top Clients */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Top clients (facturé)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topClients.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between py-1.5" data-testid={`top-client-${c.id}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-sm font-medium">{contactName({ first_name: c.first_name, last_name: c.last_name, company: c.company })}</span>
                    {c.company && <span className="text-xs text-muted-foreground">{c.company}</span>}
                  </div>
                  <span className="text-sm font-medium">{formatCurrency(c.total_billed)}</span>
                </div>
              ))}
              {topClients.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée</p>}
            </div>
          </CardContent>
        </Card>

        {/* Chantier Profitability */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Rentabilité chantiers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {chantierProfit.slice(0, 6).map(ch => {
                const m = parseFloat(ch.margin || "0");
                return (
                  <div key={ch.id} className="flex items-center justify-between py-1.5" data-testid={`chantier-profit-${ch.id}`}>
                    <div>
                      <span className="text-sm font-medium">{ch.reference}</span>
                      <span className="text-xs text-muted-foreground ml-2">{ch.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{formatCurrency(ch.estimated_amount_ht)}</span>
                      <span className={`text-sm font-bold ${m >= 40 ? "text-emerald-400" : m >= 20 ? "text-amber-400" : "text-red-400"}`}>
                        {formatPercent(m)}
                      </span>
                    </div>
                  </div>
                );
              })}
              {chantierProfit.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function KPICard({ title, value, icon, trend }: { title: string; value: string; icon: React.ReactNode; trend: "up" | "down" | null }) {
  return (
    <Card>
      <CardContent className="py-4 px-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium">{title}</span>
          {icon}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">{value}</span>
          {trend === "up" && <TrendingUp className="size-4 text-emerald-400" />}
          {trend === "down" && <TrendingDown className="size-4 text-red-400" />}
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{formatCurrency(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

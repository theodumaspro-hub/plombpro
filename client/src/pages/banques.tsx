import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { db } from "@/lib/supabaseData";
import { formatCurrency, formatDate } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Search, Link2, CheckCircle2, Circle, ArrowUpRight, ArrowDownLeft, Landmark, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ACCOUNT_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16"];

export default function BanquesPage() {
  const [search, setSearch] = useState("");
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({
    bank_name: "", account_name: "", iban: "", bic: "", color: ACCOUNT_COLORS[0],
  });
  const { toast } = useToast();

  const { data: bankAccounts = [] } = useQuery<any[]>({ queryKey: ["bank-accounts"], queryFn: () => db.getBankAccounts() });
  const { data: transactions = [] } = useQuery<any[]>({ queryKey: ["bank-transactions"], queryFn: () => db.getBankTransactions() });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => db.updateBankTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      toast({ title: "Transaction mise à jour" });
    },
  });

  const createAccountMut = useMutation({
    mutationFn: async (data: any) => db.createBankAccount(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      setAddAccountOpen(false);
      toast({ title: "Compte ajouté" });
      setAccountForm({ bank_name: "", account_name: "", iban: "", bic: "", color: ACCOUNT_COLORS[0] });
    },
  });

  const syncAccountMut = useMutation({
    mutationFn: async (id: number) => db.updateBankAccount(id, { last_sync_at: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      toast({ title: "Synchronisation lancée" });
    },
  });

  // Filter transactions by active bank account
  const activeAccount = activeAccountId ? bankAccounts.find(a => a.id === activeAccountId) : null;
  const accountFiltered = activeAccount
    ? transactions.filter(t => t.bank_name === activeAccount.bank_name)
    : transactions;

  const filtered = accountFiltered.filter(t => {
    if (search) {
      const term = search.toLowerCase();
      return t.label.toLowerCase().includes(term) || (t.category || "").toLowerCase().includes(term);
    }
    return true;
  });

  const totalCredit = accountFiltered.filter(t => t.type === "credit").reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalDebit = accountFiltered.filter(t => t.type === "debit").reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);
  const balance = totalCredit - totalDebit;
  const unreconciledCount = accountFiltered.filter(t => !t.reconciled).length;

  function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    createAccountMut.mutate({
      bank_name: accountForm.bank_name,
      account_name: accountForm.account_name,
      iban: accountForm.iban || null,
      bic: accountForm.bic || null,
      balance: "0",
      currency: "EUR",
      status: "connected",
      color: accountForm.color,
      is_default: bankAccounts.length === 0,
    });
  }

  return (
    <AppLayout
      title="Banques"
      actions={
        <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => setAddAccountOpen(true)} data-testid="btn-add-account">
          <Plus className="size-3.5" /> Ajouter un compte
        </Button>
      }
    >
      {/* Bank Account Cards */}
      {bankAccounts.length > 0 && (
        <div className="flex gap-3 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveAccountId(null)}
            className={`shrink-0 rounded-lg border px-4 py-3 text-left transition-all min-w-[180px] ${
              activeAccountId === null ? "ring-2 ring-primary bg-card" : "bg-card/50 border-border hover:bg-card"
            }`}
          >
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Tous les comptes</div>
            <div className="text-sm font-bold mt-1">{formatCurrency(
              bankAccounts.reduce((s, a) => s + parseFloat(a.balance || "0"), 0)
            )}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{bankAccounts.length} compte{bankAccounts.length > 1 ? "s" : ""}</div>
          </button>
          {bankAccounts.map(account => (
            <button
              key={account.id}
              onClick={() => setActiveAccountId(activeAccountId === account.id ? null : account.id)}
              className={`shrink-0 rounded-lg border px-4 py-3 text-left transition-all min-w-[200px] ${
                activeAccountId === account.id ? "ring-2 ring-primary bg-card" : "bg-card/50 border-border hover:bg-card"
              }`}
              style={{ borderLeftWidth: 3, borderLeftColor: account.color || "#3B82F6" }}
              data-testid={`bank-account-${account.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{account.bank_name}</div>
                {account.status === "connected" && (
                  <Badge variant="outline" className="text-[8px] border-0 bg-emerald-500/10 text-emerald-400 px-1 py-0">Connecté</Badge>
                )}
                {account.status === "disconnected" && (
                  <Badge variant="outline" className="text-[8px] border-0 bg-red-500/10 text-red-400 px-1 py-0">Déconnecté</Badge>
                )}
                {account.status === "pending" && (
                  <Badge variant="outline" className="text-[8px] border-0 bg-amber-500/10 text-amber-400 px-1 py-0">En attente</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{account.account_name}</div>
              <div className="text-sm font-bold mt-1">{formatCurrency(account.balance)}</div>
              <div className="flex items-center justify-between mt-1">
                <div className="text-[10px] text-muted-foreground">
                  {account.last_sync_at ? `Sync ${formatDate(account.last_sync_at)}` : "Jamais synchronisé"}
                </div>
                {account.status === "connected" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={(e) => { e.stopPropagation(); syncAccountMut.mutate(account.id); }}
                    data-testid={`btn-sync-${account.id}`}
                  >
                    <RefreshCw className={`size-3 ${syncAccountMut.isPending ? "animate-spin" : ""}`} />
                  </Button>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card><CardContent className="py-3 px-4"><div className="text-xs text-muted-foreground">Solde</div><div className={`text-base font-bold mt-1 ${balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>{formatCurrency(balance)}</div></CardContent></Card>
        <Card><CardContent className="py-3 px-4"><div className="text-xs text-muted-foreground">Entrées</div><div className="text-base font-bold mt-1 text-emerald-400">{formatCurrency(totalCredit)}</div></CardContent></Card>
        <Card><CardContent className="py-3 px-4"><div className="text-xs text-muted-foreground">Sorties</div><div className="text-base font-bold mt-1 text-red-400">{formatCurrency(totalDebit)}</div></CardContent></Card>
        <Card><CardContent className="py-3 px-4"><div className="text-xs text-muted-foreground">À rapprocher</div><div className="text-base font-bold mt-1 text-amber-400">{unreconciledCount}</div></CardContent></Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-4">
        {activeAccount && (
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2" style={{ borderLeftWidth: 3, borderLeftColor: activeAccount.color || "#3B82F6" }}>
            <Landmark className="size-4 text-primary" />
            <span className="text-sm font-medium">{activeAccount.bank_name}</span>
            <span className="text-xs text-muted-foreground">— {activeAccount.account_name}</span>
          </div>
        )}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
      </div>

      {/* Transactions Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2.5 px-4 font-medium w-8"></th>
                <th className="py-2.5 px-4 font-medium">Date</th>
                <th className="py-2.5 px-4 font-medium">Libellé</th>
                <th className="py-2.5 px-4 font-medium">Catégorie</th>
                <th className="py-2.5 px-4 font-medium text-right">Montant</th>
                <th className="py-2.5 px-4 font-medium">Rapproché</th>
                <th className="py-2.5 px-4 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors" data-testid={`bank-row-${t.id}`}>
                  <td className="py-2.5 px-4">
                    {t.type === "credit" ? (
                      <ArrowDownLeft className="size-3.5 text-emerald-400" />
                    ) : (
                      <ArrowUpRight className="size-3.5 text-red-400" />
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-muted-foreground text-xs">{formatDate(t.date)}</td>
                  <td className="py-2.5 px-4 font-medium text-xs">{t.label}</td>
                  <td className="py-2.5 px-4">
                    {t.category && <Badge variant="outline" className="text-[10px] font-normal">{t.category}</Badge>}
                  </td>
                  <td className={`py-2.5 px-4 text-right font-medium ${t.type === "credit" ? "text-emerald-400" : "text-red-400"}`}>
                    {t.type === "credit" ? "+" : ""}{formatCurrency(t.amount)}
                  </td>
                  <td className="py-2.5 px-4">
                    {t.reconciled ? (
                      <CheckCircle2 className="size-4 text-emerald-400" />
                    ) : (
                      <Circle className="size-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    {!t.reconciled && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs"
                        onClick={() => updateMut.mutate({ id: t.id, data: { reconciled: true } })}>
                        <Link2 className="size-3 mr-1" /> Rapprocher
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Aucune transaction</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Account Dialog */}
      <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter un compte bancaire</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddAccount} className="space-y-4">
            <div>
              <Label>Nom de la banque *</Label>
              <Input value={accountForm.bank_name} onChange={e => setAccountForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="Ex: BNP Paribas" required data-testid="input-bank-name" />
            </div>
            <div>
              <Label>Nom du compte *</Label>
              <Input value={accountForm.account_name} onChange={e => setAccountForm(f => ({ ...f, account_name: e.target.value }))} placeholder="Ex: Compte courant pro" required data-testid="input-account-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>IBAN</Label>
                <Input value={accountForm.iban} onChange={e => setAccountForm(f => ({ ...f, iban: e.target.value }))} placeholder="FR76..." data-testid="input-iban" />
              </div>
              <div>
                <Label>BIC</Label>
                <Input value={accountForm.bic} onChange={e => setAccountForm(f => ({ ...f, bic: e.target.value }))} placeholder="BNPAFRPP" data-testid="input-bic" />
              </div>
            </div>
            <div>
              <Label>Couleur</Label>
              <div className="flex gap-2 mt-1">
                {ACCOUNT_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`size-7 rounded-full transition-all ${accountForm.color === color ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setAccountForm(f => ({ ...f, color }))}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setAddAccountOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={createAccountMut.isPending || !accountForm.bank_name || !accountForm.account_name} data-testid="btn-submit-account">
                {createAccountMut.isPending ? "Ajout..." : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

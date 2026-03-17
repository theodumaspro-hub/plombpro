export function formatCurrency(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? parseFloat(amount) : (amount ?? 0);
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

export function formatDateShort(date: string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(date));
}

export function formatPercent(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return `${v.toFixed(0)} %`;
}

export function contactName(contact: { first_name?: string | null; last_name?: string | null; company?: string | null }): string {
  if (contact.first_name || contact.last_name) {
    return [contact.first_name, contact.last_name].filter(Boolean).join(" ");
  }
  return contact.company || "—";
}

export const STATUS_COLORS: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoyé: "bg-blue-500/15 text-blue-400",
  envoyée: "bg-blue-500/15 text-blue-400",
  signé: "bg-emerald-500/15 text-emerald-400",
  refusé: "bg-red-500/15 text-red-400",
  expiré: "bg-orange-500/15 text-orange-400",
  payée: "bg-emerald-500/15 text-emerald-400",
  en_retard: "bg-red-500/15 text-red-400",
  annulée: "bg-muted text-muted-foreground",
  partiellement_payée: "bg-amber-500/15 text-amber-400",
  prospect: "bg-violet-500/15 text-violet-400",
  planifié: "bg-blue-500/15 text-blue-400",
  en_cours: "bg-amber-500/15 text-amber-400",
  terminé: "bg-emerald-500/15 text-emerald-400",
  facturé: "bg-teal-500/15 text-teal-400",
  annulé: "bg-muted text-muted-foreground",
  actif: "bg-emerald-500/15 text-emerald-400",
  inactif: "bg-muted text-muted-foreground",
  en_mission: "bg-amber-500/15 text-amber-400",
  commandé: "bg-blue-500/15 text-blue-400",
  reçu: "bg-emerald-500/15 text-emerald-400",
  partiellement_reçu: "bg-amber-500/15 text-amber-400",
};

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    brouillon: "Brouillon",
    envoyé: "Envoyé", envoyée: "Envoyée",
    signé: "Signé", refusé: "Refusé", expiré: "Expiré",
    payée: "Payée", en_retard: "En retard",
    annulée: "Annulée", annulé: "Annulé",
    partiellement_payée: "Part. payée",
    prospect: "Prospect", planifié: "Planifié",
    en_cours: "En cours", terminé: "Terminé",
    facturé: "Facturé",
    actif: "Actif", inactif: "Inactif", en_mission: "En mission",
    commandé: "Commandé", reçu: "Reçu",
    partiellement_reçu: "Part. reçu",
    basse: "Basse", normale: "Normale", haute: "Haute", urgente: "Urgente",
  };
  return map[status] || status;
}

export function invoiceTypeLabel(type: string): string {
  const map: Record<string, string> = {
    facture: "Facture", avoir: "Avoir", acompte: "Acompte",
    situation: "Situation", retenue_garantie: "Retenue de garantie",
  };
  return map[type] || type;
}

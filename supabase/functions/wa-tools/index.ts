// PlombPro WhatsApp Tools V2 — Supabase Edge Function
// Called by ElevenLabs Agent (BatiProAgent) via webhook
// 16 tools covering the full PlombPro feature set
// All responses: single { message: string } for reliable LLM relay

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

// ── Phone → User resolution ─────────────────────────────────
async function resolveUser(
  sb: ReturnType<typeof createClient>,
  phone: string
): Promise<{ user_id: string; artisan_name: string } | null> {
  const digits = phone.replace(/\D/g, "");
  const variants = new Set<string>();
  variants.add(digits);
  variants.add(`+${digits}`);
  if (digits.startsWith("33")) {
    variants.add(`0${digits.slice(2)}`);
  }
  if (digits.startsWith("0")) {
    variants.add(`+33${digits.slice(1)}`);
    variants.add(`33${digits.slice(1)}`);
  }
  variants.add(phone.trim());

  for (const p of variants) {
    const { data } = await sb
      .from("whatsapp_links")
      .select("user_id, artisan_name")
      .eq("phone", p)
      .limit(1)
      .single();
    if (data) {
      await sb.from("whatsapp_links").update({ last_message_at: new Date().toISOString() }).eq("phone", p);
      return data;
    }
  }
  return null;
}

// ── Helpers ──────────────────────────────────────────────────
function eur(n: number | string | null): string {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function genNumber(prefix: string): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const r = Date.now().toString(36).toUpperCase().slice(-4);
  return `${prefix}-${d}-${r}`;
}

function dateFR(d: string | null): string {
  if (!d) return "non précisée";
  try {
    return new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } catch { return d; }
}

// Find contact by fuzzy name match
async function findContact(sb: ReturnType<typeof createClient>, userId: string, name: string) {
  const { data } = await sb.from("contacts").select("id, first_name, last_name, company").eq("user_id", userId);
  const q = name.toLowerCase();
  return (data ?? []).find((c: any) => {
    const full = `${c.first_name || ""} ${c.last_name || ""} ${c.company || ""}`.toLowerCase();
    return full.includes(q);
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. DASHBOARD — Vue d'ensemble
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleDashboard(sb: ReturnType<typeof createClient>, uid: string, name: string) {
  const [quotes, invoices, contacts, chantiers, rdvs] = await Promise.all([
    sb.from("quotes").select("id, status, amount_ttc").eq("user_id", uid),
    sb.from("invoices").select("id, status, amount_ttc, amount_paid").eq("user_id", uid),
    sb.from("contacts").select("id").eq("user_id", uid).eq("type", "client"),
    sb.from("chantiers").select("id, status").eq("user_id", uid),
    sb.from("appointments").select("id, title, date, start_time").eq("user_id", uid)
      .gte("date", new Date().toISOString().slice(0, 10)).order("date").order("start_time").limit(3),
  ]);

  const allQ = quotes.data ?? [];
  const allI = invoices.data ?? [];
  const signed = allQ.filter((q: any) => q.status === "signé");
  const ca = signed.reduce((s: number, q: any) => s + (parseFloat(q.amount_ttc) || 0), 0);
  const unpaid = allI.filter((i: any) => i.status !== "payée" && i.status !== "avoir");
  const totalUnpaid = unpaid.reduce((s: number, i: any) => s + ((parseFloat(i.amount_ttc) || 0) - (parseFloat(i.amount_paid) || 0)), 0);
  const active = (chantiers.data ?? []).filter((c: any) => c.status === "en_cours");
  const enCours = allQ.filter((q: any) => q.status === "envoyé").length;

  let msg = `Bonjour ${name} ! Voici ton résumé. `;
  msg += `CA signé : ${eur(ca)}. ${enCours} devis en attente de réponse, ${signed.length} signés. `;
  if (unpaid.length > 0) msg += `${unpaid.length} facture(s) impayée(s) pour ${eur(totalUnpaid)}. `;
  else msg += `Aucun impayé ! `;
  msg += `${(contacts.data ?? []).length} clients, ${active.length} chantier(s) actif(s). `;

  const nextRdvs = rdvs.data ?? [];
  if (nextRdvs.length > 0) {
    msg += `Prochains RDV : `;
    msg += nextRdvs.map((r: any) => `${r.title} le ${dateFR(r.date)} à ${r.start_time || "?"}`).join(", ") + ".";
  }
  return { message: msg };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. IMPAYÉS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleImpayes(sb: ReturnType<typeof createClient>, uid: string) {
  const { data: inv } = await sb.from("invoices")
    .select("id, number, title, amount_ttc, amount_paid, status, contact_id, due_date, created_at")
    .eq("user_id", uid).not("status", "in", '("payée","avoir")').order("created_at", { ascending: false });

  if (!inv || inv.length === 0) return { message: "Aucune facture impayée. Tout est à jour, bravo !" };

  const cIds = [...new Set(inv.map((i: any) => i.contact_id).filter(Boolean))];
  const { data: cts } = cIds.length > 0
    ? await sb.from("contacts").select("id, first_name, last_name, company").in("id", cIds) : { data: [] };
  const cMap = new Map((cts ?? []).map((c: any) => [c.id, c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : c.company || "?"]));

  const total = inv.reduce((s: number, i: any) => s + (parseFloat(i.amount_ttc) || 0) - (parseFloat(i.amount_paid) || 0), 0);
  const lines = inv.slice(0, 8).map((i: any) => {
    const r = (parseFloat(i.amount_ttc) || 0) - (parseFloat(i.amount_paid) || 0);
    const overdue = i.due_date && new Date(i.due_date) < new Date() ? " (EN RETARD)" : "";
    return `${i.number} — ${cMap.get(i.contact_id) || "?"} — reste ${eur(r)}${overdue}`;
  });

  return { message: `${inv.length} facture(s) impayée(s), total : ${eur(total)}. Détail : ${lines.join(". ")}${inv.length > 8 ? ". Et " + (inv.length - 8) + " autre(s)." : ""}` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. CHERCHER CLIENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleChercherClient(sb: ReturnType<typeof createClient>, uid: string, body: any) {
  const q = (body.query || "").trim().toLowerCase();
  if (!q) return { message: "Dis-moi un nom, un numéro ou un email et je cherche le client." };

  const { data } = await sb.from("contacts")
    .select("id, first_name, last_name, company, email, phone, city, type, address").eq("user_id", uid);

  const hits = (data ?? []).filter((c: any) => {
    const all = `${c.first_name || ""} ${c.last_name || ""} ${c.company || ""} ${c.email || ""} ${c.phone || ""} ${c.city || ""}`.toLowerCase();
    return all.includes(q);
  });

  if (hits.length === 0) return { message: `Aucun contact trouvé pour "${body.query}". Tu veux que je le crée ?` };

  const lines = hits.slice(0, 5).map((c: any) => {
    const nom = `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.company || "?";
    const parts = [c.phone, c.email, c.address ? `${c.address} ${c.city || ""}`.trim() : c.city].filter(Boolean);
    return `${nom}${parts.length > 0 ? " — " + parts.join(", ") : ""}`;
  });

  return { message: `${hits.length} résultat(s) : ${lines.join(". ")}${hits.length > 5 ? ". Et " + (hits.length - 5) + " autre(s)." : ""}` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. AJOUTER CLIENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleAjouterClient(sb: ReturnType<typeof createClient>, uid: string, body: any) {
  const { firstName, lastName, company, contactPhone, email, address, city } = body;
  if (!firstName && !lastName && !company) {
    return { message: "Il me faut au moins un nom ou une raison sociale pour créer ce client." };
  }

  const { data, error } = await sb.from("contacts").insert({
    user_id: uid, type: "client",
    category: company ? "professionnel" : "particulier",
    first_name: firstName || null, last_name: lastName || null,
    company: company || null, phone: contactPhone || null,
    email: email || null, address: address || null, city: city || null,
  }).select().single();

  if (error) return { message: `Erreur : ${error.message}` };
  const nom = `${firstName || ""} ${lastName || ""} ${company ? "(" + company + ")" : ""}`.trim();
  return { message: `Client ${nom} créé avec succès. Tu veux créer un devis ou un RDV pour ce client ?` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. CRÉER DEVIS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleCreerDevis(sb: ReturnType<typeof createClient>, uid: string, body: any) {
  const { contactName, title, description, lines } = body;
  if (!title) return { message: "Il faut un titre pour le devis, par exemple : Rénovation salle de bain." };

  let contactId: number | null = null;
  if (contactName) {
    const match = await findContact(sb, uid, contactName);
    if (match) contactId = match.id;
  }

  const devisLines = Array.isArray(lines) ? lines : [];
  let totalHT = 0, totalTVA = 0;
  for (const l of devisLines) {
    const ht = (parseFloat(l.quantity || "1")) * (parseFloat(l.unitPriceHT || "0"));
    totalHT += ht;
    totalTVA += ht * (parseFloat(l.tvaRate || "20") / 100);
  }

  const num = genNumber("DEV");
  const { data, error } = await sb.from("quotes").insert({
    user_id: uid, contact_id: contactId, number: num, title,
    notes: description || null, status: "brouillon",
    amount_ht: totalHT.toFixed(2), amount_tva: totalTVA.toFixed(2),
    amount_ttc: (totalHT + totalTVA).toFixed(2), conditions: "Devis valable 30 jours",
  }).select().single();

  if (error) return { message: `Erreur : ${error.message}` };

  if (devisLines.length > 0) {
    await sb.from("document_lines").insert(devisLines.map((l: any, i: number) => ({
      user_id: uid, document_type: "quote", document_id: data.id,
      designation: l.designation || "Prestation", quantity: l.quantity || "1",
      unit: l.unit || "u", unit_price_ht: l.unitPriceHT || "0",
      tva_rate: l.tvaRate || "20", sort_order: i,
    })));
  }

  let msg = `Devis ${num} créé. Titre : ${title}. Client : ${contactName || "non attribué"}.`;
  if (totalHT > 0) msg += ` Montant : ${eur(totalHT)} HT, ${eur(totalHT + totalTVA)} TTC.`;
  msg += ` Statut : brouillon. Tu peux compléter les lignes depuis l'app PlombPro.`;
  return { message: msg };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. VOIR DEVIS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleVoirDevis(sb: ReturnType<typeof createClient>, uid: string, body: any) {
  let query = sb.from("quotes").select("id, number, title, status, amount_ttc, created_at")
    .eq("user_id", uid).order("created_at", { ascending: false }).limit(10);
  if (body.status) query = query.eq("status", body.status);

  const { data } = await query;
  if (!data || data.length === 0) return { message: body.status ? `Aucun devis "${body.status}".` : "Aucun devis pour l'instant." };

  const lines = data.map((q: any) => `${q.number} — ${q.title} — ${eur(q.amount_ttc)} (${q.status})`);
  return { message: `${data.length} devis : ${lines.join(". ")}` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. MODIFIER STATUT DEVIS (NEW)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleModifierStatutDevis(sb: ReturnType<typeof createClient>, uid: string, body: any) {
  const { devisNumber, newStatus } = body;
  if (!devisNumber) return { message: "Quel est le numéro du devis ?" };
  const validStatuses = ["brouillon", "envoyé", "signé", "refusé"];
  const status = (newStatus || "").toLowerCase();
  if (!validStatuses.includes(status)) return { message: `Statut invalide. Choisis parmi : ${validStatuses.join(", ")}.` };

  const { data, error } = await sb.from("quotes")
    .update({ status }).eq("user_id", uid).eq("number", devisNumber).select().single();

  if (error || !data) return { message: `Devis ${devisNumber} introuvable ou erreur.` };
  let msg = `Devis ${devisNumber} passé en "${status}".`;
  if (status === "signé") msg += ` Tu veux que je crée la facture correspondante ?`;
  return { message: msg };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. CRÉER FACTURE (NEW — from devis or standalone)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleCreerFacture(sb: ReturnType<typeof createClient>, uid: string, body: any) {
  const { devisNumber, contactName, title, amountHT, tvaRate } = body;

  // From existing devis
  if (devisNumber) {
    const { data: devis } = await sb.from("quotes")
      .select("id, number, title, contact_id, amount_ht, amount_tva, amount_ttc, notes")
      .eq("user_id", uid).eq("number", devisNumber).single();

    if (!devis) return { message: `Devis ${devisNumber} introuvable.` };

    const facNum = genNumber("FAC");
    const { data: fac, error } = await sb.from("invoices").insert({
      user_id: uid, contact_id: devis.contact_id, number: facNum,
      title: devis.title, notes: `Facture issue du devis ${devis.number}. ${devis.notes || ""}`,
      status: "envoyée", type: "facture",
      amount_ht: devis.amount_ht, amount_tva: devis.amount_tva, amount_ttc: devis.amount_ttc,
      amount_paid: "0.00", quote_id: devis.id,
    }).select().single();

    if (error) return { message: `Erreur : ${error.message}` };

    // Copy devis lines to invoice
    const { data: lines } = await sb.from("document_lines")
      .select("*").eq("document_type", "quote").eq("document_id", devis.id);
    if (lines && lines.length > 0) {
      await sb.from("document_lines").insert(lines.map((l: any) => ({
        ...l, id: undefined, document_type: "invoice", document_id: fac.id, created_at: undefined,
      })));
    }

    // Mark devis as facturé
    await sb.from("quotes").update({ status: "facturé" }).eq("id", devis.id);

    return { message: `Facture ${facNum} créée à partir du devis ${devis.number}. Montant : ${eur(devis.amount_ttc)} TTC. Statut : envoyée.` };
  }

  // Standalone facture
  if (!title) return { message: "Il faut un titre pour la facture, ou un numéro de devis pour la créer automatiquement." };
  let contactId: number | null = null;
  if (contactName) {
    const match = await findContact(sb, uid, contactName);
    if (match) contactId = match.id;
  }

  const ht = parseFloat(amountHT || "0");
  const tva = ht * (parseFloat(tvaRate || "20") / 100);
  const facNum = genNumber("FAC");

  const { error } = await sb.from("invoices").insert({
    user_id: uid, contact_id: contactId, number: facNum, title,
    status: "envoyée", type: "facture",
    amount_ht: ht.toFixed(2), amount_tva: tva.toFixed(2),
    amount_ttc: (ht + tva).toFixed(2), amount_paid: "0.00",
  }).select().single();

  if (error) return { message: `Erreur : ${error.message}` };
  return { message: `Facture ${facNum} créée. ${title}, ${eur(ht + tva)} TTC. Client : ${contactName || "non attribué"}.` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 9. VOIR FACTURES (NEW)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleVoirFactures(sb: ReturnType<typeof createClient>, uid: string, body: any) {
  let query = sb.from("invoices").select("id, number, title, status, amount_ttc, amount_paid, created_at")
    .eq("user_id", uid).order("created_at", { ascending: false }).limit(10);
  if (body.status) query = query.eq("status", body.status);

  const { data } = await query;
  if (!data || data.length === 0) return { message: body.status ? `Aucune facture "${body.status}".` : "Aucune facture pour l'instant." };

  const lines = data.map((f: any) => {
    const reste = (parseFloat(f.amount_ttc) || 0) - (parseFloat(f.amount_paid) || 0);
    return `${f.number} — ${f.title} — ${eur(f.amount_ttc)} (${f.status}${reste > 0 && f.status !== "payée" ? ", reste " + eur(reste) : ""})`;
  });
  return { message: `${data.length} facture(s) : ${lines.join(". ")}` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 10. ENVOYER DOCUMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleEnvoyerDocument(sb: ReturnType<typeof createClient>, uid: string, body: any) {
  const { documentType, documentNumber, channel } = body;
  if (!documentType || !documentNumber) return { message: "Précise le type (devis ou facture) et le numéro du document." };

  const table = documentType === "facture" ? "invoices" : "quotes";
  const { data: doc } = await sb.from(table)
    .select("id, number, title, amount_ttc, contact_id, status").eq("user_id", uid).eq("number", documentNumber).single();
  if (!doc) return { message: `${documentType} ${documentNumber} introuvable.` };

  let client = "?";
  if (doc.contact_id) {
    const { data: c } = await sb.from("contacts").select("first_name, last_name, email, phone").eq("id", doc.contact_id).single();
    if (c) client = `${c.first_name || ""} ${c.last_name || ""}`.trim() + (c.email ? ` (${c.email})` : "");
  }

  return { message: `${documentType} ${documentNumber} prêt pour ${client}, montant ${eur(doc.amount_ttc)}. L'envoi automatique par email sera disponible bientôt. Tu peux l'envoyer depuis l'app PlombPro pour l'instant.` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 11. ENREGISTRER PAIEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleEnregistrerPaiement(sb: ReturnType<typeof createClient>, uid: string, body: any) {
  const { invoiceNumber, amount, method } = body;
  if (!invoiceNumber) return { message: "Quel est le numéro de la facture ?" };

  const { data: inv } = await sb.from("invoices")
    .select("id, number, amount_ttc, amount_paid, status").eq("user_id", uid).eq("number", invoiceNumber).single();
  if (!inv) return { message: `Facture ${invoiceNumber} introuvable.` };

  const remaining = (parseFloat(inv.amount_ttc) || 0) - (parseFloat(inv.amount_paid) || 0);
  const pay = amount ? parseFloat(amount) : remaining;
  const newPaid = (parseFloat(inv.amount_paid) || 0) + pay;
  const newStatus = newPaid >= (parseFloat(inv.amount_ttc) || 0) ? "payée" : inv.status;

  const { error } = await sb.from("invoices")
    .update({ amount_paid: newPaid.toFixed(2), status: newStatus, payment_method: method || "virement" }).eq("id", inv.id);
  if (error) return { message: `Erreur : ${error.message}` };

  const reste = (parseFloat(inv.amount_ttc) || 0) - newPaid;
  return { message: `Paiement de ${eur(pay)} enregistré sur ${invoiceNumber} par ${method || "virement"}.${reste > 0 ? " Reste : " + eur(reste) + "." : " Facture soldée !"}` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 12. VOIR CHANTIERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleChantiers(sb: ReturnType<typeof createClient>, uid: string, body: any) {
  let query = sb.from("chantiers").select("id, name, status, address, city, start_date, end_date")
    .eq("user_id", uid).order("created_at", { ascending: false }).limit(10);
  if (body.status) query = query.eq("status", body.status);

  const { data } = await query;
  if (!data || data.length === 0) return { message: "Aucun chantier trouvé." };

  const lines = data.map((c: any) => {
    const lieu = `${c.address || ""} ${c.city || ""}`.trim();
    return `${c.name} (${c.status})${lieu ? " à " + lieu : ""}${c.start_date ? ", du " + dateFR(c.start_date) : ""}${c.end_date ? " au " + dateFR(c.end_date) : ""}`;
  });
  return { message: `${data.length} chantier(s) : ${lines.join(". ")}` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 13. CRÉER CHANTIER (NEW)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleCreerChantier(sb: ReturnType<typeof createClient>, uid: string, body: any) {
  const { name, address, city, contactName, startDate, endDate } = body;
  if (!name) return { message: "Il faut un nom pour le chantier." };

  let contactId: number | null = null;
  if (contactName) {
    const match = await findContact(sb, uid, contactName);
    if (match) contactId = match.id;
  }

  const { data, error } = await sb.from("chantiers").insert({
    user_id: uid, name, status: "en_cours",
    address: address || null, city: city || null,
    contact_id: contactId, start_date: startDate || new Date().toISOString().slice(0, 10),
    end_date: endDate || null,
  }).select().single();

  if (error) return { message: `Erreur : ${error.message}` };
  return { message: `Chantier "${name}" créé.${address ? " Adresse : " + address + (city ? " " + city : "") + "." : ""}${contactName ? " Client : " + contactName + "." : ""} Statut : en cours.` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 14. VOIR PLANNING (NEW)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleVoirPlanning(sb: ReturnType<typeof createClient>, uid: string, body: any) {
  const today = new Date().toISOString().slice(0, 10);
  // Default: next 7 days
  const from = body.dateFrom || today;
  const to = body.dateTo || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const { data } = await sb.from("appointments")
    .select("id, title, date, start_time, end_time, address, status, contact_id")
    .eq("user_id", uid).gte("date", from).lte("date", to)
    .order("date").order("start_time").limit(20);

  if (!data || data.length === 0) {
    return { message: from === today ? "Rien de prévu dans les 7 prochains jours. Tu veux créer un RDV ?" : `Aucun RDV entre le ${dateFR(from)} et le ${dateFR(to)}.` };
  }

  // Group by date
  const byDate = new Map<string, any[]>();
  for (const r of data) {
    const d = r.date;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(r);
  }

  const parts: string[] = [];
  for (const [date, rdvs] of byDate) {
    const dayRdvs = rdvs.map((r: any) => `${r.start_time || "?"}-${r.end_time || "?"} ${r.title}${r.address ? " (" + r.address + ")" : ""}`);
    parts.push(`${dateFR(date)} : ${dayRdvs.join(", ")}`);
  }

  return { message: `Planning du ${dateFR(from)} au ${dateFR(to)} : ${parts.join(". ")}` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 15. CRÉER RDV
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleCreerRdv(sb: ReturnType<typeof createClient>, uid: string, body: any) {
  const { title, date, time, contactName, address, duration } = body;
  if (!title || !date) return { message: "Il me faut au moins un titre et une date." };

  let contactId: number | null = null;
  if (contactName) {
    const match = await findContact(sb, uid, contactName);
    if (match) contactId = match.id;
  }

  const startTime = time || "08:00";
  const dur = parseInt(duration || "60");
  const [h, m] = startTime.split(":").map(Number);
  const endMin = h * 60 + (m || 0) + dur;
  const endTime = `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;

  const { error } = await sb.from("appointments").insert({
    user_id: uid, title, type: "rdv", date,
    start_time: startTime, end_time: endTime,
    contact_id: contactId, address: address || null, status: "planifié",
  }).select().single();

  if (error) return { message: `Erreur : ${error.message}` };
  return { message: `RDV "${title}" créé le ${dateFR(date)} de ${startTime} à ${endTime}.${contactName ? " Client : " + contactName + "." : ""}${address ? " Adresse : " + address + "." : ""}` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 16. NOTER TEMPS (NEW — time tracking)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleNoterTemps(sb: ReturnType<typeof createClient>, uid: string, body: any) {
  const { chantierName, hours, description, date } = body;
  if (!hours) return { message: "Combien d'heures tu veux enregistrer ?" };

  let chantierId: number | null = null;
  if (chantierName) {
    const { data } = await sb.from("chantiers").select("id, name").eq("user_id", uid);
    const match = (data ?? []).find((c: any) => c.name.toLowerCase().includes(chantierName.toLowerCase()));
    if (match) chantierId = match.id;
  }

  const { error } = await sb.from("time_entries").insert({
    user_id: uid,
    chantier_id: chantierId,
    date: date || new Date().toISOString().slice(0, 10),
    hours: parseFloat(hours),
    description: description || null,
  }).select().single();

  if (error) return { message: `Erreur : ${error.message}` };
  return { message: `${hours}h enregistrées${chantierName ? " sur le chantier " + chantierName : ""} pour le ${dateFR(date || new Date().toISOString().slice(0, 10))}.${description ? " Note : " + description : ""}` };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const action = body.action;
    const phone = body.phone;
    const sb = getSupabase();

    if (!action) return new Response(JSON.stringify({ message: "Action manquante." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!phone) return new Response(JSON.stringify({ message: "Numéro de téléphone manquant." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const user = await resolveUser(sb, phone);
    if (!user) return new Response(JSON.stringify({ message: "Ce numéro n'est pas lié à un compte PlombPro. Va dans Paramètres, Intégrations, WhatsApp pour le connecter." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { user_id, artisan_name } = user;

    // Route — accept all naming conventions
    const a = action.replace(/-/g, "_"); // normalize hyphens to underscores
    let result: any;
    switch (a) {
      case "dashboard": case "voir_resume": result = await handleDashboard(sb, user_id, artisan_name); break;
      case "impayes": case "voir_impayes": result = await handleImpayes(sb, user_id); break;
      case "chercher_client": result = await handleChercherClient(sb, user_id, body); break;
      case "ajouter_client": result = await handleAjouterClient(sb, user_id, body); break;
      case "creer_devis": result = await handleCreerDevis(sb, user_id, body); break;
      case "voir_devis": result = await handleVoirDevis(sb, user_id, body); break;
      case "modifier_statut_devis": result = await handleModifierStatutDevis(sb, user_id, body); break;
      case "creer_facture": result = await handleCreerFacture(sb, user_id, body); break;
      case "voir_factures": result = await handleVoirFactures(sb, user_id, body); break;
      case "envoyer_document": result = await handleEnvoyerDocument(sb, user_id, body); break;
      case "enregistrer_paiement": result = await handleEnregistrerPaiement(sb, user_id, body); break;
      case "chantiers": case "voir_chantiers": result = await handleChantiers(sb, user_id, body); break;
      case "creer_chantier": result = await handleCreerChantier(sb, user_id, body); break;
      case "voir_planning": result = await handleVoirPlanning(sb, user_id, body); break;
      case "creer_rdv": result = await handleCreerRdv(sb, user_id, body); break;
      case "noter_temps": result = await handleNoterTemps(sb, user_id, body); break;
      default: result = { message: `Action "${action}" non reconnue.` };
    }

    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ message: `Erreur technique, réessaie dans un instant.` }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// PlombPro WhatsApp Tools — Supabase Edge Function
// Called by ElevenLabs Agent tools via webhook
// Single endpoint, routes by "action" field in body

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

// Create Supabase client with service role (server-side, bypasses RLS)
function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );
}

// Resolve phone → user_id via whatsapp_links table
async function resolveUser(
  supabase: ReturnType<typeof createClient>,
  phone: string
): Promise<{ user_id: string; artisan_name: string } | null> {
  // Strip everything that isn't a digit
  const digits = phone.replace(/\D/g, "");
  // Build all plausible variants
  const variants = new Set<string>();
  variants.add(digits);                         // 33648330316
  variants.add(`+${digits}`);                   // +33648330316
  if (digits.startsWith("33")) {
    variants.add(`0${digits.slice(2)}`);         // 0648330316
    variants.add(`+${digits}`);                  // +33648330316
  }
  if (digits.startsWith("0")) {
    variants.add(`+33${digits.slice(1)}`);       // +33648330316
    variants.add(`33${digits.slice(1)}`);        // 33648330316
  }
  // Also try the raw input as-is
  variants.add(phone.trim());

  for (const p of variants) {
    const { data } = await supabase
      .from("whatsapp_links")
      .select("user_id, artisan_name")
      .eq("phone", p)
      .limit(1)
      .single();
    if (data) {
      // Update last_message_at
      await supabase
        .from("whatsapp_links")
        .update({ last_message_at: new Date().toISOString() })
        .eq("phone", p);
      return data;
    }
  }
  return null;
}

// Format currency
function eur(n: number | string | null): string {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACTION HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 1. Dashboard summary
async function handleDashboard(supabase: ReturnType<typeof createClient>, userId: string, artisanName: string) {
  const [quotes, invoices, contacts, chantiers] = await Promise.all([
    supabase.from("quotes").select("id, status, amount_ttc").eq("user_id", userId),
    supabase.from("invoices").select("id, status, amount_ttc, amount_paid").eq("user_id", userId),
    supabase.from("contacts").select("id").eq("user_id", userId).eq("type", "client"),
    supabase.from("chantiers").select("id, status").eq("user_id", userId),
  ]);

  const allQuotes = quotes.data ?? [];
  const allInvoices = invoices.data ?? [];
  const signed = allQuotes.filter((q: any) => q.status === "signé");
  const caHT = signed.reduce((sum: number, q: any) => sum + (parseFloat(q.amount_ttc) || 0), 0);
  const unpaid = allInvoices.filter((i: any) => i.status !== "payée" && i.status !== "avoir");
  const totalUnpaid = unpaid.reduce((sum: number, i: any) => sum + ((parseFloat(i.amount_ttc) || 0) - (parseFloat(i.amount_paid) || 0)), 0);
  const activeChantiers = (chantiers.data ?? []).filter((c: any) => c.status === "en_cours");

  return {
    message: `📊 Résumé de ${artisanName}`,
    ca_total: eur(caHT),
    devis_en_cours: allQuotes.filter((q: any) => q.status === "envoyé").length,
    devis_signes: signed.length,
    factures_impayees: unpaid.length,
    montant_impaye: eur(totalUnpaid),
    clients: (contacts.data ?? []).length,
    chantiers_actifs: activeChantiers.length,
  };
}

// 2. Unpaid invoices
async function handleImpayes(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, number, title, amount_ttc, amount_paid, status, contact_id, created_at")
    .eq("user_id", userId)
    .not("status", "in", '("payée","avoir")')
    .order("created_at", { ascending: false });

  if (!invoices || invoices.length === 0) {
    return { message: "✅ Aucune facture impayée ! Tout est à jour." };
  }

  // Get contact names
  const contactIds = [...new Set(invoices.map((i: any) => i.contact_id).filter(Boolean))];
  const { data: contacts } = contactIds.length > 0
    ? await supabase.from("contacts").select("id, first_name, last_name, company").in("id", contactIds)
    : { data: [] };

  const contactMap = new Map((contacts ?? []).map((c: any) => [c.id, c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : c.company || "Inconnu"]));

  const list = invoices.map((inv: any) => ({
    numero: inv.number,
    client: contactMap.get(inv.contact_id) || "Inconnu",
    montant_total: eur(inv.amount_ttc),
    reste_a_payer: eur((parseFloat(inv.amount_ttc) || 0) - (parseFloat(inv.amount_paid) || 0)),
    statut: inv.status,
  }));

  return {
    message: `💳 ${list.length} facture(s) impayée(s)`,
    total_impaye: eur(invoices.reduce((s: number, i: any) => s + (parseFloat(i.amount_ttc) || 0) - (parseFloat(i.amount_paid) || 0), 0)),
    factures: list,
  };
}

// 3. Search contact
async function handleChercherClient(supabase: ReturnType<typeof createClient>, userId: string, body: any) {
  const query = (body.query || "").trim().toLowerCase();
  if (!query) return { message: "❌ Précise un nom, téléphone ou email pour la recherche." };

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, company, email, phone, city, type")
    .eq("user_id", userId);

  const results = (contacts ?? []).filter((c: any) => {
    const name = `${c.first_name || ""} ${c.last_name || ""} ${c.company || ""}`.toLowerCase();
    return name.includes(query) || (c.email || "").toLowerCase().includes(query) || (c.phone || "").includes(query);
  });

  if (results.length === 0) return { message: `🔍 Aucun contact trouvé pour "${body.query}".` };

  return {
    message: `👥 ${results.length} contact(s) trouvé(s)`,
    contacts: results.map((c: any) => ({
      id: c.id,
      nom: `${c.first_name || ""} ${c.last_name || ""}`.trim() || c.company,
      type: c.type,
      email: c.email,
      telephone: c.phone,
      ville: c.city,
    })),
  };
}

// 4. Add contact
async function handleAjouterClient(supabase: ReturnType<typeof createClient>, userId: string, body: any) {
  const { firstName, lastName, company, contactPhone, email, address, city } = body;
  if (!firstName && !lastName && !company) {
    return { message: "❌ Il faut au moins un nom ou une raison sociale." };
  }

  const { data, error } = await supabase.from("contacts").insert({
    user_id: userId,
    type: "client",
    category: company ? "professionnel" : "particulier",
    first_name: firstName || null,
    last_name: lastName || null,
    company: company || null,
    phone: contactPhone || null,
    email: email || null,
    address: address || null,
    city: city || null,
  }).select().single();

  if (error) return { message: `❌ Erreur: ${error.message}` };

  return {
    message: `✅ Client ajouté : ${firstName || ""} ${lastName || ""} ${company || ""}`.trim(),
    client_id: data.id,
  };
}

// 5. Create quote
async function handleCreerDevis(supabase: ReturnType<typeof createClient>, userId: string, body: any) {
  const { contactName, title, description, lines } = body;
  if (!title) return { message: "❌ Il faut un titre pour le devis." };

  // Find contact by name
  let contactId: number | null = null;
  if (contactName) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, company")
      .eq("user_id", userId);

    const match = (contacts ?? []).find((c: any) => {
      const name = `${c.first_name || ""} ${c.last_name || ""} ${c.company || ""}`.toLowerCase();
      return name.includes(contactName.toLowerCase());
    });
    if (match) contactId = match.id;
  }

  // Calculate amounts
  const devisLines = Array.isArray(lines) ? lines : [];
  let totalHT = 0;
  let totalTVA = 0;
  for (const line of devisLines) {
    const qty = parseFloat(line.quantity || "1");
    const price = parseFloat(line.unitPriceHT || "0");
    const tva = parseFloat(line.tvaRate || "20") / 100;
    const lineHT = qty * price;
    totalHT += lineHT;
    totalTVA += lineHT * tva;
  }

  const number = `DEV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString(36).toUpperCase().slice(-4)}`;

  const { data: quote, error } = await supabase.from("quotes").insert({
    user_id: userId,
    contact_id: contactId,
    number,
    title,
    notes: description || null,
    status: "brouillon",
    amount_ht: totalHT.toFixed(2),
    amount_tva: totalTVA.toFixed(2),
    amount_ttc: (totalHT + totalTVA).toFixed(2),
    conditions: "Devis valable 30 jours",
  }).select().single();

  if (error) return { message: `❌ Erreur: ${error.message}` };

  // Insert lines
  if (devisLines.length > 0) {
    const lineInserts = devisLines.map((l: any, i: number) => ({
      user_id: userId,
      document_type: "quote",
      document_id: quote.id,
      designation: l.designation || "Prestation",
      quantity: l.quantity || "1",
      unit: l.unit || "u",
      unit_price_ht: l.unitPriceHT || "0",
      tva_rate: l.tvaRate || "20",
      sort_order: i,
    }));
    await supabase.from("document_lines").insert(lineInserts);
  }

  return {
    message: `📝 Devis créé : ${number}`,
    numero: number,
    titre: title,
    client: contactName || "Non attribué",
    montant_ht: eur(totalHT),
    montant_ttc: eur(totalHT + totalTVA),
    statut: "brouillon",
    conseil: devisLines.length === 0 ? "Tu peux ajouter des lignes depuis l'app PlombPro." : undefined,
  };
}

// 6. View quotes
async function handleVoirDevis(supabase: ReturnType<typeof createClient>, userId: string, body: any) {
  let query = supabase.from("quotes")
    .select("id, number, title, status, amount_ttc, contact_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (body.status) {
    query = query.eq("status", body.status);
  }

  const { data: quotes } = await query;
  if (!quotes || quotes.length === 0) {
    return { message: body.status ? `📋 Aucun devis "${body.status}".` : "📋 Aucun devis trouvé." };
  }

  return {
    message: `📋 ${quotes.length} devis`,
    devis: quotes.map((q: any) => ({
      numero: q.number,
      titre: q.title,
      montant_ttc: eur(q.amount_ttc),
      statut: q.status,
    })),
  };
}

// 7. Send document (stub — returns info for manual action)
async function handleEnvoyerDocument(supabase: ReturnType<typeof createClient>, userId: string, body: any) {
  const { documentType, documentNumber, channel } = body;
  if (!documentType || !documentNumber) {
    return { message: "❌ Précise le type (devis/facture) et le numéro du document." };
  }

  const table = documentType === "facture" ? "invoices" : "quotes";
  const { data: doc } = await supabase
    .from(table)
    .select("id, number, title, amount_ttc, contact_id, status")
    .eq("user_id", userId)
    .eq("number", documentNumber)
    .single();

  if (!doc) return { message: `❌ ${documentType} ${documentNumber} introuvable.` };

  // Get contact info
  let contactInfo = "client inconnu";
  if (doc.contact_id) {
    const { data: contact } = await supabase.from("contacts").select("first_name, last_name, email, phone").eq("id", doc.contact_id).single();
    if (contact) contactInfo = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
  }

  return {
    message: `📤 ${documentType} ${documentNumber} prêt à envoyer`,
    document: documentNumber,
    client: contactInfo,
    montant: eur(doc.amount_ttc),
    canal: channel || "email",
    info: "L'envoi par email/WhatsApp sera disponible prochainement. Tu peux envoyer manuellement depuis l'app PlombPro.",
  };
}

// 8. Record payment
async function handleEnregistrerPaiement(supabase: ReturnType<typeof createClient>, userId: string, body: any) {
  const { invoiceNumber, amount, method } = body;
  if (!invoiceNumber) return { message: "❌ Précise le numéro de la facture." };

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, number, amount_ttc, amount_paid, status")
    .eq("user_id", userId)
    .eq("number", invoiceNumber)
    .single();

  if (!invoice) return { message: `❌ Facture ${invoiceNumber} introuvable.` };

  const remaining = (parseFloat(invoice.amount_ttc) || 0) - (parseFloat(invoice.amount_paid) || 0);
  const paymentAmount = amount ? parseFloat(amount) : remaining;

  const newPaid = (parseFloat(invoice.amount_paid) || 0) + paymentAmount;
  const newStatus = newPaid >= (parseFloat(invoice.amount_ttc) || 0) ? "payée" : invoice.status;

  const { error } = await supabase
    .from("invoices")
    .update({ amount_paid: newPaid.toFixed(2), status: newStatus, payment_method: method || "virement" })
    .eq("id", invoice.id);

  if (error) return { message: `❌ Erreur: ${error.message}` };

  return {
    message: `💰 Paiement enregistré : ${eur(paymentAmount)} sur ${invoiceNumber}`,
    montant_paye: eur(paymentAmount),
    moyen: method || "virement",
    reste_a_payer: eur((parseFloat(invoice.amount_ttc) || 0) - newPaid),
    statut: newStatus,
  };
}

// 9. View chantiers
async function handleChantiers(supabase: ReturnType<typeof createClient>, userId: string, body: any) {
  let query = supabase.from("chantiers")
    .select("id, name, status, address, city, start_date, end_date, contact_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (body.status) {
    query = query.eq("status", body.status);
  }

  const { data: chantiers } = await query;
  if (!chantiers || chantiers.length === 0) {
    return { message: "🏗️ Aucun chantier trouvé." };
  }

  return {
    message: `🏗️ ${chantiers.length} chantier(s)`,
    chantiers: chantiers.map((c: any) => ({
      nom: c.name,
      statut: c.status,
      adresse: `${c.address || ""} ${c.city || ""}`.trim(),
      debut: c.start_date,
      fin: c.end_date,
    })),
  };
}

// 10. Create appointment
async function handleCreerRdv(supabase: ReturnType<typeof createClient>, userId: string, body: any) {
  const { title, date, time, contactName, address } = body;
  if (!title || !date) return { message: "❌ Précise au moins un titre et une date." };

  // Find contact
  let contactId: number | null = null;
  if (contactName) {
    const { data: contacts } = await supabase.from("contacts").select("id, first_name, last_name").eq("user_id", userId);
    const match = (contacts ?? []).find((c: any) => `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase().includes(contactName.toLowerCase()));
    if (match) contactId = match.id;
  }

  // Table uses start_time/end_time (not time). Default 1h duration.
  const startTime = time || "08:00";
  const [h, m] = startTime.split(":").map(Number);
  const endH = (h + 1) % 24;
  const endTime = `${String(endH).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;

  const { data, error } = await supabase.from("appointments").insert({
    user_id: userId,
    title,
    type: "rdv",
    date,
    start_time: startTime,
    end_time: endTime,
    contact_id: contactId,
    address: address || null,
    status: "planifié",
  }).select().single();

  if (error) return { message: `❌ Erreur: ${error.message}` };

  return {
    message: `📅 RDV créé : ${title}`,
    date,
    heure: `${startTime} - ${endTime}`,
    client: contactName || "Non attribué",
    adresse: address || "Non précisée",
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const action = body.action;
    const phone = body.phone;

    // DEBUG: Log the full incoming request body for troubleshooting
    const supabase = getSupabase();
    try {
      await supabase.from("whatsapp_conversations").insert({
        event_type: "debug_raw_request",
        phone: phone || "MISSING",
        direction: "inbound",
        content: JSON.stringify(body),
      });
    } catch (_) { /* ignore */ }

    if (!action) {
      return new Response(JSON.stringify({ error: "Missing 'action' field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve user from phone number
    if (!phone) {
      return new Response(JSON.stringify({
        error: "Missing 'phone' field",
        debug: "Received body keys: " + Object.keys(body).join(", "),
        message: "❌ Numéro de téléphone manquant. Vérifiez la configuration des tools dans ElevenLabs — le champ phone doit contenir le numéro de l'appelant.",
      }), {
        status: 200, // 200 so ElevenLabs agent can read the message
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = await resolveUser(supabase, phone);
    if (!user) {
      return new Response(JSON.stringify({
        message: "❌ Ce numéro WhatsApp n'est pas associé à un compte PlombPro. Connecte ton numéro dans Paramètres > Intégrations > WhatsApp.",
      }), {
        status: 200, // 200 so ElevenLabs can read the message
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, artisan_name } = user;

    // Log the conversation (non-blocking, ignore errors)
    try {
      await supabase.from("whatsapp_conversations").insert({
        event_type: "tool_call",
        phone,
        user_id,
        direction: "inbound",
        content: JSON.stringify({ action, ...body }),
      });
    } catch (_) { /* ignore logging errors */ }

    // Route to handler — accept both ElevenLabs tool names (underscores) and original action names (hyphens)
    let result: any;
    switch (action) {
      case "dashboard":
      case "voir_resume":
      case "voir-resume":
        result = await handleDashboard(supabase, user_id, artisan_name);
        break;
      case "impayes":
      case "voir_impayes":
      case "voir-impayes":
        result = await handleImpayes(supabase, user_id);
        break;
      case "chercher-client":
      case "chercher_client":
        result = await handleChercherClient(supabase, user_id, body);
        break;
      case "ajouter-client":
      case "ajouter_client":
        result = await handleAjouterClient(supabase, user_id, body);
        break;
      case "creer-devis":
      case "creer_devis":
        result = await handleCreerDevis(supabase, user_id, body);
        break;
      case "voir-devis":
      case "voir_devis":
        result = await handleVoirDevis(supabase, user_id, body);
        break;
      case "envoyer-document":
      case "envoyer_document":
        result = await handleEnvoyerDocument(supabase, user_id, body);
        break;
      case "enregistrer-paiement":
      case "enregistrer_paiement":
        result = await handleEnregistrerPaiement(supabase, user_id, body);
        break;
      case "chantiers":
      case "voir_chantiers":
      case "voir-chantiers":
        result = await handleChantiers(supabase, user_id, body);
        break;
      case "creer-rdv":
      case "creer_rdv":
        result = await handleCreerRdv(supabase, user_id, body);
        break;
      default:
        result = { message: `❌ Action inconnue: ${action}` };
    }

    // Always include artisan info and success status in the response
    result.artisan = artisan_name;
    result.success = !result.message?.startsWith("❌");

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

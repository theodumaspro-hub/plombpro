import type { Express, Request, Response } from "express";
import { supabaseAdmin } from "./supabaseClient";
import { storage } from "./storage";
import { generateDocumentPDF } from "./pdfGenerator";
import { sendEmail, buildEmailTemplate } from "./emailService";

// ═══════════════════════════════════════════════════════════════════════
// PlombPro WhatsApp API — Endpoints designed for ElevenLabs Agent Tools
// ═══════════════════════════════════════════════════════════════════════
//
// These endpoints are called by the ElevenLabs Conversational AI Agent
// when an artisan interacts with PlombPro via WhatsApp.
//
// Auth: Phone number → user_id mapping (whatsapp_links table)
// No Bearer token needed — the agent authenticates via phone number.
// ═══════════════════════════════════════════════════════════════════════

// ─── Phone Auth Middleware ───────────────────────────────────────────
async function whatsappAuth(req: Request, res: Response, next: Function) {
  const phone = req.body?.phone || req.query?.phone as string;
  if (!phone) {
    return res.status(400).json({ error: "Numéro de téléphone requis" });
  }

  const cleanPhone = normalizePhone(phone);

  try {
    const { data, error } = await supabaseAdmin
      .from("whatsapp_links")
      .select("user_id, verified, artisan_name")
      .eq("phone", cleanPhone)
      .eq("verified", true)
      .single();

    if (error || !data) {
      return res.status(401).json({
        error: "Ce numéro WhatsApp n'est pas lié à un compte PlombPro.",
        action: "link_account",
        message: "Connectez d'abord votre WhatsApp dans PlombPro > Paramètres > Intégrations > WhatsApp."
      });
    }

    // Set user context
    (req as any).userId = data.user_id;
    (req as any).artisanName = data.artisan_name;
    storage.setUserId(data.user_id);
    next();
  } catch (err: any) {
    return res.status(500).json({ error: `Erreur d'authentification WhatsApp: ${err.message}` });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────
function normalizePhone(phone: string): string {
  let clean = phone.replace(/[\s\-\(\)\.]/g, "");
  // French number normalization
  if (clean.startsWith("0") && clean.length === 10) {
    clean = "+33" + clean.substring(1);
  }
  if (clean.startsWith("33") && !clean.startsWith("+")) {
    clean = "+" + clean;
  }
  if (!clean.startsWith("+")) {
    clean = "+33" + clean;
  }
  return clean;
}

function fmtMoney(val: string | number | null | undefined): string {
  const n = parseFloat(String(val || "0")) || 0;
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Auto-create tables on first use ────────────────────────────
let tablesInitialized = false;
async function ensureTables() {
  if (tablesInitialized) return;
  try {
    // Check if whatsapp_links table exists by trying to read from it
    const { error } = await supabaseAdmin.from("whatsapp_links").select("id").limit(0);
    if (error && error.message.includes("not found")) {
      // Create tables via raw SQL using Supabase management API
      // Since we can't run raw SQL via PostgREST, we'll create via REST
      // The tables need to be created via Supabase Dashboard SQL Editor
      console.log("[WHATSAPP] Tables not found. Please run migration SQL in Supabase Dashboard.");
      console.log("[WHATSAPP] Migration file: plombpro_whatsapp_migration.sql");
    } else {
      tablesInitialized = true;
    }
  } catch {
    // Silently continue
  }
}

// ═══════════════════════════════════════════════════════════════════════
// REGISTER ROUTES
// ═══════════════════════════════════════════════════════════════════════
export function registerWhatsAppApiRoutes(app: Express) {
  // Initialize tables check on startup
  ensureTables();

  // ─── 1. LINK PHONE ↔ ACCOUNT ─────────────────────────────────────
  // Called from the PlombPro web app when user links their WhatsApp number
  // (This does NOT go through whatsappAuth — it uses normal Bearer auth)

  app.post("/api/whatsapp/link", async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Non authentifié" });

    const { phone, artisanName } = req.body;
    if (!phone) return res.status(400).json({ error: "Numéro de téléphone requis" });

    const cleanPhone = normalizePhone(phone);
    const company = await storage.getCompanySettings();

    try {
      // Check if already linked to another user
      const { data: existing } = await supabaseAdmin
        .from("whatsapp_links")
        .select("user_id")
        .eq("phone", cleanPhone)
        .single();

      if (existing && existing.user_id !== userId) {
        return res.status(409).json({
          error: "Ce numéro est déjà lié à un autre compte PlombPro."
        });
      }

      // Upsert the link
      const { data, error } = await supabaseAdmin
        .from("whatsapp_links")
        .upsert({
          phone: cleanPhone,
          user_id: userId,
          artisan_name: artisanName || company?.name || "Artisan",
          verified: true,
          linked_at: new Date().toISOString(),
        }, { onConflict: "phone" })
        .select()
        .single();

      if (error) throw error;

      // Also update integration status
      await storage.upsertIntegration("whatsapp", {
        status: "connected",
        whatsappPhone: cleanPhone,
        connectedAt: new Date().toISOString(),
      });

      res.json({
        ok: true,
        phone: cleanPhone,
        artisanName: data.artisan_name,
        message: `WhatsApp ${cleanPhone} lié à votre compte PlombPro. Vous pouvez maintenant interagir par vocal ou message WhatsApp.`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Unlink phone
  app.delete("/api/whatsapp/link", async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Non authentifié" });

    try {
      await supabaseAdmin
        .from("whatsapp_links")
        .delete()
        .eq("user_id", userId);

      await storage.upsertIntegration("whatsapp", {
        status: "disconnected",
        whatsappPhone: "",
      });

      res.json({ ok: true, message: "WhatsApp déconnecté." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get link status
  app.get("/api/whatsapp/link", async (req: Request, res: Response) => {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: "Non authentifié" });

    try {
      const { data } = await supabaseAdmin
        .from("whatsapp_links")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (data) {
        res.json({
          linked: true,
          phone: data.phone,
          artisanName: data.artisan_name,
          linkedAt: data.linked_at,
        });
      } else {
        res.json({ linked: false });
      }
    } catch {
      res.json({ linked: false });
    }
  });


  // ═══════════════════════════════════════════════════════════════════
  // ELEVENLABS AGENT TOOL ENDPOINTS
  // All prefixed /api/wa/ and authenticated via phone number
  // ═══════════════════════════════════════════════════════════════════

  // ─── 2. DASHBOARD / RÉSUMÉ ────────────────────────────────────────
  // Tool: "voir_resume" — "Montre-moi mon résumé"
  app.post("/api/wa/dashboard", whatsappAuth, async (req: Request, res: Response) => {
    try {
      const invoices = await storage.getInvoices();
      const quotes = await storage.getQuotes();
      const contacts = await storage.getContacts();
      const chantiers = await storage.getChantiers();

      const now = new Date();
      const allNonAvoir = invoices.filter(i => i.type !== "avoir");

      // CA and outstanding amounts
      const caHT = allNonAvoir
        .filter(i => i.status === "payée" || i.status === "partiellement_payée" || i.status === "envoyée")
        .reduce((s, i) => s + parseFloat(i.amountHT || "0"), 0);

      const enRetard = allNonAvoir
        .filter(i => (i.status === "envoyée" || i.status === "partiellement_payée") && i.dueDate && new Date(i.dueDate) < now)
        .reduce((s, i) => s + (parseFloat(i.amountTTC || "0") - parseFloat(i.amountPaid || "0")), 0);

      const enRetardCount = allNonAvoir
        .filter(i => (i.status === "envoyée" || i.status === "partiellement_payée") && i.dueDate && new Date(i.dueDate) < now).length;

      const resteAEncaisser = allNonAvoir
        .filter(i => i.status !== "annulée" && i.status !== "brouillon")
        .reduce((s, i) => s + (parseFloat(i.amountTTC || "0") - parseFloat(i.amountPaid || "0")), 0);

      const devisEnCours = quotes.filter(q => q.status === "envoyé").length;
      const devisSignes = quotes.filter(q => q.status === "signé").length;
      const chantiersActifs = chantiers.filter(c => c.status === "en_cours").length;

      res.json({
        resume: `📊 Voici votre résumé :\n` +
          `💰 CA HT : ${fmtMoney(caHT)}\n` +
          `📋 ${devisEnCours} devis en attente, ${devisSignes} signés\n` +
          `🏗️ ${chantiersActifs} chantiers en cours\n` +
          `💳 Reste à encaisser : ${fmtMoney(resteAEncaisser)}\n` +
          (enRetardCount > 0 ? `⚠️ ${enRetardCount} facture(s) en retard : ${fmtMoney(enRetard)}` : `✅ Aucune facture en retard`),
        data: { caHT, enRetard, enRetardCount, resteAEncaisser, devisEnCours, devisSignes, chantiersActifs, totalClients: contacts.length },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // ─── 3. VOIR IMPAYÉS ─────────────────────────────────────────────
  // Tool: "voir_impayes" — "Quelles factures sont impayées ?"
  app.post("/api/wa/impayes", whatsappAuth, async (req: Request, res: Response) => {
    try {
      const invoices = await storage.getInvoices();
      const contacts = await storage.getContacts();
      const contactMap = new Map(contacts.map(c => [c.id, c]));

      const impayes = invoices
        .filter(i => i.type !== "avoir" && (i.status === "envoyée" || i.status === "en_retard" || i.status === "partiellement_payée"))
        .map(i => {
          const remaining = parseFloat(i.amountTTC || "0") - parseFloat(i.amountPaid || "0");
          const contact = contactMap.get(i.contactId);
          const cName = contact ? (contact.company || `${contact.firstName || ""} ${contact.lastName || ""}`.trim()) : "Client";
          const isLate = i.dueDate && new Date(i.dueDate) < new Date();
          return {
            id: i.id,
            number: i.number,
            client: cName,
            amountTTC: fmtMoney(i.amountTTC),
            amountPaid: fmtMoney(i.amountPaid),
            remaining: fmtMoney(remaining),
            remainingRaw: remaining,
            dueDate: fmtDate(i.dueDate),
            isLate,
            status: i.status,
          };
        })
        .filter(i => i.remainingRaw > 0)
        .sort((a, b) => b.remainingRaw - a.remainingRaw);

      const totalDue = impayes.reduce((s, i) => s + i.remainingRaw, 0);
      const lateCount = impayes.filter(i => i.isLate).length;

      let message = `💳 ${impayes.length} facture(s) impayée(s) — Total : ${fmtMoney(totalDue)}\n`;
      if (lateCount > 0) message += `⚠️ ${lateCount} en retard de paiement\n`;
      message += "\n";

      for (const i of impayes.slice(0, 5)) {
        message += `${i.isLate ? "🔴" : "🟡"} ${i.number} — ${i.client} — ${i.remaining} ${i.isLate ? "(en retard)" : ""}\n`;
      }

      if (impayes.length > 5) {
        message += `\n...et ${impayes.length - 5} autres`;
      }

      res.json({ message, impayes, totalDue: fmtMoney(totalDue), lateCount });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // ─── 4. CHERCHER CLIENT ──────────────────────────────────────────
  // Tool: "chercher_client" — "Trouve le client Dupont" or "Le client au 06 12 34 56 78"
  app.post("/api/wa/chercher-client", whatsappAuth, async (req: Request, res: Response) => {
    try {
      const { query } = req.body;
      if (!query) return res.status(400).json({ error: "Critère de recherche requis (nom, téléphone, email)" });

      const contacts = await storage.getContacts();
      const q = query.toLowerCase().trim();

      const results = contacts.filter(c => {
        const searchFields = [
          c.firstName, c.lastName, c.company, c.email, c.phone, c.mobile, c.city
        ].map(f => (f || "").toLowerCase());
        return searchFields.some(f => f.includes(q));
      });

      if (results.length === 0) {
        return res.json({
          message: `Aucun client trouvé pour "${query}". Voulez-vous en créer un nouveau ?`,
          contacts: [],
          action: "create_contact"
        });
      }

      let message = `👥 ${results.length} client(s) trouvé(s) :\n\n`;
      for (const c of results.slice(0, 5)) {
        const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.company || "—";
        message += `• ${name}${c.company ? ` (${c.company})` : ""}\n`;
        if (c.phone || c.mobile) message += `  📞 ${c.phone || c.mobile}\n`;
        if (c.email) message += `  📧 ${c.email}\n`;
        if (c.address) message += `  📍 ${c.address}${c.city ? `, ${c.city}` : ""}\n`;
        message += "\n";
      }

      res.json({
        message,
        contacts: results.slice(0, 5).map(c => ({
          id: c.id,
          name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.company,
          company: c.company,
          phone: c.phone || c.mobile,
          email: c.email,
          address: c.address,
          city: c.city,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // ─── 5. AJOUTER CLIENT ───────────────────────────────────────────
  // Tool: "ajouter_client" — "Ajoute le client Martin, 06 12 34 56 78, 12 rue de Paris"
  app.post("/api/wa/ajouter-client", whatsappAuth, async (req: Request, res: Response) => {
    try {
      const { firstName, lastName, company, phone: contactPhone, email, address, city, postalCode, type } = req.body;

      if (!lastName && !firstName && !company) {
        return res.status(400).json({ error: "Au moins un nom, prénom ou société est requis" });
      }

      const contact = await storage.createContact({
        type: type || "client",
        firstName: firstName || null,
        lastName: lastName || null,
        company: company || null,
        phone: contactPhone || null,
        email: email || null,
        address: address || null,
        city: city || null,
        postalCode: postalCode || null,
        notes: "Créé via WhatsApp",
      });

      const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company || "Client";

      res.json({
        ok: true,
        message: `✅ Client "${name}" ajouté avec succès ! (ID: ${contact.id})`,
        contact: {
          id: contact.id,
          name,
          company: contact.company,
          phone: contact.phone,
          email: contact.email,
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // ─── 6. CRÉER DEVIS ──────────────────────────────────────────────
  // Tool: "creer_devis" — "Fais un devis pour M. Dupont, remplacement chauffe-eau 200L"
  app.post("/api/wa/creer-devis", whatsappAuth, async (req: Request, res: Response) => {
    try {
      const { contactId, contactName, title, description, lines, templateId } = req.body;

      // Resolve contact
      let resolvedContactId = contactId;
      if (!resolvedContactId && contactName) {
        const contacts = await storage.getContacts();
        const q = contactName.toLowerCase().trim();
        const match = contacts.find(c => {
          const name = [c.firstName, c.lastName, c.company].filter(Boolean).join(" ").toLowerCase();
          return name.includes(q);
        });
        if (match) {
          resolvedContactId = match.id;
        } else {
          // Auto-create contact
          const parts = contactName.trim().split(/\s+/);
          const newContact = await storage.createContact({
            type: "client",
            firstName: parts[0] || contactName,
            lastName: parts.slice(1).join(" ") || null,
            notes: "Créé automatiquement via WhatsApp",
          });
          resolvedContactId = newContact.id;
        }
      }

      if (!resolvedContactId) {
        return res.status(400).json({ error: "Client requis (contactId ou contactName)" });
      }

      // Generate quote number
      const allQuotes = await storage.getQuotes();
      const num = `DEV-${new Date().getFullYear()}-${String(allQuotes.length + 1).padStart(3, "0")}`;

      // Build lines from input or template
      let quoteLines: any[] = lines || [];
      if (templateId && quoteLines.length === 0) {
        // Load template lines
        try {
          const { data: tpl } = await supabaseAdmin
            .from("quote_templates")
            .select("*")
            .eq("id", templateId)
            .single();
          if (tpl?.lines) {
            quoteLines = typeof tpl.lines === "string" ? JSON.parse(tpl.lines) : tpl.lines;
          }
        } catch {}
      }

      // Calculate totals
      let totalHT = 0, totalTVA = 0;
      for (const line of quoteLines) {
        const qty = parseFloat(line.quantity || "1");
        const price = parseFloat(line.unitPriceHT || "0");
        const ht = qty * price;
        const tva = ht * (parseFloat(line.tvaRate || "10") / 100);
        totalHT += ht;
        totalTVA += tva;
        line.totalHT = ht.toFixed(2);
      }
      const totalTTC = totalHT + totalTVA;

      // Create quote
      const quote = await storage.createQuote({
        contactId: resolvedContactId,
        number: num,
        status: "brouillon",
        title: title || "Devis WhatsApp",
        description: description || null,
        amountHT: totalHT.toFixed(2),
        amountTVA: totalTVA.toFixed(2),
        amountTTC: totalTTC.toFixed(2),
        notes: "Créé via WhatsApp",
      });

      // Create lines
      for (let i = 0; i < quoteLines.length; i++) {
        const line = quoteLines[i];
        await storage.createDocumentLine({
          documentType: "quote",
          documentId: quote.id,
          designation: line.designation || line.description || "Prestation",
          description: line.detail || null,
          quantity: String(line.quantity || "1"),
          unit: line.unit || "u",
          unitPriceHT: String(line.unitPriceHT || "0"),
          tvaRate: String(line.tvaRate || "10"),
          totalHT: String(line.totalHT || "0"),
          sortOrder: i,
        });
      }

      const contact = await storage.getContact(resolvedContactId);
      const clientName = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company : "Client";

      res.json({
        ok: true,
        message: `✅ Devis ${num} créé pour ${clientName}\n💰 Montant : ${fmtMoney(totalTTC)} TTC\n📝 ${quoteLines.length} ligne(s)\n\nVoulez-vous l'envoyer au client ?`,
        quote: {
          id: quote.id,
          number: num,
          client: clientName,
          amountHT: fmtMoney(totalHT),
          amountTTC: fmtMoney(totalTTC),
          linesCount: quoteLines.length,
          status: "brouillon",
        },
        actions: ["envoyer_devis", "modifier_devis", "voir_devis_pdf"],
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // ─── 7. VOIR DEVIS ───────────────────────────────────────────────
  // Tool: "voir_devis" — "Montre-moi mes devis en cours"
  app.post("/api/wa/devis", whatsappAuth, async (req: Request, res: Response) => {
    try {
      const { status, limit: limitParam } = req.body;
      const quotes = await storage.getQuotes();
      const contacts = await storage.getContacts();
      const contactMap = new Map(contacts.map(c => [c.id, c]));

      let filtered = quotes;
      if (status) {
        filtered = quotes.filter(q => q.status === status);
      }

      // Sort by most recent first
      filtered = filtered.sort((a, b) => 
        (b.createdAt ? new Date(b.createdAt as any).getTime() : 0) - (a.createdAt ? new Date(a.createdAt as any).getTime() : 0)
      );

      const max = parseInt(limitParam) || 10;
      const shown = filtered.slice(0, max);

      let message = `📋 ${filtered.length} devis${status ? ` (${status})` : ""} :\n\n`;
      for (const q of shown) {
        const contact = contactMap.get(q.contactId);
        const cName = contact ? (contact.company || [contact.firstName, contact.lastName].filter(Boolean).join(" ")) : "—";
        const statusEmoji = q.status === "signé" ? "✅" : q.status === "envoyé" ? "📤" : q.status === "refusé" ? "❌" : "📝";
        message += `${statusEmoji} ${q.number} — ${cName} — ${fmtMoney(q.amountTTC)}\n`;
      }

      if (filtered.length > max) {
        message += `\n...et ${filtered.length - max} autres`;
      }

      res.json({
        message,
        devis: shown.map(q => ({
          id: q.id,
          number: q.number,
          client: contactMap.get(q.contactId)?.company || [contactMap.get(q.contactId)?.firstName, contactMap.get(q.contactId)?.lastName].filter(Boolean).join(" "),
          title: q.title,
          amountTTC: fmtMoney(q.amountTTC),
          status: q.status,
          createdAt: fmtDate(q.createdAt),
        })),
        total: filtered.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // ─── 8. ENVOYER DEVIS / FACTURE ──────────────────────────────────
  // Tool: "envoyer_devis" — "Envoie le devis DEV-2026-001 au client"
  app.post("/api/wa/envoyer-document", whatsappAuth, async (req: Request, res: Response) => {
    try {
      const { documentType, documentId, documentNumber, channel, recipientEmail, recipientPhone } = req.body;

      // Find document by ID or number
      let doc: any, contact: any, lines: any[];
      const isQuote = documentType === "quote" || documentType === "devis";

      if (isQuote) {
        if (documentId) {
          doc = await storage.getQuote(Number(documentId));
        } else if (documentNumber) {
          const quotes = await storage.getQuotes();
          doc = quotes.find(q => q.number === documentNumber);
        }
        if (!doc) return res.status(404).json({ error: "Devis introuvable" });
        contact = doc.contactId ? await storage.getContact(doc.contactId) : undefined;
        lines = await storage.getDocumentLines("quote", doc.id);
      } else {
        if (documentId) {
          doc = await storage.getInvoice(Number(documentId));
        } else if (documentNumber) {
          const invoices = await storage.getInvoices();
          doc = invoices.find(i => i.number === documentNumber);
        }
        if (!doc) return res.status(404).json({ error: "Facture introuvable" });
        contact = doc.contactId ? await storage.getContact(doc.contactId) : undefined;
        lines = await storage.getDocumentLines("invoice", doc.id);
      }

      const company = await storage.getCompanySettings();
      const docLabel = isQuote ? "Devis" : "Facture";
      const email = recipientEmail || contact?.email;

      // Generate PDF
      const pdfBuffer = await generateDocumentPDF({
        documentType: isQuote ? "quote" : "invoice",
        document: doc,
        contact,
        company,
        lines,
      });

      // Determine channel
      const sendChannel = channel || (email ? "email" : "whatsapp_link");

      if (sendChannel === "email" && email) {
        const contactName = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company || email : email;
        const html = buildEmailTemplate({
          documentType: isQuote ? "quote" : "invoice",
          documentNumber: doc.number,
          documentTitle: doc.title || undefined,
          recipientName: contactName,
          senderName: company?.name || "PlombPro",
          amountTTC: doc.amountTTC || undefined,
          company: company || undefined,
        });

        const result = await sendEmail({
          to: email,
          subject: `${docLabel} ${doc.number}`,
          html,
          replyTo: company?.email || undefined,
          attachments: [{
            filename: `${docLabel}-${doc.number}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          }],
        });

        // Mark as sent
        if (isQuote) {
          await storage.updateQuote(doc.id, { status: "envoyé" });
        } else if (doc.status === "brouillon") {
          await storage.updateInvoice(doc.id, { status: "envoyée" });
        }

        return res.json({
          ok: true,
          message: `📧 ${docLabel} ${doc.number} envoyé par email à ${email}`,
          channel: "email",
          demo: result.demo,
        });
      }

      // WhatsApp link fallback
      const phone = recipientPhone || contact?.phone || contact?.mobile;
      if (phone) {
        const cleanPhone = normalizePhone(phone);
        const waMessage = `Bonjour, voici votre ${docLabel.toLowerCase()} n° ${doc.number} pour un montant de ${fmtMoney(doc.amountTTC)}. N'hésitez pas à me contacter pour toute question. — ${company?.name || ""}`;
        const waLink = `https://wa.me/${cleanPhone.replace("+", "")}?text=${encodeURIComponent(waMessage)}`;

        if (isQuote) {
          await storage.updateQuote(doc.id, { status: "envoyé" });
        }

        return res.json({
          ok: true,
          message: `📱 ${docLabel} ${doc.number} prêt à envoyer par WhatsApp à ${phone}`,
          channel: "whatsapp",
          waLink,
          pdfReady: true,
        });
      }

      res.json({
        ok: false,
        message: `Le client n'a ni email ni téléphone. Ajoutez ses coordonnées d'abord.`,
        action: "update_contact",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // ─── 9. ENREGISTRER RÈGLEMENT ─────────────────────────────────────
  // Tool: "enregistrer_paiement" — "Le client Dupont a payé la facture FAC-2026-001"
  app.post("/api/wa/enregistrer-paiement", whatsappAuth, async (req: Request, res: Response) => {
    try {
      const { invoiceId, invoiceNumber, amount, method, reference } = req.body;

      let invoice: any;
      if (invoiceId) {
        invoice = await storage.getInvoice(Number(invoiceId));
      } else if (invoiceNumber) {
        const invoices = await storage.getInvoices();
        invoice = invoices.find(i => i.number === invoiceNumber);
      }
      if (!invoice) return res.status(404).json({ error: "Facture introuvable" });

      const remaining = parseFloat(invoice.amountTTC || "0") - parseFloat(invoice.amountPaid || "0");
      const paymentAmount = parseFloat(amount) || remaining; // Default: pay full remaining

      if (paymentAmount <= 0) {
        return res.json({
          message: `✅ La facture ${invoice.number} est déjà entièrement payée !`,
          status: "payée",
        });
      }

      // Get existing payments
      let payments: any[] = [];
      try { payments = JSON.parse(invoice.notes || "[]"); if (!Array.isArray(payments)) payments = []; } catch { payments = []; }

      payments.push({
        id: Date.now(),
        amount: paymentAmount.toFixed(2),
        date: new Date().toISOString().split("T")[0],
        method: method || "virement",
        reference: reference || "Via WhatsApp",
      });

      const totalPaid = payments.reduce((s: number, p: any) => s + parseFloat(p.amount || "0"), 0);
      const invoiceTTC = Math.abs(parseFloat(invoice.amountTTC || "0"));
      const newStatus = totalPaid >= invoiceTTC ? "payée" : "partiellement_payée";

      await storage.updateInvoice(invoice.id, {
        notes: JSON.stringify(payments),
        amountPaid: totalPaid.toFixed(2),
        status: newStatus,
        paymentDate: newStatus === "payée" ? new Date().toISOString().split("T")[0] : invoice.paymentDate,
      });

      const contact = invoice.contactId ? await storage.getContact(invoice.contactId) : undefined;
      const clientName = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company : "Client";

      res.json({
        ok: true,
        message: newStatus === "payée"
          ? `✅ Facture ${invoice.number} (${clientName}) entièrement payée ! ${fmtMoney(paymentAmount)} reçus.`
          : `💳 Paiement de ${fmtMoney(paymentAmount)} enregistré sur la facture ${invoice.number}.\nReste à payer : ${fmtMoney(invoiceTTC - totalPaid)}`,
        status: newStatus,
        totalPaid: fmtMoney(totalPaid),
        remaining: fmtMoney(Math.max(0, invoiceTTC - totalPaid)),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // ─── 10. VOIR CHANTIERS ──────────────────────────────────────────
  // Tool: "voir_chantiers" — "Quels sont mes chantiers en cours ?"
  app.post("/api/wa/chantiers", whatsappAuth, async (req: Request, res: Response) => {
    try {
      const { status } = req.body;
      const chantiers = await storage.getChantiers();
      const contacts = await storage.getContacts();
      const contactMap = new Map(contacts.map(c => [c.id, c]));

      let filtered = status ? chantiers.filter(c => c.status === status) : chantiers;
      filtered = filtered.sort((a, b) =>
        (b.createdAt ? new Date(b.createdAt as any).getTime() : 0) - (a.createdAt ? new Date(a.createdAt as any).getTime() : 0)
      );

      let message = `🏗️ ${filtered.length} chantier(s)${status ? ` (${status})` : ""} :\n\n`;
      for (const ch of filtered.slice(0, 5)) {
        const contact = ch.contactId ? contactMap.get(ch.contactId) : undefined;
        const cName = contact ? (contact.company || [contact.firstName, contact.lastName].filter(Boolean).join(" ")) : "";
        const statusEmoji = ch.status === "en_cours" ? "🟢" : ch.status === "terminé" ? "✅" : ch.status === "en_attente" ? "🟡" : "📋";
        message += `${statusEmoji} ${ch.name || ch.reference || "Chantier"}${cName ? ` — ${cName}` : ""}\n`;
        if (ch.address) message += `  📍 ${ch.address}\n`;
        message += "\n";
      }

      res.json({
        message,
        chantiers: filtered.slice(0, 10).map(ch => ({
          id: ch.id,
          name: ch.name || ch.reference,
          status: ch.status,
          address: ch.address,
          client: contactMap.get(ch.contactId || 0)?.company || "",
        })),
        total: filtered.length,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // ─── 11. CRÉER RDV ───────────────────────────────────────────────
  // Tool: "creer_rdv" — "Prends-moi un rdv demain 14h chez le client Dupont"
  app.post("/api/wa/creer-rdv", whatsappAuth, async (req: Request, res: Response) => {
    try {
      const { title, date, time, contactId, contactName, address, notes, duration } = req.body;

      // Resolve contact if needed
      let resolvedContactId = contactId;
      if (!resolvedContactId && contactName) {
        const contacts = await storage.getContacts();
        const q = contactName.toLowerCase().trim();
        const match = contacts.find(c => {
          const name = [c.firstName, c.lastName, c.company].filter(Boolean).join(" ").toLowerCase();
          return name.includes(q);
        });
        if (match) resolvedContactId = match.id;
      }

      if (!date) return res.status(400).json({ error: "Date requise (format YYYY-MM-DD)" });

      const startTime = `${date}T${time || "09:00"}:00`;
      const endHour = time ? String(parseInt(time.split(":")[0]) + (parseInt(duration) || 1)).padStart(2, "0") + ":" + time.split(":")[1] : "10:00";
      const endTime = `${date}T${endHour}:00`;

      const appointment = await storage.createAppointment({
        title: title || "Rendez-vous client",
        startTime,
        endTime,
        contactId: resolvedContactId || null,
        location: address || null,
        notes: (notes || "") + " (Créé via WhatsApp)",
        type: "intervention",
        status: "confirmé",
      });

      const contact = resolvedContactId ? await storage.getContact(resolvedContactId) : undefined;
      const clientName = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company : "";

      res.json({
        ok: true,
        message: `📅 RDV créé :\n📌 ${title || "Rendez-vous"}${clientName ? ` — ${clientName}` : ""}\n📆 ${fmtDate(date)} à ${time || "09:00"}\n${address ? `📍 ${address}\n` : ""}`,
        appointment: {
          id: appointment.id,
          title: appointment.title,
          date,
          time: time || "09:00",
          client: clientName,
          address,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });


  // ─── 12. DEVIS PDF DOWNLOAD ───────────────────────────────────────
  // Used by the agent to generate and send a PDF via WhatsApp
  app.get("/api/wa/pdf/:type/:id", async (req: Request, res: Response) => {
    try {
      // This endpoint has a secret token check instead of phone auth
      const token = req.query.token as string;
      const waToken = process.env.WA_API_TOKEN || "plombpro_wa_2026";
      if (token !== waToken) {
        return res.status(401).json({ error: "Token invalide" });
      }

      const docType = req.params.type; // "quote" or "invoice"
      const docId = Number(req.params.id);

      let doc: any, contact: any, lines: any[];

      if (docType === "quote") {
        doc = await storage.getQuote(docId);
        if (!doc) return res.status(404).json({ error: "Devis introuvable" });
        
        // Set user context from quote's user
        const { data: link } = await supabaseAdmin
          .from("quotes")
          .select("user_id")
          .eq("id", docId)
          .single();
        if (link?.user_id) storage.setUserId(link.user_id);

        contact = doc.contactId ? await storage.getContact(doc.contactId) : undefined;
        lines = await storage.getDocumentLines("quote", docId);
      } else {
        doc = await storage.getInvoice(docId);
        if (!doc) return res.status(404).json({ error: "Facture introuvable" });

        const { data: link } = await supabaseAdmin
          .from("invoices")
          .select("user_id")
          .eq("id", docId)
          .single();
        if (link?.user_id) storage.setUserId(link.user_id);

        contact = doc.contactId ? await storage.getContact(doc.contactId) : undefined;
        lines = await storage.getDocumentLines("invoice", docId);
      }

      const company = await storage.getCompanySettings();

      const pdfBuffer = await generateDocumentPDF({
        documentType: docType === "quote" ? "quote" : "invoice",
        document: doc,
        contact,
        company,
        lines,
      });

      const label = docType === "quote" ? "Devis" : "Facture";
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${label}-${doc.number}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      });
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("[WA PDF ERROR]", err);
      res.status(500).json({ error: "Erreur de génération PDF" });
    }
  });


  // ─── 13. WEBHOOK: ElevenLabs Agent Event ──────────────────────────
  // Receives events from ElevenLabs when conversations happen
  app.post("/api/wa/webhook/elevenlabs", async (req: Request, res: Response) => {
    try {
      const event = req.body;
      console.log("[ELEVENLABS WEBHOOK]", JSON.stringify(event).substring(0, 500));

      // Log conversation event in Supabase
      try {
        await supabaseAdmin
          .from("whatsapp_conversations")
          .insert({
            event_type: event.type || "message",
            phone: event.phone || event.from || "",
            direction: event.direction || "inbound",
            content: typeof event.message === "string" ? event.message : JSON.stringify(event.message || event),
            agent_response: event.response || event.agent_message || null,
            tool_calls: event.tool_calls ? JSON.stringify(event.tool_calls) : null,
            created_at: new Date().toISOString(),
          });
      } catch { /* conversation log table may not exist yet */ }

      res.json({ ok: true, received: true });
    } catch (err: any) {
      console.error("[WEBHOOK ERROR]", err);
      res.status(200).json({ ok: true }); // Always 200 for webhooks
    }
  });


  // ─── 14. AGENT SYSTEM PROMPT ──────────────────────────────────────
  // Returns the ElevenLabs agent's system prompt based on the artisan's config
  app.post("/api/wa/agent-config", whatsappAuth, async (req: Request, res: Response) => {
    try {
      const company = await storage.getCompanySettings();
      const artisanName = (req as any).artisanName || company?.name || "l'artisan";

      const systemPrompt = `Tu es l'assistant PlombPro de ${artisanName}. Tu aides à gérer son activité d'artisan du bâtiment via WhatsApp.

PERSONNALITÉ :
- Professionnel mais amical, tutoiement OK
- Parle en français, langage simple et direct
- Utilise des émojis pour la clarté

CE QUE TU PEUX FAIRE :
1. 📊 Voir le résumé d'activité → Tool: voir_resume
2. 💳 Voir les factures impayées → Tool: voir_impayes  
3. 👥 Chercher un client → Tool: chercher_client
4. ➕ Ajouter un client → Tool: ajouter_client
5. 📝 Créer un devis → Tool: creer_devis
6. 📋 Voir les devis → Tool: voir_devis
7. 📤 Envoyer un devis/facture → Tool: envoyer_document
8. 💰 Enregistrer un paiement → Tool: enregistrer_paiement
9. 🏗️ Voir les chantiers → Tool: voir_chantiers
10. 📅 Créer un rendez-vous → Tool: creer_rdv

INFOS ENTREPRISE :
- Nom : ${company?.name || "Mon Entreprise"}
- SIRET : ${company?.siret || "Non renseigné"}
- Tél : ${company?.phone || "Non renseigné"}
- Métier : ${company?.trade || "Plomberie / Chauffage"}

RÈGLES :
- Confirme toujours avant d'envoyer un document au client
- Pour les devis, demande le nom du client, la description des travaux, et les lignes si possible
- Si l'artisan dit juste "fais-moi un devis", pose les bonnes questions
- Pour les paiements, confirme le montant et la facture avant d'enregistrer
- Quand tu crées un devis, propose toujours de l'envoyer ensuite`;

      res.json({
        systemPrompt,
        agentName: `PlombPro — ${artisanName}`,
        language: "fr",
        voice: "fr-FR",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

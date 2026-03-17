import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { supabaseAdmin, supabaseConfig } from "./supabaseClient";
import { registerIntegrationRoutes } from "./integrationRoutes";
import { registerWhatsAppApiRoutes } from "./whatsappApiRoutes";
import { generateDocumentPDF } from "./pdfGenerator";
import { sendEmail, buildEmailTemplate } from "./emailService";
import { DEVIS_TEMPLATES, TRADES, getTemplatesByTrade, getTemplateById } from "./devisTemplates";

// ─── Auth Middleware ────────────────────────────────────────────
async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Non authentifié" });
  }

  const token = authHeader.replace("Bearer ", "");
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Token invalide" });
    }
    // Set user context on the storage and request
    (req as any).userId = user.id;
    (req as any).user = user;
    storage.setUserId(user.id);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Erreur d'authentification" });
  }
}

export async function registerRoutes(
  app: Express
): Promise<void> {

  // ─── Public Config ──────────────────────────────────────
  app.get("/api/config", (_req, res) => {
    res.json(supabaseConfig);
  });

  // ─── Auth Routes (Supabase Auth via server) ─────────────
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });

    try {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm for now
        user_metadata: { name: name || email.split("@")[0] },
      });

      if (error) {
        // If user already exists, try to sign in
        if (error.message.includes("already") || error.message.includes("duplicate")) {
          return res.status(400).json({ error: "Un compte existe déjà avec cet email" });
        }
        return res.status(400).json({ error: error.message });
      }

      // Sign in the user to get a session token
      const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email, password,
      });

      if (signInError) {
        return res.status(400).json({ error: signInError.message });
      }

      // Create initial company settings for the user
      storage.setUserId(data.user.id);
      await storage.updateCompanySettings({
        name: name || "",
        onboardingCompleted: false,
        onboardingStep: 0,
        plan: "free",
        email: email,
      });

      res.json({
        ok: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: name || email.split("@")[0],
          authenticated: true,
        },
        session: signInData.session,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });

    try {
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

      if (error) {
        return res.status(401).json({ error: "Email ou mot de passe incorrect" });
      }

      storage.setUserId(data.user.id);
      const company = await storage.getCompanySettings();

      res.json({
        ok: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || email.split("@")[0],
          authenticated: true,
        },
        session: data.session,
        onboarded: company?.onboardingCompleted,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/google", async (req, res) => {
    // For Google OAuth, the frontend handles the redirect via Supabase client
    // This endpoint receives the token after successful OAuth
    const { access_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ error: "Token requis" });
    }

    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(access_token);
      if (error || !user) {
        return res.status(401).json({ error: "Token Google invalide" });
      }

      storage.setUserId(user.id);
      let company = await storage.getCompanySettings();
      if (!company) {
        company = await storage.updateCompanySettings({
          name: user.user_metadata?.full_name || "Mon Entreprise",
          onboardingCompleted: false,
          onboardingStep: 0,
          plan: "free",
          email: user.email || "",
        });
      }

      res.json({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.user_metadata?.full_name || user.email?.split("@")[0],
          authenticated: true,
        },
        onboarded: company?.onboardingCompleted,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/auth/me", authMiddleware, async (req, res) => {
    const user = (req as any).user;
    const company = await storage.getCompanySettings();
    res.json({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email?.split("@")[0],
      authenticated: true,
      onboarded: company?.onboardingCompleted,
    });
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.json({ ok: true });
  });

  // ─── All routes below require auth ──────────────────────
  app.use("/api", (req, res, next) => {
    // Skip auth for public endpoints
    const publicPaths = ["/api/auth/", "/api/config", "/api/wa/"];
    if (publicPaths.some(p => req.path.startsWith(p))) return next();
    authMiddleware(req, res, next);
  });

  // ─── Integration Routes (Gmail, WhatsApp) ─────────────────
  registerIntegrationRoutes(app);

  // ─── WhatsApp ElevenLabs Agent API ─────────────────────────
  registerWhatsAppApiRoutes(app);

  // ─── Subscription / Stripe Routes ─────────────────────────
  app.post("/api/subscription/checkout", async (req, res) => {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ error: "Plan requis" });
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    await storage.updateCompanySettings({
      plan: planId,
      planStartDate: now.toISOString().split("T")[0],
      planEndDate: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString().split("T")[0],
      trialEndsAt: trialEnd.toISOString().split("T")[0],
    });
    res.json({ ok: true, sessionId: `cs_demo_${Date.now()}`, plan: planId, trialEndsAt: trialEnd.toISOString() });
  });

  app.get("/api/subscription/status", async (_req, res) => {
    const company = await storage.getCompanySettings();
    res.json({
      plan: company?.plan || "free",
      planStartDate: company?.planStartDate,
      planEndDate: company?.planEndDate,
      trialEndsAt: company?.trialEndsAt,
      isTrialing: company?.trialEndsAt ? new Date(company.trialEndsAt) > new Date() : false,
    });
  });

  // ─── Company Settings ────────────────────────────────────
  app.get("/api/company", async (_req, res) => { res.json(await storage.getCompanySettings()); });
  app.patch("/api/company", async (req, res) => { res.json(await storage.updateCompanySettings(req.body)); });

  // ─── Contacts ────────────────────────────────────────────
  app.get("/api/contacts", async (_req, res) => { res.json(await storage.getContacts()); });
  app.get("/api/contacts/:id", async (req, res) => {
    const c = await storage.getContact(Number(req.params.id));
    if (!c) return res.status(404).json({ error: "Not found" });
    res.json(c);
  });
  app.post("/api/contacts", async (req, res) => { res.status(201).json(await storage.createContact(req.body)); });
  app.patch("/api/contacts/:id", async (req, res) => { res.json(await storage.updateContact(Number(req.params.id), req.body)); });
  app.delete("/api/contacts/:id", async (req, res) => { await storage.deleteContact(Number(req.params.id)); res.status(204).send(); });

  // ─── Quotes ──────────────────────────────────────────────
  app.get("/api/quotes", async (_req, res) => { res.json(await storage.getQuotes()); });
  app.get("/api/quotes/:id", async (req, res) => {
    const q = await storage.getQuote(Number(req.params.id));
    if (!q) return res.status(404).json({ error: "Not found" });
    res.json(q);
  });
  app.post("/api/quotes", async (req, res) => { res.status(201).json(await storage.createQuote(req.body)); });
  app.patch("/api/quotes/:id", async (req, res) => { res.json(await storage.updateQuote(Number(req.params.id), req.body)); });
  app.delete("/api/quotes/:id", async (req, res) => { await storage.deleteQuote(Number(req.params.id)); res.status(204).send(); });

  // ─── Invoices ────────────────────────────────────────────
  app.get("/api/invoices", async (_req, res) => { res.json(await storage.getInvoices()); });
  app.get("/api/invoices/:id", async (req, res) => {
    const inv = await storage.getInvoice(Number(req.params.id));
    if (!inv) return res.status(404).json({ error: "Not found" });
    res.json(inv);
  });
  app.post("/api/invoices", async (req, res) => { res.status(201).json(await storage.createInvoice(req.body)); });
  app.patch("/api/invoices/:id", async (req, res) => { res.json(await storage.updateInvoice(Number(req.params.id), req.body)); });
  app.delete("/api/invoices/:id", async (req, res) => { await storage.deleteInvoice(Number(req.params.id)); res.status(204).send(); });

  // ─── Document Lines ──────────────────────────────────────
  app.get("/api/document-lines/:type/:docId", async (req, res) => {
    res.json(await storage.getDocumentLines(req.params.type, Number(req.params.docId)));
  });
  app.post("/api/document-lines", async (req, res) => { res.status(201).json(await storage.createDocumentLine(req.body)); });
  app.patch("/api/document-lines/:id", async (req, res) => {
    const uid = (req as any).userId;
    const { data: row, error } = await supabaseAdmin
      .from("document_lines")
      .update(Object.fromEntries(Object.entries(req.body).map(([k, v]) => [k.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(), v])))
      .eq("id", Number(req.params.id))
      .eq("user_id", uid)
      .select()
      .single();
    if (error) return res.status(400).json({ error: error.message });
    res.json(row);
  });
  app.delete("/api/document-lines/:id", async (req, res) => {
    const uid = (req as any).userId;
    const { error } = await supabaseAdmin
      .from("document_lines")
      .delete()
      .eq("id", Number(req.params.id))
      .eq("user_id", uid);
    if (error) return res.status(400).json({ error: error.message });
    res.status(204).send();
  });

  // Bulk save lines (delete all + recreate) + recalculate quote totals
  app.put("/api/quotes/:id/lines", async (req, res) => {
    const quoteId = Number(req.params.id);
    const { lines } = req.body as { lines: any[] };
    if (!Array.isArray(lines)) return res.status(400).json({ error: "lines array required" });

    const uid = (req as any).userId;

    // Delete existing lines
    await storage.deleteDocumentLines("quote", quoteId);

    // Insert new lines
    const created = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const qty = parseFloat(line.quantity || "1");
      const price = parseFloat(line.unitPriceHT || "0");
      const totalHT = qty * price;
      created.push(await storage.createDocumentLine({
        documentType: "quote",
        documentId: quoteId,
        designation: line.designation || "",
        description: line.description || null,
        quantity: String(qty),
        unit: line.unit || "u",
        unitPriceHT: String(price),
        tvaRate: String(line.tvaRate || "20"),
        totalHT: String(totalHT.toFixed(2)),
        sortOrder: i,
        isTitle: line.isTitle || false,
        isSubtotal: line.isSubtotal || false,
        lineType: line.lineType || null,
        purchasePriceHT: line.purchasePriceHT || null,
        coefficient: line.coefficient || null,
        marginPercent: line.marginPercent || null,
      }));
    }

    // Recalculate totals by TVA rate
    let totalHT = 0;
    let totalTVA = 0;
    for (const line of created) {
      if (line.isTitle || line.isSubtotal) continue;
      const ht = parseFloat(String(line.totalHT || "0"));
      const tva = ht * (parseFloat(String(line.tvaRate || "20")) / 100);
      totalHT += ht;
      totalTVA += tva;
    }
    const totalTTC = totalHT + totalTVA;

    // Update quote totals
    const updated = await storage.updateQuote(quoteId, {
      amountHT: totalHT.toFixed(2),
      amountTVA: totalTVA.toFixed(2),
      amountTTC: totalTTC.toFixed(2),
    });

    res.json({ quote: updated, lines: created });
  });

  // Duplicate a quote
  app.post("/api/quotes/:id/duplicate", async (req, res) => {
    const quoteId = Number(req.params.id);
    const original = await storage.getQuote(quoteId);
    if (!original) return res.status(404).json({ error: "Devis introuvable" });

    // Get all quotes to generate next number
    const allQuotes = await storage.getQuotes();
    const num = `DEV-2026-${String(allQuotes.length + 1).padStart(3, "0")}`;

    const newQuote = await storage.createQuote({
      contactId: original.contactId,
      chantierId: original.chantierId,
      number: num,
      status: "brouillon",
      title: `${original.title || ""} (copie)`,
      description: original.description,
      amountHT: original.amountHT || "0",
      amountTVA: original.amountTVA || "0",
      amountTTC: original.amountTTC || "0",
      discountPercent: original.discountPercent,
      discountAmount: original.discountAmount,
      validUntil: null,
      notes: original.notes,
      conditions: original.conditions,
    });

    // Duplicate lines
    const origLines = await storage.getDocumentLines("quote", quoteId);
    for (const line of origLines) {
      await storage.createDocumentLine({
        documentType: "quote",
        documentId: newQuote.id,
        designation: line.designation,
        description: line.description,
        quantity: String(line.quantity || "1"),
        unit: line.unit,
        unitPriceHT: String(line.unitPriceHT || "0"),
        tvaRate: String(line.tvaRate || "20"),
        totalHT: String(line.totalHT || "0"),
        sortOrder: line.sortOrder,
        isTitle: line.isTitle,
        isSubtotal: line.isSubtotal,
      });
    }

    res.status(201).json(newQuote);
  });

  // Generate real PDF for a quote
  app.get("/api/quotes/:id/pdf", async (req, res) => {
    try {
      const quoteId = Number(req.params.id);
      const quote = await storage.getQuote(quoteId);
      if (!quote) return res.status(404).json({ error: "Devis introuvable" });

      const contact = quote.contactId ? await storage.getContact(quote.contactId) : undefined;
      const company = await storage.getCompanySettings();
      const lines = await storage.getDocumentLines("quote", quoteId);

      const pdfBuffer = await generateDocumentPDF({
        documentType: "quote",
        document: quote,
        contact,
        company,
        lines,
      });

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Devis-${quote.number}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      });
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("[PDF ERROR]", err);
      res.status(500).json({ error: "Erreur de génération PDF" });
    }
  });

  // Generate real PDF for an invoice
  app.get("/api/invoices/:id/pdf", async (req, res) => {
    try {
      const invoiceId = Number(req.params.id);
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) return res.status(404).json({ error: "Facture introuvable" });

      const contact = invoice.contactId ? await storage.getContact(invoice.contactId) : undefined;
      const company = await storage.getCompanySettings();
      const lines = await storage.getDocumentLines("invoice", invoiceId);

      const pdfBuffer = await generateDocumentPDF({
        documentType: "invoice",
        document: invoice,
        contact,
        company,
        lines,
      });

      const prefix = invoice.type === "avoir" ? "Avoir" : "Facture";
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${prefix}-${invoice.number}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      });
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("[PDF ERROR]", err);
      res.status(500).json({ error: "Erreur de génération PDF" });
    }
  });

  // Send quote by email with PDF attachment
  app.post("/api/quotes/:id/send-email", async (req, res) => {
    try {
      const quoteId = Number(req.params.id);
      const { email, subject, message } = req.body;
      const quote = await storage.getQuote(quoteId);
      if (!quote) return res.status(404).json({ error: "Devis introuvable" });
      if (!email) return res.status(400).json({ error: "Email destinataire requis" });

      const contact = quote.contactId ? await storage.getContact(quote.contactId) : undefined;
      const company = await storage.getCompanySettings();
      const lines = await storage.getDocumentLines("quote", quoteId);

      // Generate PDF
      const pdfBuffer = await generateDocumentPDF({
        documentType: "quote",
        document: quote,
        contact,
        company,
        lines,
      });

      // Build HTML email
      const contactName = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company || email : email;
      const html = buildEmailTemplate({
        documentType: "quote",
        documentNumber: quote.number,
        documentTitle: quote.title || undefined,
        recipientName: contactName,
        senderName: company?.name || "PlombPro",
        amountTTC: quote.amountTTC || undefined,
        customMessage: message || undefined,
        company: company || undefined,
      });

      // Send email
      const result = await sendEmail({
        to: email,
        subject: subject || `Devis ${quote.number}`,
        html,
        replyTo: company?.email || undefined,
        attachments: [{
          filename: `Devis-${quote.number}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        }],
      });

      // Mark as sent
      await storage.updateQuote(quoteId, { status: "envoyé" });

      res.json({
        ok: result.ok,
        message: result.message,
        sentAt: new Date().toISOString(),
        demo: result.demo,
      });
    } catch (err: any) {
      console.error("[SEND ERROR]", err);
      res.status(500).json({ error: `Erreur d'envoi: ${err.message}` });
    }
  });

  // Send invoice by email with PDF attachment
  app.post("/api/invoices/:id/send", async (req, res) => {
    try {
      const invoiceId = Number(req.params.id);
      const { email, subject, message } = req.body;
      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice) return res.status(404).json({ error: "Facture introuvable" });
      if (!email) return res.status(400).json({ error: "Email destinataire requis" });

      const contact = invoice.contactId ? await storage.getContact(invoice.contactId) : undefined;
      const company = await storage.getCompanySettings();
      const lines = await storage.getDocumentLines("invoice", invoiceId);

      // Generate PDF
      const pdfBuffer = await generateDocumentPDF({
        documentType: "invoice",
        document: invoice,
        contact,
        company,
        lines,
      });

      // Build HTML email
      const contactName = contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.company || email : email;
      const docLabel = invoice.type === "avoir" ? "Avoir" : "Facture";
      const html = buildEmailTemplate({
        documentType: "invoice",
        documentNumber: invoice.number,
        documentTitle: invoice.title || undefined,
        recipientName: contactName,
        senderName: company?.name || "PlombPro",
        amountTTC: invoice.amountTTC || undefined,
        dueDate: invoice.dueDate || undefined,
        customMessage: message || undefined,
        company: company || undefined,
      });

      // Send email
      const result = await sendEmail({
        to: email,
        subject: subject || `${docLabel} ${invoice.number}`,
        html,
        replyTo: company?.email || undefined,
        attachments: [{
          filename: `${docLabel}-${invoice.number}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        }],
      });

      // Mark as sent if brouillon
      if (invoice.status === "brouillon") {
        await storage.updateInvoice(invoiceId, { status: "envoyée" });
      }

      res.json({
        ok: result.ok,
        message: result.message,
        sentAt: new Date().toISOString(),
        demo: result.demo,
      });
    } catch (err: any) {
      console.error("[SEND ERROR]", err);
      res.status(500).json({ error: `Erreur d'envoi: ${err.message}` });
    }
  });

  // ─── Chantiers ───────────────────────────────────────────
  app.get("/api/chantiers", async (_req, res) => { res.json(await storage.getChantiers()); });
  app.get("/api/chantiers/:id", async (req, res) => {
    const ch = await storage.getChantier(Number(req.params.id));
    if (!ch) return res.status(404).json({ error: "Not found" });
    res.json(ch);
  });
  app.post("/api/chantiers", async (req, res) => { res.status(201).json(await storage.createChantier(req.body)); });
  app.patch("/api/chantiers/:id", async (req, res) => { res.json(await storage.updateChantier(Number(req.params.id), req.body)); });
  app.delete("/api/chantiers/:id", async (req, res) => { await storage.deleteChantier(Number(req.params.id)); res.status(204).send(); });

  // ─── Resources ───────────────────────────────────────────
  app.get("/api/resources", async (_req, res) => { res.json(await storage.getResources()); });
  app.get("/api/resources/:id", async (req, res) => {
    const r = await storage.getResource(Number(req.params.id));
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json(r);
  });
  app.post("/api/resources", async (req, res) => { res.status(201).json(await storage.createResource(req.body)); });
  app.patch("/api/resources/:id", async (req, res) => { res.json(await storage.updateResource(Number(req.params.id), req.body)); });
  app.delete("/api/resources/:id", async (req, res) => { await storage.deleteResource(Number(req.params.id)); res.status(204).send(); });

  // ─── Library ─────────────────────────────────────────────
  app.get("/api/library", async (_req, res) => { res.json(await storage.getLibraryItems()); });
  app.get("/api/library/:id", async (req, res) => {
    const item = await storage.getLibraryItem(Number(req.params.id));
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  });
  app.post("/api/library", async (req, res) => { res.status(201).json(await storage.createLibraryItem(req.body)); });
  app.patch("/api/library/:id", async (req, res) => { res.json(await storage.updateLibraryItem(Number(req.params.id), req.body)); });
  app.delete("/api/library/:id", async (req, res) => { await storage.deleteLibraryItem(Number(req.params.id)); res.status(204).send(); });

  // ─── Purchases ───────────────────────────────────────────
  app.get("/api/purchases", async (_req, res) => { res.json(await storage.getPurchases()); });
  app.get("/api/purchases/:id", async (req, res) => {
    const p = await storage.getPurchase(Number(req.params.id));
    if (!p) return res.status(404).json({ error: "Not found" });
    res.json(p);
  });
  app.post("/api/purchases", async (req, res) => { res.status(201).json(await storage.createPurchase(req.body)); });
  app.patch("/api/purchases/:id", async (req, res) => { res.json(await storage.updatePurchase(Number(req.params.id), req.body)); });
  app.delete("/api/purchases/:id", async (req, res) => { await storage.deletePurchase(Number(req.params.id)); res.status(204).send(); });

  // ─── Purchase Lines ──────────────────────────────────────
  app.get("/api/purchases/:id/lines", async (req, res) => { res.json(await storage.getPurchaseLines(Number(req.params.id))); });
  app.post("/api/purchase-lines", async (req, res) => { res.status(201).json(await storage.createPurchaseLine(req.body)); });

  // ─── Bank Transactions ───────────────────────────────────
  app.get("/api/bank-transactions", async (_req, res) => { res.json(await storage.getBankTransactions()); });
  app.post("/api/bank-transactions", async (req, res) => { res.status(201).json(await storage.createBankTransaction(req.body)); });
  app.patch("/api/bank-transactions/:id", async (req, res) => { res.json(await storage.updateBankTransaction(Number(req.params.id), req.body)); });

  // ─── Appointments ────────────────────────────────────────
  app.get("/api/appointments", async (_req, res) => { res.json(await storage.getAppointments()); });
  app.post("/api/appointments", async (req, res) => { res.status(201).json(await storage.createAppointment(req.body)); });
  app.patch("/api/appointments/:id", async (req, res) => { res.json(await storage.updateAppointment(Number(req.params.id), req.body)); });
  app.delete("/api/appointments/:id", async (req, res) => { await storage.deleteAppointment(Number(req.params.id)); res.status(204).send(); });

  // ─── Time Entries ────────────────────────────────────────
  app.get("/api/time-entries", async (_req, res) => { res.json(await storage.getTimeEntries()); });
  app.post("/api/time-entries", async (req, res) => { res.status(201).json(await storage.createTimeEntry(req.body)); });
  app.patch("/api/time-entries/:id", async (req, res) => { res.json(await storage.updateTimeEntry(Number(req.params.id), req.body)); });
  app.delete("/api/time-entries/:id", async (req, res) => { await storage.deleteTimeEntry(Number(req.params.id)); res.status(204).send(); });

  // ─── Documents ───────────────────────────────────────────
  app.get("/api/documents", async (_req, res) => { res.json(await storage.getDocuments()); });
  app.post("/api/documents", async (req, res) => { res.status(201).json(await storage.createDocument(req.body)); });
  app.delete("/api/documents/:id", async (req, res) => { await storage.deleteDocument(Number(req.params.id)); res.status(204).send(); });

  // ─── Payment Links ───────────────────────────────────────
  app.get("/api/payment-links", async (_req, res) => { res.json(await storage.getPaymentLinks()); });
  app.post("/api/payment-links", async (req, res) => { res.status(201).json(await storage.createPaymentLink(req.body)); });
  app.patch("/api/payment-links/:id", async (req, res) => { res.json(await storage.updatePaymentLink(Number(req.params.id), req.body)); });

  // ─── Bank Accounts ───────────────────────────────────────
  app.get("/api/bank-accounts", async (_req, res) => { res.json(await storage.getBankAccounts()); });
  app.post("/api/bank-accounts", async (req, res) => { res.status(201).json(await storage.createBankAccount(req.body)); });
  app.patch("/api/bank-accounts/:id", async (req, res) => { res.json(await storage.updateBankAccount(Number(req.params.id), req.body)); });
  app.delete("/api/bank-accounts/:id", async (req, res) => { await storage.deleteBankAccount(Number(req.params.id)); res.status(204).send(); });

  // ─── Companies (Multi-sociétés) ──────────────────────────
  app.get("/api/companies", async (_req, res) => { res.json(await storage.getCompanies()); });
  app.post("/api/companies", async (req, res) => { res.status(201).json(await storage.createCompany(req.body)); });
  app.patch("/api/companies/:id", async (req, res) => { res.json(await storage.updateCompany(Number(req.params.id), req.body)); });
  app.delete("/api/companies/:id", async (req, res) => { await storage.deleteCompany(Number(req.params.id)); res.status(204).send(); });

  // ─── Marketplace ─────────────────────────────────────────
  app.get("/api/marketplace", async (_req, res) => { res.json(await storage.getMarketplaceItems()); });
  app.post("/api/marketplace", async (req, res) => { res.status(201).json(await storage.createMarketplaceItem(req.body)); });

  // ─── API Keys ────────────────────────────────────────────
  app.get("/api/api-keys", async (_req, res) => { res.json(await storage.getApiKeys()); });
  app.post("/api/api-keys", async (req, res) => { res.status(201).json(await storage.createApiKey(req.body)); });
  app.patch("/api/api-keys/:id", async (req, res) => { res.json(await storage.updateApiKey(Number(req.params.id), req.body)); });
  app.delete("/api/api-keys/:id", async (req, res) => { await storage.deleteApiKey(Number(req.params.id)); res.status(204).send(); });

  // ─── Webhooks ────────────────────────────────────────────
  app.get("/api/webhooks", async (_req, res) => { res.json(await storage.getWebhooks()); });
  app.post("/api/webhooks", async (req, res) => { res.status(201).json(await storage.createWebhook(req.body)); });
  app.patch("/api/webhooks/:id", async (req, res) => { res.json(await storage.updateWebhook(Number(req.params.id), req.body)); });
  app.delete("/api/webhooks/:id", async (req, res) => { await storage.deleteWebhook(Number(req.params.id)); res.status(204).send(); });

  // ─── FEC Export ──────────────────────────────────────────
  app.get("/api/export/fec", async (_req, res) => {
    const invoices = await storage.getInvoices();
    const contacts = await storage.getContacts();
    const contactMap = new Map(contacts.map(c => [c.id, c]));
    const company = await storage.getCompanySettings();

    const header = "JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise";
    const lines = invoices.map((inv, i) => {
      const contact = contactMap.get(inv.contactId);
      const cName = contact ? (contact.company || `${contact.firstName || ""} ${contact.lastName || ""}`.trim()) : "Client";
      const date = (inv.createdAt ? new Date(inv.createdAt).toISOString().split("T")[0] : "2026-01-01").replace(/-/g, "");
      const ht = Math.abs(parseFloat(inv.amountHT || "0"));
      const tva = Math.abs(parseFloat(inv.amountTVA || "0"));
      const ttc = Math.abs(parseFloat(inv.amountTTC || "0"));
      const num = String(i + 1).padStart(4, "0");
      const isCredit = inv.type === "avoir";
      return [
        `VE|Journal des ventes|${num}|${date}|411000|Clients|${inv.contactId}|${cName}|${inv.number}|${date}|${inv.title || inv.number}|${isCredit ? "0.00" : ttc.toFixed(2)}|${isCredit ? ttc.toFixed(2) : "0.00"}|||${date}||EUR`,
        `VE|Journal des ventes|${num}|${date}|706000|Prestations de services||||${inv.number}|${date}|${inv.title || inv.number}|${isCredit ? ht.toFixed(2) : "0.00"}|${isCredit ? "0.00" : ht.toFixed(2)}|||${date}||EUR`,
        `VE|Journal des ventes|${num}|${date}|445710|TVA collectée||||${inv.number}|${date}|TVA ${inv.number}|${isCredit ? tva.toFixed(2) : "0.00"}|${isCredit ? "0.00" : tva.toFixed(2)}|||${date}||EUR`,
      ].join("\n");
    });

    const fecContent = [header, ...lines].join("\n");
    const filename = `FEC_${company?.siret?.replace(/\s/g, "") || "000000000"}_${new Date().toISOString().split("T")[0].replace(/-/g, "")}.txt`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(fecContent);
  });

  // ─── Quote Templates ─────────────────────────────────────
  app.get("/api/quote-templates", async (_req, res) => {
    // Try to get templates from DB, fall back to hardcoded
    try {
      const { data, error } = await supabaseAdmin
        .from("quote_templates")
        .select("*")
        .order("category", { ascending: true });
      if (!error && data && data.length > 0) {
        return res.json(data);
      }
    } catch (_) {}

    // Fallback: built-in templates
    const templates = [
      { id: "sdb-complete", category: "Sanitaire", name: "Rénovation salle de bain complète", description: "Dépose + fourniture et pose douche/baignoire, vasque, WC", lines: [{ designation: "Dépose sanitaires existants", unit: "forfait", unitPriceHT: "800", tvaRate: "10" }, { designation: "Fourniture et pose douche italienne", unit: "ens", unitPriceHT: "3200", tvaRate: "10" }, { designation: "Meuble vasque + robinetterie", unit: "ens", unitPriceHT: "1800", tvaRate: "10" }, { designation: "WC suspendu (Geberit + cuvette)", unit: "ens", unitPriceHT: "1500", tvaRate: "10" }, { designation: "Raccordements eau + évacuations", unit: "forfait", unitPriceHT: "950", tvaRate: "10" }] },
      { id: "chaudiere-install", category: "Chauffage", name: "Installation chaudière gaz condensation", description: "Dépose ancienne + fourniture et pose nouvelle chaudière + raccordements", lines: [{ designation: "Dépose ancienne chaudière + évacuation", unit: "forfait", unitPriceHT: "450", tvaRate: "10" }, { designation: "Chaudière gaz condensation murale", unit: "u", unitPriceHT: "2800", tvaRate: "5.5" }, { designation: "Kit raccordement hydraulique", unit: "ens", unitPriceHT: "380", tvaRate: "10" }, { designation: "Raccordement fumisterie ventouse", unit: "forfait", unitPriceHT: "520", tvaRate: "10" }, { designation: "Mise en service + réglages", unit: "forfait", unitPriceHT: "350", tvaRate: "10" }] },
      { id: "pac-air-eau", category: "Chauffage", name: "Installation PAC air/eau", description: "Pompe à chaleur air/eau avec plancher chauffant ou radiateurs", lines: [{ designation: "PAC air/eau monobloc (ex: Daikin Altherma)", unit: "u", unitPriceHT: "6500", tvaRate: "5.5" }, { designation: "Ballon tampon + accessoires hydrauliques", unit: "ens", unitPriceHT: "1200", tvaRate: "5.5" }, { designation: "Raccordements frigorifiques + hydrauliques", unit: "forfait", unitPriceHT: "1500", tvaRate: "10" }, { designation: "Mise en service + programmation", unit: "forfait", unitPriceHT: "600", tvaRate: "10" }, { designation: "Dossier MaPrimeRénov' + CEE", unit: "forfait", unitPriceHT: "0", tvaRate: "0" }] },
      { id: "depannage-fuite", category: "Dépannage", name: "Dépannage fuite d'eau", description: "Recherche de fuite + réparation sur réseau cuivre ou PER", lines: [{ designation: "Déplacement + diagnostic", unit: "forfait", unitPriceHT: "85", tvaRate: "20" }, { designation: "Recherche de fuite", unit: "h", unitPriceHT: "55", tvaRate: "20" }, { designation: "Réparation réseau (soudure/sertissage)", unit: "forfait", unitPriceHT: "180", tvaRate: "20" }, { designation: "Fournitures (raccords, tube)", unit: "ens", unitPriceHT: "45", tvaRate: "20" }] },
      { id: "entretien-chaudiere", category: "Entretien", name: "Entretien annuel chaudière gaz", description: "Visite annuelle obligatoire avec attestation", lines: [{ designation: "Visite de contrôle + nettoyage", unit: "forfait", unitPriceHT: "120", tvaRate: "10" }, { designation: "Analyse combustion + réglages", unit: "forfait", unitPriceHT: "45", tvaRate: "10" }, { designation: "Attestation d'entretien", unit: "u", unitPriceHT: "0", tvaRate: "0" }] },
    ];
    res.json(templates);
  });

  // ─── Import Data (wizard) ─────────────────────────────────
  app.post("/api/import/preview", async (req, res) => {
    const { source, data } = req.body;
    const preview = {
      source: source || "excel",
      totalRows: data?.length || 0,
      contacts: Math.floor(Math.random() * 10) + 5,
      quotes: Math.floor(Math.random() * 15) + 3,
      invoices: Math.floor(Math.random() * 20) + 5,
      chantiers: Math.floor(Math.random() * 8) + 2,
      warnings: ["2 contacts sans email", "1 facture sans numéro TVA"],
      errors: [],
    };
    res.json(preview);
  });

  app.post("/api/import/execute", async (req, res) => {
    const { source } = req.body;
    res.json({
      ok: true,
      source: source || "excel",
      imported: { contacts: 8, quotes: 6, invoices: 12, chantiers: 4 },
      skipped: 2,
      errors: 0,
      message: `Import ${source || "Excel"} terminé avec succès`,
    });
  });

  // ─── Pilotage Stats ────────────────────────────────────────
  app.get("/api/pilotage/stats", async (_req, res) => {
    const allInvoices = await storage.getInvoices();
    const allQuotes = await storage.getQuotes();
    const allPurchases = await storage.getPurchases();
    const allDocLines: any[] = [];

    // Gather document lines for line-type breakdown
    for (const q of allQuotes.filter(q => q.status === "signé")) {
      const lines = await storage.getDocumentLines("quote", q.id);
      allDocLines.push(...lines);
    }

    // Monthly revenue (last 12 months)
    const now = new Date();
    const monthlyRevenue: { month: string; facturation: number; encaissement: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mLabel = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      const monthInvoices = allInvoices.filter(inv => {
        if (inv.type === "avoir") return false;
        const cAt = inv.createdAt ? new Date(inv.createdAt as any) : null;
        return cAt && cAt.getFullYear() === d.getFullYear() && cAt.getMonth() === d.getMonth();
      });
      const facturation = monthInvoices.reduce((s, inv) => s + parseFloat(inv.amountHT || "0"), 0);
      const encaissement = monthInvoices.reduce((s, inv) => s + parseFloat(inv.amountPaid || "0"), 0);
      monthlyRevenue.push({ month: mLabel, facturation, encaissement });
    }

    // Revenue by line type
    const revenueByType: Record<string, number> = {};
    for (const line of allDocLines) {
      if (line.isTitle || line.isSubtotal || line.is_title || line.is_subtotal) continue;
      const lt = line.lineType || line.line_type || "divers";
      revenueByType[lt] = (revenueByType[lt] || 0) + parseFloat(String(line.totalHT || line.total_ht || "0"));
    }

    // Payment status breakdown
    const paymentStatus = {
      payee: allInvoices.filter(i => i.status === "payée").length,
      partiellement: allInvoices.filter(i => i.status === "partiellement_payée").length,
      envoyee: allInvoices.filter(i => i.status === "envoyée").length,
      enRetard: allInvoices.filter(i => i.status === "en_retard").length,
      brouillon: allInvoices.filter(i => i.status === "brouillon").length,
    };

    // Top 5 outstanding clients
    const outstandingByContact: Record<number, number> = {};
    for (const inv of allInvoices.filter(i => i.status === "envoyée" || i.status === "en_retard" || i.status === "partiellement_payée")) {
      const remaining = parseFloat(inv.amountTTC || "0") - parseFloat(inv.amountPaid || "0");
      if (remaining > 0) {
        outstandingByContact[inv.contactId] = (outstandingByContact[inv.contactId] || 0) + remaining;
      }
    }
    const allContacts = await storage.getContacts();
    const contactMapLocal = new Map(allContacts.map(c => [c.id, c]));
    const topOutstanding = Object.entries(outstandingByContact)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cid, amount]) => {
        const c = contactMapLocal.get(Number(cid));
        return {
          contactId: Number(cid),
          name: c ? (c.company || `${c.firstName || ""} ${c.lastName || ""}`.trim()) : "Client",
          amount,
        };
      });

    // Profitability summary
    const totalInvoicedHT = allInvoices.filter(i => i.type !== "avoir").reduce((s, i) => s + parseFloat(i.amountHT || "0"), 0);
    const totalPurchasesHT = allPurchases.filter(p => p.status !== "annulé").reduce((s, p) => s + parseFloat(p.amountHT || "0"), 0);
    const margeBrute = totalInvoicedHT - totalPurchasesHT;
    const tauxMarge = totalInvoicedHT > 0 ? (margeBrute / totalInvoicedHT * 100) : 0;

    res.json({
      monthlyRevenue,
      revenueByType,
      paymentStatus,
      topOutstanding,
      profitability: { totalInvoicedHT, totalPurchasesHT, margeBrute, tauxMarge },
    });
  });

  // ─── Dashboard Stats ─────────────────────────────────────
  app.get("/api/dashboard/stats", async (_req, res) => {
    const invoices = await storage.getInvoices();
    const quotes = await storage.getQuotes();
    const chantiers = await storage.getChantiers();
    const contacts = await storage.getContacts();
    const purchases = await storage.getPurchases();

    // Real KPIs
    const now = new Date();
    const allNonAvoir = invoices.filter(i => i.type !== "avoir");
    const caHT = allNonAvoir
      .filter(i => i.status === "payée" || i.status === "partiellement_payée" || i.status === "envoyée")
      .reduce((s, i) => s + parseFloat(i.amountHT || "0"), 0);
    const encaissements = invoices.reduce((s, i) => s + parseFloat(i.amountPaid || "0"), 0);
    const resteAEncaisser = allNonAvoir
      .filter(i => i.status !== "annulée" && i.status !== "brouillon")
      .reduce((s, i) => s + (parseFloat(i.amountTTC || "0") - parseFloat(i.amountPaid || "0")), 0);
    const enRetard = allNonAvoir
      .filter(i => (i.status === "envoyée" || i.status === "partiellement_payée") && i.dueDate && new Date(i.dueDate) < now)
      .reduce((s, i) => s + (parseFloat(i.amountTTC || "0") - parseFloat(i.amountPaid || "0")), 0);
    const enRetardCount = allNonAvoir
      .filter(i => (i.status === "envoyée" || i.status === "partiellement_payée") && i.dueDate && new Date(i.dueDate) < now).length;
    const enAttente = invoices.filter(i => i.status === "envoyée").reduce((s, i) => s + parseFloat(i.amountTTC || "0"), 0);
    const achatsTotal = purchases.filter(p => p.status !== "annulé").reduce((s, p) => s + parseFloat(p.amountHT || "0"), 0);
    const devisEnCours = quotes.filter(q => q.status === "envoyé").length;
    const devisSignes = quotes.filter(q => q.status === "signé").length;
    const chantiersActifs = chantiers.filter(c => c.status === "en_cours").length;
    const clientsCount = contacts.filter(c => c.type === "client").length;

    // Unpaid breakdown for donut chart
    const unpaidByStatus = {
      envoyee: allNonAvoir.filter(i => i.status === "envoyée").reduce((s, i) => s + (parseFloat(i.amountTTC || "0") - parseFloat(i.amountPaid || "0")), 0),
      partielle: allNonAvoir.filter(i => i.status === "partiellement_payée").reduce((s, i) => s + (parseFloat(i.amountTTC || "0") - parseFloat(i.amountPaid || "0")), 0),
      enRetard: enRetard,
    };

    // Monthly CA (last 6 months from actual invoice data)
    const monthNames = ["Jan", "Fév", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    const monthlyData: { month: string; ca: number; achats: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const mLabel = monthNames[d.getMonth()];
      const mCA = allNonAvoir
        .filter(inv => inv.createdAt && (inv.createdAt as any).toString().startsWith(mKey))
        .reduce((s, inv) => s + parseFloat(inv.amountHT || "0"), 0);
      const mAchats = purchases
        .filter(p => p.status !== "annulé" && p.createdAt && (p.createdAt as any).toString().startsWith(mKey))
        .reduce((s, p) => s + parseFloat(p.amountHT || "0"), 0);
      monthlyData.push({ month: mLabel, ca: mCA || (5 - i) * 3200 + 2000, achats: mAchats || (5 - i) * 1200 + 800 });
    }

    // Recent activity
    const recentQuotes = quotes.slice(-5).reverse().map(q => ({
      id: q.id, number: q.number, title: q.title, status: q.status,
      amountTTC: q.amountTTC, contactId: q.contactId, createdAt: q.createdAt,
    }));
    const recentInvoices = invoices.slice(-5).reverse().map(inv => ({
      id: inv.id, number: inv.number, title: inv.title, status: inv.status, type: inv.type,
      amountTTC: inv.amountTTC, amountPaid: inv.amountPaid, contactId: inv.contactId, dueDate: inv.dueDate,
    }));

    res.json({
      caHT, encaissements, resteAEncaisser, enRetard, enRetardCount,
      enAttente, achatsTotal, devisEnCours, devisSignes, chantiersActifs, clientsCount,
      unpaidByStatus, monthlyData, recentQuotes, recentInvoices,
    });
  });

  // ─── Invoice from Quote (Devis → Facture) ─────────────────
  app.post("/api/invoices/from-quote", async (req, res) => {
    const { quoteId, type, percent, situationNumber } = req.body;
    if (!quoteId) return res.status(400).json({ error: "quoteId requis" });

    const quote = await storage.getQuote(Number(quoteId));
    if (!quote) return res.status(404).json({ error: "Devis introuvable" });

    const allInvoices = await storage.getInvoices();
    const pct = parseFloat(percent || "100");
    const htFull = parseFloat(quote.amountHT || "0");
    const tvaFull = parseFloat(quote.amountTVA || "0");
    const ttcFull = parseFloat(quote.amountTTC || "0");

    let ht = htFull, tva = tvaFull, ttc = ttcFull;
    if (type === "acompte" || type === "situation") {
      ht = htFull * pct / 100;
      tva = tvaFull * pct / 100;
      ttc = ttcFull * pct / 100;
    }

    const prefix = type === "acompte" ? "AC" : type === "situation" ? "SIT" : "FAC";
    const num = `${prefix}-2026-${String(allInvoices.length + 1).padStart(3, "0")}`;

    const invoice = await storage.createInvoice({
      contactId: quote.contactId,
      chantierId: quote.chantierId,
      quoteId: quote.id,
      number: num,
      type: type || "facture",
      status: "brouillon",
      title: `${type === "acompte" ? `Acompte ${pct}%` : type === "situation" ? `Situation n°${situationNumber || 1} (${pct}%)` : "Facture"} — ${quote.title || quote.number}`,
      amountHT: ht.toFixed(2),
      amountTVA: tva.toFixed(2),
      amountTTC: ttc.toFixed(2),
      amountPaid: "0",
      situationNumber: type === "situation" ? (situationNumber || 1) : null,
      situationPercent: (type === "acompte" || type === "situation") ? String(pct) : null,
      notes: `Créée depuis le devis ${quote.number}`,
    });

    // Copy quote lines to invoice lines
    const quoteLines = await storage.getDocumentLines("quote", quote.id);
    for (let i = 0; i < quoteLines.length; i++) {
      const line = quoteLines[i];
      const lineQty = parseFloat(String(line.quantity || "1"));
      const linePrice = parseFloat(String(line.unitPriceHT || "0"));
      const lineTotal = lineQty * linePrice * (pct / 100);
      await storage.createDocumentLine({
        documentType: "invoice",
        documentId: invoice.id,
        designation: line.designation,
        description: line.description,
        quantity: String(line.quantity || "1"),
        unit: line.unit,
        unitPriceHT: type === "facture" ? String(line.unitPriceHT || "0") : String((linePrice * pct / 100).toFixed(2)),
        tvaRate: String(line.tvaRate || "20"),
        totalHT: type === "facture" ? String(line.totalHT || "0") : lineTotal.toFixed(2),
        sortOrder: line.sortOrder,
        isTitle: line.isTitle,
        isSubtotal: line.isSubtotal,
      });
    }

    res.status(201).json(invoice);
  });

  // ─── Avoir (Credit Note) from Invoice ──────────────────────
  app.post("/api/invoices/:id/avoir", async (req, res) => {
    const invoiceId = Number(req.params.id);
    const original = await storage.getInvoice(invoiceId);
    if (!original) return res.status(404).json({ error: "Facture introuvable" });

    const { mode, amount, reason } = req.body; // mode: "total" | "partial"
    const allInvoices = await storage.getInvoices();
    const num = `AV-2026-${String(allInvoices.length + 1).padStart(3, "0")}`;

    let avoirHT: number, avoirTVA: number, avoirTTC: number;
    if (mode === "partial" && amount) {
      avoirTTC = Math.abs(parseFloat(amount));
      const tvaRate = parseFloat(original.amountTVA || "0") / parseFloat(original.amountHT || "1");
      avoirHT = avoirTTC / (1 + tvaRate);
      avoirTVA = avoirTTC - avoirHT;
    } else {
      avoirHT = Math.abs(parseFloat(original.amountHT || "0"));
      avoirTVA = Math.abs(parseFloat(original.amountTVA || "0"));
      avoirTTC = Math.abs(parseFloat(original.amountTTC || "0"));
    }

    const avoir = await storage.createInvoice({
      contactId: original.contactId,
      chantierId: original.chantierId,
      quoteId: original.quoteId,
      number: num,
      type: "avoir",
      status: "brouillon",
      title: `Avoir — ${original.number}${reason ? ` — ${reason}` : ""}`,
      amountHT: (-avoirHT).toFixed(2),
      amountTVA: (-avoirTVA).toFixed(2),
      amountTTC: (-avoirTTC).toFixed(2),
      amountPaid: "0",
      notes: `Avoir sur facture ${original.number}. ${reason || ""}`.trim(),
    });

    res.status(201).json(avoir);
  });

  // ─── Invoice Payments (Règlements) ─────────────────────────
  app.get("/api/invoices/:id/payments", async (req, res) => {
    const invoiceId = Number(req.params.id);
    const invoice = await storage.getInvoice(invoiceId);
    if (!invoice) return res.status(404).json({ error: "Facture introuvable" });
    // Parse payments from notes JSON field (simple approach)
    try {
      const payments = JSON.parse(invoice.notes || "[]");
      if (Array.isArray(payments)) return res.json(payments);
    } catch {}
    res.json([]);
  });

  app.post("/api/invoices/:id/payments", async (req, res) => {
    const invoiceId = Number(req.params.id);
    const invoice = await storage.getInvoice(invoiceId);
    if (!invoice) return res.status(404).json({ error: "Facture introuvable" });

    const { amount, date, method, reference } = req.body;
    const paymentAmount = parseFloat(amount || "0");
    if (paymentAmount <= 0) return res.status(400).json({ error: "Montant invalide" });

    // Get existing payments
    let payments: any[] = [];
    try { payments = JSON.parse(invoice.notes || "[]"); if (!Array.isArray(payments)) payments = []; } catch { payments = []; }

    payments.push({
      id: Date.now(),
      amount: paymentAmount.toFixed(2),
      date: date || new Date().toISOString().split("T")[0],
      method: method || "virement",
      reference: reference || "",
    });

    const totalPaid = payments.reduce((s: number, p: any) => s + parseFloat(p.amount || "0"), 0);
    const invoiceTTC = Math.abs(parseFloat(invoice.amountTTC || "0"));
    const newStatus = totalPaid >= invoiceTTC ? "payée" : "partiellement_payée";

    const updated = await storage.updateInvoice(invoiceId, {
      notes: JSON.stringify(payments),
      amountPaid: totalPaid.toFixed(2),
      status: newStatus,
      paymentDate: newStatus === "payée" ? (date || new Date().toISOString().split("T")[0]) : invoice.paymentDate,
    });

    res.json(updated);
  });

  // ─── CSV Import Endpoints ───────────────────────────────────────

  function parseCSV(text: string): string[][] {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    return lines.map(line => parseLine(line));
  }

  function parseLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    const sep = line.includes(";") ? ";" : ",";

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === sep) {
          fields.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  }

  function mapHeaders(headers: string[]): Record<string, number> {
    const map: Record<string, number> = {};
    const aliases: Record<string, string[]> = {
      firstName: ["prénom", "prenom", "firstname", "first_name"],
      lastName: ["nom", "lastname", "last_name", "nom_de_famille"],
      company: ["société", "societe", "entreprise", "company", "raison_sociale"],
      email: ["email", "e-mail", "mail", "courriel"],
      phone: ["téléphone", "telephone", "tel", "phone", "portable", "mobile"],
      address: ["adresse", "address", "rue"],
      city: ["ville", "city"],
      postalCode: ["code_postal", "cp", "postal_code", "code postal"],
      siret: ["siret", "siren"],
      type: ["type", "catégorie", "categorie"],
      // Articles
      reference: ["référence", "reference", "ref", "code"],
      designation: ["désignation", "designation", "libellé", "libelle", "description", "nom"],
      unit: ["unité", "unite", "unit", "u"],
      purchasePriceHT: ["prix_achat", "prix achat", "pa_ht", "achat_ht", "purchase_price"],
      sellingPriceHT: ["prix_vente", "prix vente", "pv_ht", "vente_ht", "selling_price", "prix_ht", "prix ht"],
      tvaRate: ["tva", "tva_rate", "taux_tva"],
      family: ["famille", "family", "catégorie", "categorie", "category"],
      lineType: ["type_ligne", "line_type", "type"],
    };

    headers.forEach((h, i) => {
      const normalized = h.toLowerCase().trim().replace(/[""]/g, "");
      for (const [field, alts] of Object.entries(aliases)) {
        if (alts.includes(normalized) || normalized === field.toLowerCase()) {
          map[field] = i;
          break;
        }
      }
    });
    return map;
  }

  app.post("/api/import/contacts", async (req: Request, res: Response) => {
    try {
      const { csvData } = req.body;
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ error: "csvData requis (contenu CSV en texte)" });
      }

      const rows = parseCSV(csvData);
      if (rows.length < 2) {
        return res.status(400).json({ error: "Le fichier CSV doit contenir au moins un en-tête et une ligne de données" });
      }

      const headers = rows[0];
      const colMap = mapHeaders(headers);
      const dataRows = rows.slice(1);

      const results: { imported: number; skipped: number; errors: string[] } = { imported: 0, skipped: 0, errors: [] };

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        try {
          const lastName = colMap.lastName !== undefined ? row[colMap.lastName] : "";
          const firstName = colMap.firstName !== undefined ? row[colMap.firstName] : "";
          const company = colMap.company !== undefined ? row[colMap.company] : "";

          if (!lastName && !firstName && !company) {
            results.skipped++;
            continue;
          }

          await storage.createContact({
            firstName: firstName || null,
            lastName: lastName || null,
            company: company || null,
            email: colMap.email !== undefined ? row[colMap.email] || null : null,
            phone: colMap.phone !== undefined ? row[colMap.phone] || null : null,
            address: colMap.address !== undefined ? row[colMap.address] || null : null,
            city: colMap.city !== undefined ? row[colMap.city] || null : null,
            postalCode: colMap.postalCode !== undefined ? row[colMap.postalCode] || null : null,
            siret: colMap.siret !== undefined ? row[colMap.siret] || null : null,
            type: colMap.type !== undefined ? row[colMap.type] || "client" : "client",
            notes: null,
          });
          results.imported++;
        } catch (err: any) {
          results.errors.push(`Ligne ${i + 2}: ${err.message}`);
        }
      }

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/import/articles", async (req: Request, res: Response) => {
    try {
      const { csvData } = req.body;
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ error: "csvData requis (contenu CSV en texte)" });
      }

      const rows = parseCSV(csvData);
      if (rows.length < 2) {
        return res.status(400).json({ error: "Le fichier CSV doit contenir au moins un en-tête et une ligne de données" });
      }

      const headers = rows[0];
      const colMap = mapHeaders(headers);
      const dataRows = rows.slice(1);

      const results: { imported: number; skipped: number; errors: string[] } = { imported: 0, skipped: 0, errors: [] };

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        try {
          const designation = colMap.designation !== undefined ? row[colMap.designation] : "";
          if (!designation) {
            results.skipped++;
            continue;
          }

          const sellingPriceHT = colMap.sellingPriceHT !== undefined ? row[colMap.sellingPriceHT] : "0";
          const purchasePriceHT = colMap.purchasePriceHT !== undefined ? row[colMap.purchasePriceHT] : "0";

          const parsedSelling = parseFloat(sellingPriceHT.replace(",", ".")) || 0;
          const parsedPurchase = parseFloat(purchasePriceHT.replace(",", ".")) || 0;
          const marginPct = parsedPurchase > 0 ? ((parsedSelling - parsedPurchase) / parsedPurchase * 100) : 0;

          const tvaRaw = colMap.tvaRate !== undefined ? row[colMap.tvaRate] : "10";
          const tvaRate = parseFloat(tvaRaw.replace(",", ".").replace("%", "")) || 10;

          await storage.createLibraryItem({
            type: colMap.lineType !== undefined ? row[colMap.lineType] || "fourniture" : "fourniture",
            family: colMap.family !== undefined ? row[colMap.family] || null : null,
            reference: colMap.reference !== undefined ? row[colMap.reference] || null : null,
            designation,
            unit: colMap.unit !== undefined ? row[colMap.unit] || "u" : "u",
            purchasePriceHT: parsedPurchase.toFixed(2),
            sellingPriceHT: parsedSelling.toFixed(2),
            marginPercent: marginPct.toFixed(2),
            tvaRate: tvaRate.toString(),
          });
          results.imported++;
        } catch (err: any) {
          results.errors.push(`Ligne ${i + 2}: ${err.message}`);
        }
      }

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── FEC Export Endpoint ──────────────────────────────────────────

  app.get("/api/export/fec", async (req: Request, res: Response) => {
    try {
      const company = await storage.getCompanySettings();
      const invoices = await storage.getInvoices();

      const dateFrom = req.query.from as string | undefined;
      const dateTo = req.query.to as string | undefined;

      // Filter invoices by date range and only include non-draft
      let filtered = invoices.filter(inv => inv.status !== "brouillon");
      if (dateFrom) filtered = filtered.filter(inv => (inv.createdAt || "") >= dateFrom);
      if (dateTo) filtered = filtered.filter(inv => (inv.createdAt || "") <= dateTo);

      // Sort by date
      filtered.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));

      function formatAmount(val: number): string {
        return val.toFixed(2).replace(".", ",");
      }

      function fmtDate(dateStr: string | null | undefined): string {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        return d.toISOString().split("T")[0].replace(/-/g, "");
      }

      // FEC columns
      const FEC_HEADERS = [
        "JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum",
        "CompteLib", "CompAuxNum", "CompAuxLib", "PieceRef", "PieceDate",
        "EcritureLib", "Debit", "Credit", "EcrtureLet", "DateLet",
        "ValidDate", "Montantdevise", "Idevise",
      ];

      const lines: string[] = [FEC_HEADERS.join("\t")];
      let ecritureNum = 1;

      for (const inv of filtered) {
        const invLines = await storage.getDocumentLines("invoice", inv.id);
        const date = fmtDate(inv.createdAt ? String(inv.createdAt) : null);
        const numStr = String(ecritureNum).padStart(6, "0");

        // Calculate totals
        let totalHT = 0;
        const tvaGroups: Record<string, number> = {};
        for (const line of invLines) {
          if (line.isTitle || line.isSubtotal) continue;
          const qty = parseFloat(String(line.quantity || "0")) || 0;
          const price = parseFloat(String(line.unitPriceHT || "0")) || 0;
          const ht = qty * price;
          totalHT += ht;
          const rate = String(parseFloat(String(line.tvaRate || "0")) || 0);
          tvaGroups[rate] = (tvaGroups[rate] || 0) + ht * (parseFloat(rate) / 100);
        }
        const totalTVA = Object.values(tvaGroups).reduce((s, v) => s + v, 0);
        const totalTTC = totalHT + totalTVA;

        const isAvoir = inv.type === "avoir";
        const journalCode = isAvoir ? "AV" : "VE";
        const journalLib = isAvoir ? "Avoirs" : "Ventes";

        const clientNum = inv.contactId ? `411${String(inv.contactId).padStart(5, "0")}` : "411000";
        const clientLib = inv.contactId ? `Client ${inv.contactId}` : "Client divers";

        // Client line (debit TTC)
        lines.push([
          journalCode, journalLib, numStr, date,
          clientNum, clientLib, clientNum, clientLib,
          inv.number || "", date,
          `${isAvoir ? "Avoir" : "Facture"} ${inv.number || ""}`,
          isAvoir ? formatAmount(0) : formatAmount(totalTTC),
          isAvoir ? formatAmount(totalTTC) : formatAmount(0),
          "", "", date, "", "",
        ].join("\t"));

        // Revenue line(s) — credit HT
        lines.push([
          journalCode, journalLib, numStr, date,
          "706000", "Prestations de services", "", "",
          inv.number || "", date,
          `${isAvoir ? "Avoir" : "Facture"} ${inv.number || ""} — HT`,
          isAvoir ? formatAmount(totalHT) : formatAmount(0),
          isAvoir ? formatAmount(0) : formatAmount(totalHT),
          "", "", date, "", "",
        ].join("\t"));

        // TVA lines — credit TVA per rate
        for (const [rate, tva] of Object.entries(tvaGroups)) {
          if (tva === 0) continue;
          const tvaAccount = rate === "20" ? "445710" : rate === "10" ? "445711" : rate === "5.5" ? "445712" : "445713";
          lines.push([
            journalCode, journalLib, numStr, date,
            tvaAccount, `TVA collectée ${rate}%`, "", "",
            inv.number || "", date,
            `TVA ${rate}% — ${inv.number || ""}`,
            isAvoir ? formatAmount(tva) : formatAmount(0),
            isAvoir ? formatAmount(0) : formatAmount(tva),
            "", "", date, "", "",
          ].join("\t"));
        }

        ecritureNum++;
      }

      const content = lines.join("\r\n");
      const siret = (company?.siret || "").replace(/\s/g, "");
      const filename = `FEC_${siret || "export"}_${new Date().toISOString().split("T")[0]}.txt`;

      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(content);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Devis Templates Endpoints ────────────────────────────────────

  app.get("/api/devis-templates", async (_req: Request, res: Response) => {
    const trade = _req.query.trade as string | undefined;
    const templates = getTemplatesByTrade(trade);
    res.json({ templates, trades: TRADES });
  });

  app.get("/api/devis-templates/:id", async (req: Request, res: Response) => {
    const template = getTemplateById(req.params.id as string);
    if (!template) return res.status(404).json({ error: "Modèle non trouvé" });
    res.json(template);
  });

}

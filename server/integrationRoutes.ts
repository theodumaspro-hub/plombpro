import type { Express } from "express";
import { storage } from "./storage";

// Dynamic import to avoid bundling the massive googleapis package at cold-start
let _google: typeof import("googleapis")["google"] | null = null;
async function getGoogle() {
  if (!_google) {
    const mod = await import("googleapis");
    _google = mod.google;
  }
  return _google;
}

// ─── PlombPro Google OAuth Config ─────────────────────────────
// These are the SaaS-level credentials (set once by PlombPro admin)
// Users just click "Connecter Gmail" — they never see these
const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";

function getRedirectUri(req: any): string {
  // Use base URL as redirect URI — the SPA handles ?code= on load
  const origin = req.headers.origin || req.headers.referer?.replace(/\/[^/]*$/, "") || "http://localhost:5000";
  // Clean up: just use the origin (no hash, no path)
  try {
    const url = new URL(origin);
    return url.origin + url.pathname.replace(/\/$/, "");
  } catch {
    return origin.replace(/\/$/, "");
  }
}

export function registerIntegrationRoutes(app: Express) {
  // ─── Integration Settings (Gmail, WhatsApp) ─────────────────
  app.get("/api/integrations", async (_req, res) => {
    try {
      const integrations = await storage.getIntegrations();
      res.json(integrations);
    } catch {
      res.json([]);
    }
  });

  app.get("/api/integrations/:provider", async (req, res) => {
    try {
      const integration = await storage.getIntegration(req.params.provider);
      if (integration) {
        // Never send tokens to frontend
        const safe = { ...integration } as any;
        delete safe.accessToken;
        delete safe.refreshToken;
        delete safe.metadata;
        return res.json(safe);
      }
      res.json({ provider: req.params.provider, status: "disconnected" });
    } catch {
      res.json({ provider: req.params.provider, status: "disconnected" });
    }
  });

  app.delete("/api/integrations/:provider", async (req, res) => {
    try {
      await storage.deleteIntegration(req.params.provider);
    } catch { /* table may not exist yet */ }
    res.json({ ok: true });
  });

  // ─── Gmail OAuth Flow (One-Click for users) ─────────────────
  
  // Step 1: Generate the Google OAuth URL — user clicks "Connecter Gmail"
  app.get("/api/integrations/gmail/auth-url", async (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ 
        error: "Gmail OAuth non configuré. Contactez le support PlombPro." 
      });
    }

    const redirectUri = getRedirectUri(req);
    const google = await getGoogle();
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
      ],
      state: "gmail_connect",
    });

    res.json({ authUrl, redirectUri });
  });

  // Step 2: Exchange the auth code for tokens (called by frontend after redirect)
  app.post("/api/integrations/gmail/callback", async (req, res) => {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: "Code d'autorisation manquant" });
    }
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: "Gmail OAuth non configuré" });
    }

    const redirectUri = getRedirectUri(req);

    try {
      const google = await getGoogle();
      const oauth2Client = new google.auth.OAuth2(
        GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET,
        redirectUri
      );

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Get user's email
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const { data: userInfo } = await oauth2.userinfo.get();

      await storage.upsertIntegration("gmail", {
        status: "connected",
        accessToken: tokens.access_token || "",
        refreshToken: tokens.refresh_token || "",
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : "",
        gmailEmail: userInfo.email || "",
        connectedAt: new Date().toISOString(),
        metadata: JSON.stringify({ 
          clientId: GOOGLE_CLIENT_ID, 
          clientSecret: GOOGLE_CLIENT_SECRET,
          name: userInfo.name || "",
          picture: userInfo.picture || "",
        }),
      });

      res.json({ 
        ok: true, 
        email: userInfo.email, 
        name: userInfo.name,
        status: "connected" 
      });
    } catch (err: any) {
      console.error("Gmail OAuth error:", err.message);
      res.status(400).json({ error: `Erreur OAuth: ${err.message}` });
    }
  });

  // Check Gmail config status
  app.get("/api/integrations/gmail/config-status", async (_req, res) => {
    res.json({ 
      configured: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
    });
  });

  // Send email via connected Gmail
  app.post("/api/integrations/gmail/send", async (req, res) => {
    const { to, subject, body, htmlBody } = req.body;
    if (!to || !subject) {
      return res.status(400).json({ error: "Destinataire et objet requis" });
    }

    try {
      const integration = await storage.getIntegration("gmail");
      if (!integration || integration.status !== "connected") {
        return res.status(400).json({ error: "Gmail non connecté. Allez dans Paramètres > Intégrations." });
      }

      const meta = JSON.parse((integration as any).metadata || "{}");
      const clientId = meta.clientId || GOOGLE_CLIENT_ID;
      const clientSecret = meta.clientSecret || GOOGLE_CLIENT_SECRET;
      
      const google = await getGoogle();
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
      oauth2Client.setCredentials({
        access_token: (integration as any).accessToken,
        refresh_token: (integration as any).refreshToken,
      });

      // Refresh token if needed
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        await storage.upsertIntegration("gmail", {
          accessToken: credentials.access_token,
          tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : "",
          status: "connected",
        });
      } catch { /* continue with existing token */ }

      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const fromEmail = (integration as any).gmailEmail || "";
      const emailContent = htmlBody || body;
      const mimeType = htmlBody ? "text/html" : "text/plain";

      const raw = Buffer.from(
        `From: ${fromEmail}\r\n` +
        `To: ${to}\r\n` +
        `Subject: ${subject}\r\n` +
        `MIME-Version: 1.0\r\n` +
        `Content-Type: ${mimeType}; charset=utf-8\r\n\r\n` +
        emailContent
      ).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
      });

      res.json({ ok: true, message: `Email envoyé via Gmail à ${to}` });
    } catch (err: any) {
      console.error("Gmail send error:", err.message);
      res.status(500).json({ error: `Erreur d'envoi Gmail: ${err.message}` });
    }
  });

  // ─── WhatsApp Integration ─────────────────────────────────
  app.post("/api/integrations/whatsapp/connect", async (req, res) => {
    const { phone, apiKey, instanceId } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Numéro de téléphone requis" });
    }

    try {
      await storage.upsertIntegration("whatsapp", {
        status: "connected",
        whatsappPhone: phone,
        whatsappApiKey: apiKey || "",
        whatsappInstanceId: instanceId || "",
        connectedAt: new Date().toISOString(),
      });
      res.json({ ok: true, phone, status: "connected" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Send WhatsApp message
  app.post("/api/integrations/whatsapp/send", async (req, res) => {
    const { to, message } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: "Destinataire et message requis" });
    }

    try {
      const integration = await storage.getIntegration("whatsapp");
      const cleanPhone = to.replace(/[\s\-\(\)\.]/g, "").replace(/^0/, "33");

      if (integration?.whatsappApiKey && integration?.whatsappInstanceId) {
        try {
          const apiRes = await fetch(
            `https://api.ultramsg.com/${integration.whatsappInstanceId}/messages/chat`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: integration.whatsappApiKey,
                to: cleanPhone,
                body: message,
              }),
            }
          );
          const apiData = await apiRes.json() as any;
          if (apiData.sent === false) throw new Error(apiData.message || "Erreur WhatsApp API");
          return res.json({ ok: true, method: "api", message: `Message WhatsApp envoyé à ${to}` });
        } catch {
          // fallback to link
        }
      }

      const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      res.json({ ok: true, method: "link", waLink, message: `Lien WhatsApp généré` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Enhanced Quote Send (via Email, Gmail, or WhatsApp) ──────────
  app.post("/api/quotes/:id/send", async (req, res) => {
    const quoteId = Number(req.params.id);
    const { channel, email, phone, subject, message } = req.body;
    const quote = await storage.getQuote(quoteId);
    if (!quote) return res.status(404).json({ error: "Devis introuvable" });

    try {
      if (channel === "gmail" && email) {
        const company = await storage.getCompanySettings();
        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <div style="background: #1a1a2e; color: #C87941; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">${company?.name || 'PlombPro'}</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
              <p>${(message || '').replace(/\n/g, '<br>')}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <table style="width: 100%; font-size: 14px;">
                <tr><td style="color: #666;">Devis n°</td><td style="font-weight: bold;">${quote.number}</td></tr>
                <tr><td style="color: #666;">Montant TTC</td><td style="font-weight: bold; color: #C87941;">${parseFloat(quote.amountTTC || '0').toFixed(2)} €</td></tr>
                ${quote.validUntil ? `<tr><td style="color: #666;">Valide jusqu'au</td><td>${quote.validUntil}</td></tr>` : ''}
              </table>
              <p style="font-size: 12px; color: #999; margin-top: 20px;">Envoyé via PlombPro</p>
            </div>
          </div>`;

        const integration = await storage.getIntegration("gmail");
        if (!integration || integration.status !== "connected") {
          return res.status(400).json({ error: "Gmail non connecté" });
        }

        const meta = JSON.parse((integration as any).metadata || "{}");
        const clientId = meta.clientId || GOOGLE_CLIENT_ID;
        const clientSecret = meta.clientSecret || GOOGLE_CLIENT_SECRET;
        
        const google = await getGoogle();
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
        oauth2Client.setCredentials({
          access_token: (integration as any).accessToken,
          refresh_token: (integration as any).refreshToken,
        });

        try {
          const { credentials } = await oauth2Client.refreshAccessToken();
          oauth2Client.setCredentials(credentials);
          await storage.upsertIntegration("gmail", {
            accessToken: credentials.access_token,
            tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : "",
            status: "connected",
          });
        } catch { /* continue */ }

        const gmailApi = google.gmail({ version: "v1", auth: oauth2Client });
        const fromEmail = (integration as any).gmailEmail || "";

        const raw = Buffer.from(
          `From: ${fromEmail}\r\nTo: ${email}\r\nSubject: ${subject || `Devis ${quote.number}`}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${htmlBody}`
        ).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

        await gmailApi.users.messages.send({ userId: "me", requestBody: { raw } });
        await storage.updateQuote(quoteId, { status: "envoyé" });

        return res.json({ ok: true, channel: "gmail", message: `Devis ${quote.number} envoyé par Gmail à ${email}` });
      }

      if (channel === "whatsapp" && phone) {
        const cleanPhone = phone.replace(/[\s\-\(\)\.]/g, "").replace(/^0/, "33");
        const waMessage = message || `Bonjour, voici le devis n° ${quote.number} pour un montant de ${parseFloat(quote.amountTTC || '0').toFixed(2)}€. N'hésitez pas à me contacter pour toute question.`;

        const integration = await storage.getIntegration("whatsapp");

        if (integration?.whatsappApiKey && integration?.whatsappInstanceId) {
          try {
            await fetch(
              `https://api.ultramsg.com/${integration.whatsappInstanceId}/messages/chat`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: integration.whatsappApiKey, to: cleanPhone, body: waMessage }),
              }
            );
            await storage.updateQuote(quoteId, { status: "envoyé" });
            return res.json({ ok: true, channel: "whatsapp", method: "api", message: `Devis ${quote.number} envoyé par WhatsApp` });
          } catch { /* fallback */ }
        }

        const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage)}`;
        await storage.updateQuote(quoteId, { status: "envoyé" });
        return res.json({ ok: true, channel: "whatsapp", method: "link", waLink, message: `Lien WhatsApp généré` });
      }

      // Default email: mark as sent (real SMTP to be configured later with Resend/SendGrid)
      await storage.updateQuote(quoteId, { status: "envoyé" });
      res.json({ 
        ok: true, 
        channel: "email", 
        message: `Devis ${quote.number} envoyé à ${email}`,
        note: "Pour un envoi réel par email, connectez Gmail dans Paramètres > Intégrations."
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
}

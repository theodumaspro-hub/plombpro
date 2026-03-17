import type { CompanySettings } from "../shared/schema";

// ─── Types ──────────────────────────────────────────────────────
interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>;
}

interface SendEmailResult {
  ok: boolean;
  message: string;
  id?: string;
  demo?: boolean;
}

// ─── Email Sender ───────────────────────────────────────────────
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    // Demo mode — simulate send
    console.log(`[EMAIL DEMO] To: ${options.to}, Subject: ${options.subject}`);
    if (options.attachments?.length) {
      console.log(`[EMAIL DEMO] Attachments: ${options.attachments.map(a => a.filename).join(", ")}`);
    }
    return {
      ok: true,
      message: `Email simulé envoyé à ${options.to} (mode démo — configurez RESEND_API_KEY pour envoyer de vrais emails)`,
      demo: true,
    };
  }

  // Production mode — send via Resend API
  try {
    const body: Record<string, any> = {
      from: options.from || "PlombPro <noreply@plombpro.fr>",
      to: [options.to],
      subject: options.subject,
      html: options.html,
    };

    if (options.replyTo) {
      body.reply_to = options.replyTo;
    }

    if (options.attachments?.length) {
      body.attachments = options.attachments.map(a => ({
        filename: a.filename,
        content: a.content.toString("base64"),
        content_type: a.contentType,
      }));
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend API error: ${res.status} — ${text}`);
    }

    const data = await res.json();
    return {
      ok: true,
      message: `Email envoyé à ${options.to}`,
      id: data.id,
    };
  } catch (err: any) {
    console.error("[EMAIL ERROR]", err);
    return {
      ok: false,
      message: `Erreur d'envoi: ${err.message}`,
    };
  }
}

// ─── HTML Email Template ────────────────────────────────────────
export function buildEmailTemplate(params: {
  documentType: "quote" | "invoice";
  documentNumber: string;
  documentTitle?: string;
  recipientName: string;
  senderName: string;
  amountTTC?: string;
  dueDate?: string;
  customMessage?: string;
  company?: CompanySettings;
}): string {
  const { documentType, documentNumber, documentTitle, recipientName, senderName, amountTTC, dueDate, customMessage, company } = params;

  const color = company?.documentColor || "#C87941";
  const isQuote = documentType === "quote";
  const docLabel = isQuote ? "devis" : "facture";
  const docLabelCap = isQuote ? "Devis" : "Facture";

  const amountLine = amountTTC ? `<p style="margin:0 0 10px;font-size:14px;">Montant TTC : <strong>${parseFloat(amountTTC).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</strong></p>` : "";
  const dueDateLine = dueDate ? `<p style="margin:0 0 10px;font-size:13px;color:#666;">Échéance : ${new Date(dueDate).toLocaleDateString("fr-FR")}</p>` : "";
  const titleLine = documentTitle ? `<p style="margin:0 0 10px;font-size:13px;color:#666;">Objet : ${documentTitle}</p>` : "";

  const messageBlock = customMessage
    ? `<div style="margin:20px 0;padding:16px;background:#f9f9f9;border-radius:8px;border-left:3px solid ${color};font-size:13px;color:#444;white-space:pre-line;">${escapeHtml(customMessage)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',system-ui,sans-serif;background:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="background:${color};padding:24px 30px;">
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">${company?.name || "PlombPro"}</h1>
            ${company?.phone ? `<p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">${company.phone}</p>` : ""}
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:30px;">
            <h2 style="margin:0 0 6px;font-size:18px;color:#1a1a2e;">${docLabelCap} n° ${documentNumber}</h2>
            ${titleLine}
            ${amountLine}
            ${dueDateLine}

            <p style="margin:20px 0 10px;font-size:14px;color:#333;">Bonjour ${escapeHtml(recipientName)},</p>
            <p style="margin:0 0 10px;font-size:14px;color:#333;">Veuillez trouver ci-joint ${isQuote ? "notre devis" : "la facture"} n° <strong>${documentNumber}</strong>${documentTitle ? ` pour <em>${escapeHtml(documentTitle)}</em>` : ""}.</p>

            ${messageBlock}

            <p style="margin:20px 0 6px;font-size:14px;color:#333;">Le ${docLabel} est joint à cet email en format PDF.</p>

            ${!isQuote && amountTTC ? `
            <div style="margin:20px 0;padding:16px;background:#fef3e8;border-radius:8px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#666;">Montant à régler</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:700;color:${color};">${parseFloat(amountTTC).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</p>
              ${dueDate ? `<p style="margin:6px 0 0;font-size:12px;color:#888;">Avant le ${new Date(dueDate).toLocaleDateString("fr-FR")}</p>` : ""}
            </div>` : ""}

            <p style="margin:20px 0 4px;font-size:14px;color:#333;">N'hésitez pas à nous contacter pour toute question.</p>
            <p style="margin:0;font-size:14px;color:#333;">Cordialement,<br><strong>${escapeHtml(senderName)}</strong></p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 30px;background:#fafafa;border-top:1px solid #eee;">
            <p style="margin:0;font-size:11px;color:#999;text-align:center;">
              ${[company?.name, company?.address, [company?.postalCode, company?.city].filter(Boolean).join(" ")].filter(Boolean).join(" — ")}
              ${company?.siret ? `<br>SIRET: ${company.siret}` : ""}
              ${company?.tvaIntracom ? ` — TVA: ${company.tvaIntracom}` : ""}
            </p>
            <p style="margin:6px 0 0;font-size:10px;color:#bbb;text-align:center;">Envoyé via PlombPro</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

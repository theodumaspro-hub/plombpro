import PDFDocument from "pdfkit";
import type { Quote, Invoice, Contact, CompanySettings, DocumentLine } from "../shared/schema";

// ─── Types ──────────────────────────────────────────────────────
interface PDFOptions {
  documentType: "quote" | "invoice";
  document: Quote | Invoice;
  contact?: Contact;
  company?: CompanySettings;
  lines: DocumentLine[];
}

// ─── Helpers ────────────────────────────────────────────────────
function n(val: string | number | null | undefined): number {
  return parseFloat(String(val || "0")) || 0;
}

function fmt(amount: number): string {
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function fmtDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function contactDisplayName(c?: Contact): string {
  if (!c) return "—";
  const parts = [c.firstName, c.lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : c.company || "—";
}

function lineTypeLabel(lt: string | null | undefined): string {
  const map: Record<string, string> = {
    fourniture: "Fourniture",
    main_oeuvre: "Main d'œuvre",
    ouvrage: "Ouvrage",
    sous_traitance: "Sous-traitance",
    materiel: "Matériel",
    divers: "Divers",
  };
  return map[lt || ""] || "";
}

function invoiceTypeLabel(type: string): string {
  const map: Record<string, string> = {
    facture: "FACTURE",
    avoir: "AVOIR",
    acompte: "FACTURE D'ACOMPTE",
    situation: "FACTURE DE SITUATION",
    retenue_garantie: "RETENUE DE GARANTIE",
  };
  return map[type] || "FACTURE";
}

// ─── PDF Generator ──────────────────────────────────────────────
export async function generateDocumentPDF(options: PDFOptions): Promise<Buffer> {
  const { documentType, document: doc, contact, company, lines } = options;

  const color = company?.documentColor || "#C87941";
  const tableStyle = company?.tableStyle || "striped";

  const isQuote = documentType === "quote";
  const quote = isQuote ? (doc as Quote) : undefined;
  const invoice = !isQuote ? (doc as Invoice) : undefined;

  const docTitle = isQuote ? "DEVIS" : invoiceTypeLabel(invoice?.type || "facture");
  const docNumber = (doc as any).number || "—";

  return new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 45, right: 45 },
      info: {
        Title: `${docTitle} ${docNumber}`,
        Author: company?.name || "PlombPro",
        Subject: `${docTitle} ${docNumber}`,
      },
    });

    const chunks: Uint8Array[] = [];
    pdf.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);

    const pageWidth = pdf.page.width - pdf.page.margins.left - pdf.page.margins.right;
    const leftMargin = pdf.page.margins.left;

    // ─── Company Header ─────────────────────────────────────
    const headerY = pdf.y;

    // Company name
    pdf.font("Helvetica-Bold").fontSize(14).fillColor("#1a1a2e");
    pdf.text(company?.name || "Mon Entreprise", leftMargin, headerY, { width: pageWidth * 0.55 });
    pdf.moveDown(0.3);

    // Company details
    pdf.font("Helvetica").fontSize(8).fillColor("#666666");
    const companyLines: string[] = [];
    if (company?.address) companyLines.push(company.address);
    if (company?.postalCode || company?.city) companyLines.push([company.postalCode, company.city].filter(Boolean).join(" "));
    if (company?.phone) companyLines.push(`Tél: ${company.phone}`);
    if (company?.email) companyLines.push(company.email);
    if (company?.siret) companyLines.push(`SIRET: ${company.siret}`);
    if (company?.tvaIntracom) companyLines.push(`TVA Intra: ${company.tvaIntracom}`);
    if (company?.rcsNumber) companyLines.push(`RCS: ${company.rcsNumber}`);
    if (company?.assuranceDecennale) companyLines.push(`Ass. décennale: ${company.assuranceDecennale}`);

    companyLines.forEach(line => {
      pdf.text(line, leftMargin, pdf.y, { width: pageWidth * 0.55 });
    });

    // Document title (right side)
    const titleX = leftMargin + pageWidth * 0.6;
    pdf.font("Helvetica-Bold").fontSize(22).fillColor(color);
    pdf.text(docTitle, titleX, headerY, { width: pageWidth * 0.4, align: "right" });

    // Document meta (right side)
    const metaY = headerY + 30;
    pdf.font("Helvetica").fontSize(9).fillColor("#555555");
    pdf.text(`N° ${docNumber}`, titleX, metaY, { width: pageWidth * 0.4, align: "right" });
    pdf.text(`Date: ${fmtDate((doc as any).createdAt)}`, titleX, metaY + 13, { width: pageWidth * 0.4, align: "right" });

    if (isQuote && quote?.validUntil) {
      pdf.font("Helvetica-Bold").fontSize(9).fillColor(color);
      pdf.text(`Valide jusqu'au ${fmtDate(quote.validUntil)}`, titleX, metaY + 26, { width: pageWidth * 0.4, align: "right" });
    }

    if (!isQuote && invoice?.dueDate) {
      pdf.font("Helvetica-Bold").fontSize(9).fillColor("#c0392b");
      pdf.text(`Échéance: ${fmtDate(invoice.dueDate)}`, titleX, metaY + 26, { width: pageWidth * 0.4, align: "right" });
    }

    // ─── Parties ────────────────────────────────────────────
    pdf.y = Math.max(pdf.y, metaY + 48) + 15;

    const partyWidth = (pageWidth - 30) / 2;
    const partyY = pdf.y;

    // Emitter box
    pdf.rect(leftMargin, partyY, partyWidth, 70).fill("#fafafa").stroke("#e0e0e0");
    pdf.font("Helvetica").fontSize(7).fillColor("#999999");
    pdf.text("ÉMETTEUR", leftMargin + 10, partyY + 8, { width: partyWidth - 20 });
    pdf.font("Helvetica-Bold").fontSize(10).fillColor("#1a1a2e");
    pdf.text(company?.name || "—", leftMargin + 10, partyY + 20, { width: partyWidth - 20 });

    // Client box
    const clientX = leftMargin + partyWidth + 30;
    pdf.rect(clientX, partyY, partyWidth, 70).fill("#f5f5f5").stroke("#d0d0d0");
    pdf.font("Helvetica").fontSize(7).fillColor("#999999");
    pdf.text("CLIENT", clientX + 10, partyY + 8, { width: partyWidth - 20 });
    pdf.font("Helvetica-Bold").fontSize(10).fillColor("#1a1a2e");
    pdf.text(contactDisplayName(contact), clientX + 10, partyY + 20, { width: partyWidth - 20 });

    let clientDetailY = partyY + 33;
    pdf.font("Helvetica").fontSize(8).fillColor("#555555");
    if (contact?.company) { pdf.text(contact.company, clientX + 10, clientDetailY, { width: partyWidth - 20 }); clientDetailY += 10; }
    if (contact?.address) { pdf.text(contact.address, clientX + 10, clientDetailY, { width: partyWidth - 20 }); clientDetailY += 10; }
    if (contact?.postalCode || contact?.city) {
      pdf.text([contact.postalCode, contact.city].filter(Boolean).join(" "), clientX + 10, clientDetailY, { width: partyWidth - 20 });
    }

    pdf.y = partyY + 80;

    // ─── Object / Title ─────────────────────────────────────
    const title = (doc as any).title;
    if (title) {
      pdf.rect(leftMargin, pdf.y, pageWidth, 22).fill("#f0f0f0");
      pdf.font("Helvetica").fontSize(7).fillColor("#888888");
      pdf.text("OBJET: ", leftMargin + 8, pdf.y - 15, { continued: true });
      pdf.font("Helvetica-Bold").fontSize(9).fillColor("#1a1a2e");
      pdf.text(title);
      pdf.y += 10;
    }

    // ─── Lines Table ────────────────────────────────────────
    pdf.y += 8;

    const colWidths = {
      designation: pageWidth * 0.38,
      qty: pageWidth * 0.08,
      unit: pageWidth * 0.08,
      price: pageWidth * 0.14,
      tva: pageWidth * 0.10,
      total: pageWidth * 0.14,
      type: pageWidth * 0.08,
    };

    const cols = [
      { label: "Désignation", width: colWidths.designation, align: "left" as const },
      { label: "Qté", width: colWidths.qty, align: "right" as const },
      { label: "Unité", width: colWidths.unit, align: "left" as const },
      { label: "P.U. HT", width: colWidths.price, align: "right" as const },
      { label: "TVA", width: colWidths.tva, align: "right" as const },
      { label: "Total HT", width: colWidths.total, align: "right" as const },
    ];

    // Table header
    const tableY = pdf.y;
    const headerHeight = 20;
    pdf.rect(leftMargin, tableY, pageWidth, headerHeight).fill("#1a1a2e");

    let colX = leftMargin;
    pdf.font("Helvetica-Bold").fontSize(7.5).fillColor("#ffffff");
    cols.forEach(col => {
      pdf.text(col.label.toUpperCase(), colX + 5, tableY + 6, {
        width: col.width - 10,
        align: col.align,
      });
      colX += col.width;
    });

    pdf.y = tableY + headerHeight;

    // Table rows
    const dataLines = lines.filter(l => !l.isTitle && !l.isSubtotal);
    let rowIndex = 0;

    for (const line of lines) {
      const rowY = pdf.y;
      const isTitle = line.isTitle;
      const isSubtotal = line.isSubtotal;

      // Check if we need a new page
      if (rowY > pdf.page.height - 120) {
        pdf.addPage();
      }

      const currentRowY = pdf.y;
      const rowH = 18;

      if (isTitle) {
        // Section title
        pdf.rect(leftMargin, currentRowY, pageWidth, rowH).fill("#f5f5f5");
        pdf.rect(leftMargin, currentRowY, 2, rowH).fill(color);
        pdf.font("Helvetica-Bold").fontSize(9).fillColor("#1a1a2e");
        pdf.text(line.designation || "", leftMargin + 8, currentRowY + 5, { width: pageWidth - 16 });
      } else if (isSubtotal) {
        // Subtotal row
        pdf.moveTo(leftMargin, currentRowY).lineTo(leftMargin + pageWidth, currentRowY).lineWidth(1).strokeColor("#cccccc").stroke();
        pdf.font("Helvetica-Bold").fontSize(8.5).fillColor("#1a1a2e");
        pdf.text(line.designation || "Sous-total", leftMargin + 5, currentRowY + 5, { width: cols[0].width - 10 });

        // Calculate subtotal
        const ht = n(line.totalHT) || n(line.quantity) * n(line.unitPriceHT);
        let totalColX = leftMargin;
        for (let i = 0; i < cols.length - 1; i++) totalColX += cols[i].width;
        pdf.text(fmt(ht), totalColX + 5, currentRowY + 5, { width: cols[cols.length - 1].width - 10, align: "right" });
      } else {
        // Regular row
        if (tableStyle === "striped" && rowIndex % 2 === 1) {
          pdf.rect(leftMargin, currentRowY, pageWidth, rowH).fill("#fafafa");
        }

        const qty = n(line.quantity);
        const unitPrice = n(line.unitPriceHT);
        const lineHT = qty * unitPrice;
        const tvaRate = n(line.tvaRate);

        let cx = leftMargin;
        pdf.font("Helvetica").fontSize(8).fillColor("#333333");

        // Designation
        const desig = line.designation || "";
        const typeStr = lineTypeLabel(line.lineType);
        pdf.text(desig, cx + 5, currentRowY + 5, { width: cols[0].width - 10, lineBreak: false });
        cx += cols[0].width;

        // Qty
        pdf.text(String(qty), cx + 5, currentRowY + 5, { width: cols[1].width - 10, align: "right" });
        cx += cols[1].width;

        // Unit
        pdf.text(line.unit || "u", cx + 5, currentRowY + 5, { width: cols[2].width - 10 });
        cx += cols[2].width;

        // Unit price
        pdf.text(fmt(unitPrice), cx + 5, currentRowY + 5, { width: cols[3].width - 10, align: "right" });
        cx += cols[3].width;

        // TVA
        pdf.text(`${tvaRate}%`, cx + 5, currentRowY + 5, { width: cols[4].width - 10, align: "right" });
        cx += cols[4].width;

        // Total HT
        pdf.font("Helvetica-Bold").fontSize(8).fillColor("#1a1a2e");
        pdf.text(fmt(lineHT), cx + 5, currentRowY + 5, { width: cols[5].width - 10, align: "right" });

        rowIndex++;
      }

      pdf.y = currentRowY + rowH;
    }

    // Bottom line under table
    pdf.moveTo(leftMargin, pdf.y).lineTo(leftMargin + pageWidth, pdf.y).lineWidth(0.5).strokeColor("#dddddd").stroke();

    // ─── Totals ─────────────────────────────────────────────
    pdf.y += 12;

    const totalWidth = 240;
    const totalX = leftMargin + pageWidth - totalWidth;

    // Compute totals
    const totalHT = dataLines.reduce((s, l) => s + n(l.quantity) * n(l.unitPriceHT), 0);

    // Group TVA by rate
    const tvaGroups: Record<string, { base: number; tva: number }> = {};
    dataLines.forEach(l => {
      const rate = String(n(l.tvaRate));
      const ht = n(l.quantity) * n(l.unitPriceHT);
      if (!tvaGroups[rate]) tvaGroups[rate] = { base: 0, tva: 0 };
      tvaGroups[rate].base += ht;
      tvaGroups[rate].tva += ht * (n(l.tvaRate) / 100);
    });

    const totalTVA = Object.values(tvaGroups).reduce((s, g) => s + g.tva, 0);

    // Adjustments from document
    const discPct = n((doc as any).discountPercent);
    const discAmt = n((doc as any).discountAmount);
    const totalDiscount = (discPct > 0 ? totalHT * discPct / 100 : 0) + discAmt;
    const finalHT = totalHT - totalDiscount;
    const discountRatio = totalHT > 0 ? finalHT / totalHT : 1;
    const finalTVA = totalTVA * discountRatio;
    const totalTTC = finalHT + finalTVA;

    function drawTotalRow(label: string, value: string, bold = false, colorStr?: string) {
      const y = pdf.y;
      pdf.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 10 : 8.5).fillColor(colorStr || "#333333");
      pdf.text(label, totalX, y, { width: totalWidth * 0.55 });
      pdf.text(value, totalX + totalWidth * 0.55, y, { width: totalWidth * 0.45, align: "right" });
      pdf.y = y + (bold ? 18 : 14);
    }

    drawTotalRow("Total HT", fmt(totalHT));

    if (totalDiscount > 0) {
      drawTotalRow(`Remise ${discPct > 0 ? `(${discPct}%)` : ""}`, `- ${fmt(totalDiscount)}`, false, color);
      drawTotalRow("Total HT remisé", fmt(finalHT));
    }

    // TVA details
    Object.entries(tvaGroups).sort((a, b) => n(a[0]) - n(b[0])).forEach(([rate, group]) => {
      const adjTva = group.tva * discountRatio;
      drawTotalRow(`TVA ${rate}%`, fmt(adjTva));
    });

    // Total TTC
    pdf.moveTo(totalX, pdf.y).lineTo(totalX + totalWidth, pdf.y).lineWidth(2).strokeColor(color).stroke();
    pdf.y += 4;
    drawTotalRow("Total TTC", fmt(totalTTC), true, color);

    // Retenue de garantie (invoices)
    if (!isQuote && invoice) {
      const rgPct = n(invoice.retenueGarantiePercent);
      const rgAmt = n(invoice.retenueGarantieAmount);
      if (rgPct > 0 || rgAmt > 0) {
        const rgTotal = rgAmt || (totalTTC * rgPct / 100);
        drawTotalRow(`Retenue de garantie (${rgPct || 5}%)`, `- ${fmt(rgTotal)}`, false, "#8e44ad");
        drawTotalRow("Net à payer", fmt(totalTTC - rgTotal), true, "#1a1a2e");
      }
    }

    // ─── Payment info (invoices) ────────────────────────────
    if (!isQuote && invoice) {
      pdf.y += 10;
      if (invoice.paymentMethod || company?.iban) {
        pdf.font("Helvetica-Bold").fontSize(8).fillColor("#1a1a2e");
        pdf.text("MODALITÉS DE RÈGLEMENT", leftMargin, pdf.y, { width: pageWidth });
        pdf.y += 4;
        pdf.font("Helvetica").fontSize(8).fillColor("#555555");
        if (invoice.paymentMethod) pdf.text(`Mode de paiement : ${invoice.paymentMethod}`, leftMargin, pdf.y, { width: pageWidth });
        if (company?.iban) { pdf.y += 10; pdf.text(`IBAN : ${company.iban}`, leftMargin, pdf.y, { width: pageWidth }); }
        if (company?.bic) { pdf.y += 10; pdf.text(`BIC : ${company.bic}`, leftMargin, pdf.y, { width: pageWidth }); }
        if (company?.bankName) { pdf.y += 10; pdf.text(`Banque : ${company.bankName}`, leftMargin, pdf.y, { width: pageWidth }); }
      }
    }

    // ─── Conditions ─────────────────────────────────────────
    const conditions = (doc as any).conditions || (doc as any).notes;
    if (conditions) {
      pdf.y += 15;

      // Check page space
      if (pdf.y > pdf.page.height - 120) pdf.addPage();

      pdf.rect(leftMargin, pdf.y, pageWidth, 4).fill(color);
      pdf.y += 8;
      pdf.font("Helvetica-Bold").fontSize(8).fillColor("#1a1a2e");
      pdf.text("CONDITIONS", leftMargin, pdf.y, { width: pageWidth });
      pdf.y += 4;
      pdf.font("Helvetica").fontSize(7.5).fillColor("#555555");
      pdf.text(conditions, leftMargin, pdf.y, { width: pageWidth, lineGap: 2 });
    }

    // CGV
    if (company?.showCgv && company?.cgvText) {
      pdf.y += 12;
      if (pdf.y > pdf.page.height - 100) pdf.addPage();
      pdf.font("Helvetica-Bold").fontSize(7).fillColor("#999999");
      pdf.text("CONDITIONS GÉNÉRALES", leftMargin, pdf.y, { width: pageWidth });
      pdf.y += 3;
      pdf.font("Helvetica").fontSize(6.5).fillColor("#999999");
      pdf.text(company.cgvText, leftMargin, pdf.y, { width: pageWidth, lineGap: 1.5 });
    }

    // ─── Signature block (quotes) ───────────────────────────
    if (isQuote) {
      pdf.y += 20;
      if (pdf.y > pdf.page.height - 100) pdf.addPage();

      pdf.font("Helvetica").fontSize(8).fillColor("#555555");
      pdf.text("Bon pour accord — Date et signature du client :", leftMargin, pdf.y, { width: pageWidth });
      pdf.y += 5;
      pdf.rect(leftMargin + pageWidth * 0.55, pdf.y, pageWidth * 0.45, 50).lineWidth(0.5).strokeColor("#cccccc").stroke();

      if (quote?.signatureData) {
        pdf.font("Helvetica-Bold").fontSize(7).fillColor("#27ae60");
        pdf.text(`✓ Signé le ${fmtDate(quote.signedAt)}`, leftMargin + pageWidth * 0.55 + 5, pdf.y + 5);
      }
    }

    // ─── Footer ─────────────────────────────────────────────
    const footerY = pdf.page.height - pdf.page.margins.bottom - 25;
    pdf.moveTo(leftMargin, footerY).lineTo(leftMargin + pageWidth, footerY).lineWidth(0.5).strokeColor("#eeeeee").stroke();
    pdf.font("Helvetica").fontSize(6.5).fillColor("#999999");

    const footerParts: string[] = [];
    if (company?.name) footerParts.push(company.name);
    if (company?.legalForm) footerParts.push(company.legalForm);
    if (company?.capital) footerParts.push(`Capital: ${company.capital} €`);
    if (company?.siret) footerParts.push(`SIRET: ${company.siret}`);
    if (company?.apeCode) footerParts.push(`APE: ${company.apeCode}`);
    if (company?.tvaIntracom) footerParts.push(`TVA: ${company.tvaIntracom}`);

    pdf.text(footerParts.join(" — "), leftMargin, footerY + 5, {
      width: pageWidth,
      align: "center",
    });

    pdf.text("Généré par PlombPro", leftMargin, footerY + 15, {
      width: pageWidth,
      align: "center",
    });

    pdf.end();
  });
}

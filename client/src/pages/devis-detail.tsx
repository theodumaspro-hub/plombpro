import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { db } from "@/lib/supabaseData";
import { formatCurrency, formatDate, contactName } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Save, Send, Eye, Trash2, Plus, GripVertical, Copy, FileText,
  Mail, Download, ChevronDown, ChevronUp, Package, Heading, Calculator,
  MessageCircle, ExternalLink, CheckCircle2, Wrench, Layers, Users, Truck,
  MoreHorizontal, BarChart3, AlertTriangle, Calendar,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────
type LineType = "fourniture" | "main_oeuvre" | "ouvrage" | "sous_traitance" | "materiel" | "divers";

interface LineItem {
  id?: number;
  designation: string;
  description: string;
  quantity: string;
  unit: string;
  unit_price_ht: string;
  tva_rate: string;
  is_title: boolean;
  is_subtotal: boolean;
  line_type: LineType;
  purchase_price_ht: string;
  coefficient: string;
  margin_percent: string;
}

const EMPTY_LINE: LineItem = {
  designation: "", description: "", quantity: "1", unit: "u",
  unit_price_ht: "0", tva_rate: "10", is_title: false, is_subtotal: false,
  line_type: "fourniture", purchase_price_ht: "", coefficient: "", margin_percent: "",
};

const LINE_TYPES: { value: LineType; label: string; color: string; icon: typeof Package }[] = [
  { value: "fourniture", label: "Fourniture", color: "#3B82F6", icon: Package },
  { value: "main_oeuvre", label: "Main d'œuvre", color: "#F59E0B", icon: Wrench },
  { value: "ouvrage", label: "Ouvrage", color: "#8B5CF6", icon: Layers },
  { value: "sous_traitance", label: "Sous-traitance", color: "#EC4899", icon: Users },
  { value: "materiel", label: "Matériel", color: "#10B981", icon: Truck },
  { value: "divers", label: "Divers", color: "#6B7280", icon: MoreHorizontal },
];

const LINE_TYPE_MAP = Object.fromEntries(LINE_TYPES.map(t => [t.value, t]));

const UNITS = [
  { value: "u", label: "Unité" },
  { value: "h", label: "Heure" },
  { value: "j", label: "Jour" },
  { value: "m", label: "m (mètre)" },
  { value: "m²", label: "m²" },
  { value: "m³", label: "m³" },
  { value: "ml", label: "ml (mètre linéaire)" },
  { value: "l", label: "Litre" },
  { value: "g", label: "g (gramme)" },
  { value: "kg", label: "kg" },
  { value: "t", label: "t (tonne)" },
  { value: "forfait", label: "Forfait" },
  { value: "ens", label: "Ensemble" },
  { value: "lot", label: "Lot" },
  { value: "pce", label: "Pièce" },
  { value: "roul", label: "Rouleau" },
  { value: "sac", label: "Sac" },
  { value: "bte", label: "Boîte" },
  { value: "pal", label: "Palette" },
  { value: "cm", label: "cm" },
  { value: "mm", label: "mm" },
  { value: "km", label: "km" },
  { value: "cl", label: "cl" },
  { value: "dl", label: "dl" },
  { value: "hl", label: "hl" },
  { value: "pair", label: "Paire" },
  { value: "pl", label: "Plaque" },
];

const TVA_RATES = [
  { value: "20", label: "20% (normal)" },
  { value: "10", label: "10% (rénovation)" },
  { value: "5.5", label: "5,5% (énergie)" },
  { value: "2.1", label: "2,1%" },
  { value: "0", label: "0% (exonéré)" },
];

// ─── PDF Preview Component ──────────────────────────────────────
function DevisPDFPreview({
  quote, contact, company, lines, onClose, adjustments, headerFields, showMargins,
}: {
  quote: any; contact?: any; company?: any;
  lines: LineItem[]; onClose: () => void;
  adjustments: { remisePercent: string; remiseAmount: string; ajustementLabel: string; ajustementAmount: string };
  headerFields: { debutTravaux: string; dureeEstimee: string; visitePrealable: string };
  showMargins: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const dataLines = lines.filter(l => !l.is_title && !l.is_subtotal);
  const totalHT = dataLines
    .reduce((s, l) => s + (parseFloat(l.quantity || "1") * parseFloat(l.unit_price_ht || "0")), 0);
  const totalTVA = dataLines
    .reduce((s, l) => {
      const ht = parseFloat(l.quantity || "1") * parseFloat(l.unit_price_ht || "0");
      return s + ht * (parseFloat(l.tva_rate || "20") / 100);
    }, 0);

  // Global adjustments
  const adjRemisePct = parseFloat(adjustments.remisePercent || "0");
  const adjRemiseAmt = parseFloat(adjustments.remiseAmount || "0");
  const adjLibreAmt = parseFloat(adjustments.ajustementAmount || "0");
  const totalAdj = (adjRemisePct > 0 ? totalHT * adjRemisePct / 100 : 0) + adjRemiseAmt - adjLibreAmt;
  const pdfFinalHT = totalHT - totalAdj;
  const pdfDiscountRatio = totalHT > 0 ? pdfFinalHT / totalHT : 1;
  const pdfFinalTVA = totalTVA * pdfDiscountRatio;
  const totalTTC = pdfFinalHT + pdfFinalTVA;

  // Margin totals for ventilation
  const totalPurchaseHT = dataLines
    .reduce((s, l) => s + (parseFloat(l.quantity || "0") * parseFloat(l.purchase_price_ht || "0")), 0);
  const margeBruteHT = pdfFinalHT - totalPurchaseHT;

  // HT by line type for ventilation
  const htByType: Record<string, number> = {};
  dataLines.forEach(l => {
    const lt = l.line_type || "divers";
    const ht = parseFloat(l.quantity || "1") * parseFloat(l.unit_price_ht || "0");
    htByType[lt] = (htByType[lt] || 0) + ht;
  });

  // Group TVA by rate
  const tvaGroups: Record<string, { base: number; tva: number }> = {};
  dataLines.forEach(l => {
    const rate = l.tva_rate || "20";
    const ht = parseFloat(l.quantity || "1") * parseFloat(l.unit_price_ht || "0");
    if (!tvaGroups[rate]) tvaGroups[rate] = { base: 0, tva: 0 };
    tvaGroups[rate].base += ht;
    tvaGroups[rate].tva += ht * (parseFloat(rate) / 100);
  });

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>Devis ${quote.number}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11px; color: #1a1a2e; line-height: 1.5; padding: 20mm; }
        .header { display: flex; justify-content: space-between; margin-bottom: 24px; }
        .company-info { font-size: 10px; color: #555; }
        .company-name { font-size: 16px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
        .doc-title { text-align: right; }
        .doc-title h1 { font-size: 22px; font-weight: 700; color: #C87941; margin-bottom: 4px; }
        .doc-meta { font-size: 10px; color: #666; }
        .parties { display: flex; justify-content: space-between; margin-bottom: 20px; gap: 40px; }
        .party { flex: 1; padding: 12px; border-radius: 6px; }
        .party-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 6px; }
        .party-name { font-weight: 600; font-size: 13px; margin-bottom: 4px; }
        .client-box { background: #f8f8f8; border: 1px solid #e0e0e0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        thead th { background: #1a1a2e; color: #fff; padding: 8px 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
        thead th:last-child, thead th:nth-child(4), thead th:nth-child(5), thead th:nth-child(6) { text-align: right; }
        tbody td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 10.5px; }
        tbody td:last-child, tbody td:nth-child(4), tbody td:nth-child(5), tbody td:nth-child(6) { text-align: right; }
        .title-row td { font-weight: 700; background: #f5f5f5; font-size: 11px; padding-top: 10px; }
        .subtotal-row td { font-weight: 600; border-top: 2px solid #ddd; }
        .totals { display: flex; justify-content: flex-end; margin-bottom: 20px; }
        .totals-table { width: 280px; }
        .totals-table tr td { padding: 5px 10px; font-size: 11px; }
        .totals-table tr td:last-child { text-align: right; font-weight: 600; }
        .total-ttc { font-size: 14px !important; font-weight: 700 !important; color: #C87941; border-top: 2px solid #C87941; }
        .tva-detail { font-size: 10px; color: #666; }
        .conditions { margin-top: 20px; padding: 12px; background: #fafafa; border-radius: 6px; border: 1px solid #eee; }
        .conditions h3 { font-size: 11px; font-weight: 600; margin-bottom: 6px; }
        .conditions p { font-size: 10px; color: #555; white-space: pre-line; }
        .footer { margin-top: 30px; text-align: center; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
        .legal { margin-top: 16px; font-size: 9px; color: #888; }
        .validity { display: inline-block; padding: 4px 10px; background: #FFF3E0; color: #C87941; border-radius: 4px; font-size: 10px; font-weight: 600; margin-top: 8px; }
        .line-type-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 8px; font-weight: 500; margin-left: 6px; }
        .section-title { font-weight: 700; font-size: 12px; border-left: 3px solid #C87941; padding-left: 8px; }
        .adj-row td { font-size: 10px; color: #C87941; }
        .ventilation { margin-top: 16px; }
        .ventilation table { width: 280px; }
        .ventilation td { padding: 3px 8px; font-size: 10px; }
        @media print { body { padding: 10mm; } }
      </style></head><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  }

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <FileText className="size-5 text-primary" />
            Aperçu du devis {quote.number}
          </DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="bg-white text-black p-8 rounded-lg text-sm" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
          {/* Header */}
          <div className="header" style={{ display: "flex", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <div className="company-name" style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e", marginBottom: 4 }}>
                {company?.name || "Mon Entreprise"}
              </div>
              <div className="company-info" style={{ fontSize: 10, color: "#555", lineHeight: 1.6 }}>
                {company?.address && <div>{company.address}</div>}
                {(company?.postal_code || company?.city) && <div>{[company.postal_code, company.city].filter(Boolean).join(" ")}</div>}
                {company?.phone && <div>Tél: {company.phone}</div>}
                {company?.email && <div>{company.email}</div>}
                {company?.siret && <div>SIRET: {company.siret}</div>}
                {company?.tva_intracom && <div>TVA: {company.tva_intracom}</div>}
                {company?.rcs_number && <div>RCS: {company.rcs_number}</div>}
                {company?.assurance_decennale && <div>Assurance décennale: {company.assurance_decennale}</div>}
              </div>
            </div>
            <div className="doc-title" style={{ textAlign: "right" }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#C87941", marginBottom: 4 }}>DEVIS</h1>
              <div className="doc-meta" style={{ fontSize: 10, color: "#666", lineHeight: 1.8 }}>
                <div>N° {quote.number}</div>
                <div>Date: {formatDate(quote.created_at ? new Date(quote.created_at).toISOString() : null)}</div>
                {quote.valid_until && (
                  <div className="validity" style={{ display: "inline-block", padding: "4px 10px", background: "#FFF3E0", color: "#C87941", borderRadius: 4, fontSize: 10, fontWeight: 600, marginTop: 4 }}>
                    Valide jusqu'au {formatDate(quote.valid_until)}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="parties" style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, gap: 40 }}>
            <div className="party" style={{ flex: 1, padding: 12, borderRadius: 6 }}>
              <div className="party-label" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>Émetteur</div>
              <div className="party-name" style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{company?.name || "—"}</div>
            </div>
            <div className="party client-box" style={{ flex: 1, padding: 12, borderRadius: 6, background: "#f8f8f8", border: "1px solid #e0e0e0" }}>
              <div className="party-label" style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: 1, color: "#999", marginBottom: 6 }}>Client</div>
              <div className="party-name" style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                {contact ? contactName({ first_name: contact.first_name, last_name: contact.last_name, company: contact.company }) : "—"}
              </div>
              {contact?.company && <div style={{ fontSize: 10.5 }}>{contact.company}</div>}
              {contact?.address && <div style={{ fontSize: 10.5, color: "#555" }}>{contact.address}</div>}
              {(contact?.postal_code || contact?.city) && <div style={{ fontSize: 10.5, color: "#555" }}>{[contact.postal_code, contact.city].filter(Boolean).join(" ")}</div>}
              {contact?.email && <div style={{ fontSize: 10.5, color: "#555" }}>{contact.email}</div>}
              {contact?.phone && <div style={{ fontSize: 10.5, color: "#555" }}>{contact.phone}</div>}
            </div>
          </div>

          {/* Object */}
          {quote.title && (
            <div style={{ marginBottom: 12, padding: "8px 12px", background: "#f0f0f0", borderRadius: 4 }}>
              <span style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Objet: </span>
              <span style={{ fontWeight: 600, fontSize: 12 }}>{quote.title}</span>
            </div>
          )}

          {/* Header fields */}
          {(headerFields.debutTravaux || headerFields.dureeEstimee || headerFields.visitePrealable) && (
            <div style={{ marginBottom: 16, display: "flex", gap: 20, fontSize: 10, color: "#555" }}>
              {headerFields.debutTravaux && (
                <div><span style={{ fontWeight: 600 }}>Début des travaux:</span> {formatDate(headerFields.debutTravaux)}</div>
              )}
              {headerFields.dureeEstimee && (
                <div><span style={{ fontWeight: 600 }}>Durée estimée:</span> {headerFields.dureeEstimee}</div>
              )}
              {headerFields.visitePrealable && (
                <div><span style={{ fontWeight: 600 }}>Visite préalable:</span> {formatDate(headerFields.visitePrealable)}</div>
              )}
            </div>
          )}

          {/* Lines Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
            <thead>
              <tr>
                <th style={{ background: "#1a1a2e", color: "#fff", padding: "8px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, textAlign: "left" }}>Désignation</th>
                <th style={{ background: "#1a1a2e", color: "#fff", padding: "8px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", textAlign: "right" }}>Qté</th>
                <th style={{ background: "#1a1a2e", color: "#fff", padding: "8px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", textAlign: "left" }}>Unité</th>
                <th style={{ background: "#1a1a2e", color: "#fff", padding: "8px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", textAlign: "right" }}>P.U. HT</th>
                <th style={{ background: "#1a1a2e", color: "#fff", padding: "8px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", textAlign: "right" }}>TVA</th>
                <th style={{ background: "#1a1a2e", color: "#fff", padding: "8px 10px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", textAlign: "right" }}>Total HT</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                if (line.is_title) {
                  return (
                    <tr key={i} className="title-row">
                      <td colSpan={6} className="section-title" style={{ fontWeight: 700, background: "#f5f5f5", fontSize: 12, padding: "10px 10px 7px", borderBottom: "1px solid #eee", borderLeft: "3px solid #C87941", paddingLeft: 12 }}>
                        {line.designation}
                      </td>
                    </tr>
                  );
                }
                if (line.is_subtotal) {
                  const prevLines: LineItem[] = [];
                  let sectionName = "";
                  for (let j = i - 1; j >= 0; j--) {
                    if (lines[j].is_title) { sectionName = lines[j].designation; break; }
                    if (lines[j].is_subtotal) break;
                    prevLines.push(lines[j]);
                  }
                  const sub = prevLines.reduce((s, l) => s + (parseFloat(l.quantity || "1") * parseFloat(l.unit_price_ht || "0")), 0);
                  return (
                    <tr key={i} className="subtotal-row">
                      <td colSpan={5} style={{ fontWeight: 600, borderTop: "2px solid #ddd", padding: "7px 10px", textAlign: "right", fontSize: 10.5 }}>
                        {sectionName ? `Sous-total ${sectionName}` : "Sous-total"}
                      </td>
                      <td style={{ fontWeight: 600, borderTop: "2px solid #ddd", padding: "7px 10px", textAlign: "right", fontSize: 10.5 }}>
                        {sub.toFixed(2)} €
                      </td>
                    </tr>
                  );
                }
                const lineTotal = parseFloat(line.quantity || "1") * parseFloat(line.unit_price_ht || "0");
                const lt = LINE_TYPE_MAP[line.line_type];
                return (
                  <tr key={i}>
                    <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee", fontSize: 10.5 }}>
                      <div style={{ fontWeight: 500 }}>
                        {line.designation}
                        {lt && (
                          <span className="line-type-badge" style={{ display: "inline-block", padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 500, marginLeft: 6, background: `${lt.color}15`, color: lt.color }}>
                            {lt.label}
                          </span>
                        )}
                      </div>
                      {line.description && <div style={{ fontSize: 9.5, color: "#888", marginTop: 2 }}>{line.description}</div>}
                    </td>
                    <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee", fontSize: 10.5, textAlign: "right" }}>{parseFloat(line.quantity || "1")}</td>
                    <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee", fontSize: 10.5 }}>{line.unit}</td>
                    <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee", fontSize: 10.5, textAlign: "right" }}>{parseFloat(line.unit_price_ht || "0").toFixed(2)} €</td>
                    <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee", fontSize: 10.5, textAlign: "right" }}>{line.tva_rate}%</td>
                    <td style={{ padding: "7px 10px", borderBottom: "1px solid #eee", fontSize: 10.5, textAlign: "right", fontWeight: 500 }}>{lineTotal.toFixed(2)} €</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Adjustments */}
          {totalAdj !== 0 && (
            <div style={{ marginBottom: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {adjRemisePct > 0 && (
                    <tr className="adj-row">
                      <td colSpan={5} style={{ padding: "4px 10px", fontSize: 10, color: "#C87941", textAlign: "right" }}>Remise globale ({adjRemisePct}%)</td>
                      <td style={{ padding: "4px 10px", fontSize: 10, color: "#C87941", textAlign: "right" }}>-{(totalHT * adjRemisePct / 100).toFixed(2)} €</td>
                    </tr>
                  )}
                  {adjRemiseAmt > 0 && (
                    <tr className="adj-row">
                      <td colSpan={5} style={{ padding: "4px 10px", fontSize: 10, color: "#C87941", textAlign: "right" }}>Remise globale</td>
                      <td style={{ padding: "4px 10px", fontSize: 10, color: "#C87941", textAlign: "right" }}>-{adjRemiseAmt.toFixed(2)} €</td>
                    </tr>
                  )}
                  {adjLibreAmt !== 0 && adjustments.ajustementLabel && (
                    <tr className="adj-row">
                      <td colSpan={5} style={{ padding: "4px 10px", fontSize: 10, color: "#C87941", textAlign: "right" }}>{adjustments.ajustementLabel}</td>
                      <td style={{ padding: "4px 10px", fontSize: 10, color: "#C87941", textAlign: "right" }}>{adjLibreAmt > 0 ? "+" : ""}{adjLibreAmt.toFixed(2)} €</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
            <table style={{ width: 300, borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "5px 10px", fontSize: 11 }}>Total HT</td>
                  <td style={{ padding: "5px 10px", fontSize: 11, textAlign: "right", fontWeight: 600 }}>{pdfFinalHT.toFixed(2)} €</td>
                </tr>
                {Object.entries(tvaGroups).map(([rate, g]) => (
                  <tr key={rate}>
                    <td style={{ padding: "3px 10px", fontSize: 10, color: "#666" }}>TVA {rate}% (base: {(g.base * pdfDiscountRatio).toFixed(2)} €)</td>
                    <td style={{ padding: "3px 10px", fontSize: 10, textAlign: "right", color: "#666" }}>{(g.tva * pdfDiscountRatio).toFixed(2)} €</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: "5px 10px", fontSize: 11 }}>Total TVA</td>
                  <td style={{ padding: "5px 10px", fontSize: 11, textAlign: "right", fontWeight: 600 }}>{pdfFinalTVA.toFixed(2)} €</td>
                </tr>
                <tr>
                  <td style={{ padding: "8px 10px", fontSize: 14, fontWeight: 700, color: "#C87941", borderTop: "2px solid #C87941" }}>Total TTC</td>
                  <td style={{ padding: "8px 10px", fontSize: 14, fontWeight: 700, color: "#C87941", borderTop: "2px solid #C87941", textAlign: "right" }}>{totalTTC.toFixed(2)} €</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Ventilation (margin mode) */}
          {showMargins && totalPurchaseHT > 0 && (
            <div className="ventilation" style={{ marginTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 6, color: "#1a1a2e" }}>Ventilation</div>
              <table style={{ width: 320, borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "3px 8px", fontSize: 9, textAlign: "left", borderBottom: "1px solid #ddd", color: "#888" }}>Type</th>
                    <th style={{ padding: "3px 8px", fontSize: 9, textAlign: "right", borderBottom: "1px solid #ddd", color: "#888" }}>HT</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(htByType).map(([type, ht]) => {
                    const lt = LINE_TYPE_MAP[type];
                    return (
                      <tr key={type}>
                        <td style={{ padding: "3px 8px", fontSize: 10 }}>{lt?.label || type}</td>
                        <td style={{ padding: "3px 8px", fontSize: 10, textAlign: "right" }}>{ht.toFixed(2)} €</td>
                      </tr>
                    );
                  })}
                  <tr>
                    <td style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600, borderTop: "1px solid #ddd" }}>Marge Brute HT</td>
                    <td style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600, textAlign: "right", borderTop: "1px solid #ddd", color: margeBruteHT >= 0 ? "#10B981" : "#EF4444" }}>{margeBruteHT.toFixed(2)} €</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Acompte mention */}
          {quote.conditions && quote.conditions.toLowerCase().includes("acompte") && (
            <div style={{ marginBottom: 12, padding: "6px 12px", background: "#FFF3E0", borderRadius: 4, fontSize: 10, color: "#C87941", fontWeight: 500 }}>
              Acompte demandé à la commande conformément aux conditions ci-dessous.
            </div>
          )}

          {/* Conditions */}
          {quote.conditions && (
            <div style={{ marginTop: 20, padding: 12, background: "#fafafa", borderRadius: 6, border: "1px solid #eee" }}>
              <h3 style={{ fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Conditions</h3>
              <p style={{ fontSize: 10, color: "#555", whiteSpace: "pre-line" }}>{quote.conditions}</p>
            </div>
          )}

          {/* Signature area — Bon pour accord */}
          <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", gap: 40 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 40 }}>L'entreprise</div>
              <div style={{ borderTop: "1px solid #ccc", paddingTop: 4, fontSize: 9, color: "#888" }}>Signature et cachet</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 4 }}>Le client — Bon pour accord</div>
              <div style={{ fontSize: 9, color: "#888", marginBottom: 4 }}>Date: ____/____/________</div>
              <div style={{ fontSize: 9, color: "#888", marginBottom: 24 }}>Mention manuscrite « Bon pour accord » et signature</div>
              <div style={{ borderTop: "1px solid #ccc", paddingTop: 4, fontSize: 9, color: "#888" }}>Signature du client</div>
            </div>
          </div>

          {/* Legal mentions */}
          <div style={{ marginTop: 20, fontSize: 8.5, color: "#999", borderTop: "1px solid #eee", paddingTop: 10, lineHeight: 1.6 }}>
            {company?.assurance_decennale && <div>Assurance décennale : {company.assurance_decennale}</div>}
            {company?.rcs_number && <div>RCS : {company.rcs_number}</div>}
            {company?.siret && <div>SIRET : {company.siret}</div>}
            {company?.tva_intracom && <div>TVA intracommunautaire : {company.tva_intracom}</div>}
            <div style={{ marginTop: 4 }}>En cas d'acceptation, le client retourne le présent devis daté et signé avec la mention manuscrite « Bon pour accord ».</div>
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Button onClick={handlePrint} className="gap-2">
            <Download className="size-4" /> Imprimer / PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Email Dialog ───────────────────────────────────────────────
function SendEmailDialog({
  quote, contact, onClose, onSent,
}: {
  quote: any; contact?: any; onClose: () => void; onSent: () => void;
}) {
  const { toast } = useToast();
  const [channel, setChannel] = useState<"email" | "gmail" | "whatsapp">("email");
  const [email, setEmail] = useState(contact?.email || "");
  const [phone, setPhone] = useState(contact?.phone || contact?.mobile || "");
  const [subject, setSubject] = useState(`Devis ${quote.number} — ${quote.title || ""}`);
  const [message, setMessage] = useState(
    `Bonjour${contact ? ` ${contactName({ first_name: contact.first_name, last_name: contact.last_name, company: contact.company })}` : ""},\n\nVeuillez trouver ci-joint notre devis n° ${quote.number}${quote.title ? ` pour ${quote.title}` : ""}.\n\nCe devis est valable ${quote.valid_until ? `jusqu'au ${formatDate(quote.valid_until)}` : "30 jours"}.\n\nN'hésitez pas à nous contacter pour toute question.\n\nCordialement,`
  );
  const [waMessage, setWaMessage] = useState(
    `Bonjour${contact ? ` ${contactName({ first_name: contact.first_name, last_name: contact.last_name, company: contact.company })}` : ""}, voici le devis n° ${quote.number}${quote.title ? ` pour ${quote.title}` : ""} d'un montant de ${formatCurrency(parseFloat(quote.amount_ttc || "0"))}. N'hésitez pas à me contacter pour toute question.`
  );

  // Integration status — stubbed (no server)
  const gmailConnected = false;
  const waConnected = false;

  const sendMut = useMutation({
    mutationFn: async () => {
      // Stubbed — email/gmail/whatsapp sending not available without server
      toast({ title: "Fonctionnalité bientôt disponible", description: "L'envoi de devis sera disponible prochainement." });
    },
    onSuccess: () => {
      onSent();
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const canSend = channel === "whatsapp" ? !!phone : !!email;

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-5 text-primary" /> Envoyer le devis
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Channel selector */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Canal d'envoi</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-colors ${
                  channel === "email" ? "border-primary bg-primary/5 text-primary" : "border-border hover:border-primary/40"
                }`}
                onClick={() => setChannel("email")}
                data-testid="channel-email"
              >
                <Mail className="size-5" />
                <span>Email</span>
              </button>
              <button
                type="button"
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-colors ${
                  channel === "gmail" ? "border-red-500 bg-red-500/5 text-red-500" : "border-border hover:border-red-500/40"
                } ${!gmailConnected ? "opacity-50" : ""}`}
                onClick={() => gmailConnected && setChannel("gmail")}
                data-testid="channel-gmail"
              >
                <Mail className="size-5" />
                <span>Gmail</span>
                {gmailConnected && <CheckCircle2 className="size-3 text-emerald-400" />}
              </button>
              <button
                type="button"
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs transition-colors ${
                  channel === "whatsapp" ? "border-emerald-500 bg-emerald-500/5 text-emerald-500" : "border-border hover:border-emerald-500/40"
                } ${!waConnected ? "opacity-50" : ""}`}
                onClick={() => waConnected && setChannel("whatsapp")}
                data-testid="channel-whatsapp"
              >
                <MessageCircle className="size-5" />
                <span>WhatsApp</span>
                {waConnected && <CheckCircle2 className="size-3 text-emerald-400" />}
              </button>
            </div>
            {(!gmailConnected || !waConnected) && (
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {!gmailConnected && !waConnected
                  ? "Gmail et WhatsApp non connectés."
                  : !gmailConnected
                  ? "Gmail non connecté."
                  : "WhatsApp non connecté."
                }{" "}
                <a href="/#/parametres" className="text-primary underline">Paramètres &gt; Intégrations</a>
              </p>
            )}
          </div>

          {channel === "whatsapp" ? (
            /* WhatsApp form */
            <>
              <div>
                <Label>Téléphone destinataire *</Label>
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="06 12 34 56 78"
                  data-testid="input-send-phone"
                />
              </div>
              <div>
                <Label>Message WhatsApp</Label>
                <Textarea value={waMessage} onChange={e => setWaMessage(e.target.value)} rows={5} data-testid="input-send-wa-message" />
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 text-xs text-muted-foreground">
                <MessageCircle className="size-3.5 inline mr-1.5 text-emerald-400" />
                Un lien WhatsApp sera ouvert pour envoyer le message manuellement.
              </div>
            </>
          ) : (
            /* Email / Gmail form */
            <>
              <div>
                <Label>Destinataire *</Label>
                <Input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="email@client.fr" data-testid="input-send-email"
                />
              </div>
              <div>
                <Label>Objet</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} data-testid="input-send-subject" />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={6} data-testid="input-send-message" />
              </div>
              {channel === "gmail" && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 text-xs text-muted-foreground">
                  <Mail className="size-3.5 inline mr-1.5 text-red-400" />
                  Gmail non connecté. Configurez l'intégration dans les paramètres.
                </div>
              )}
              {channel === "email" && (
                <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
                  Fonctionnalité email bientôt disponible.
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            onClick={() => sendMut.mutate()}
            disabled={!canSend || sendMut.isPending}
            className={`gap-2 ${channel === "whatsapp" ? "bg-emerald-600 hover:bg-emerald-700" : channel === "gmail" ? "bg-red-600 hover:bg-red-700" : ""}`}
            data-testid="btn-confirm-send"
          >
            {channel === "whatsapp" ? <MessageCircle className="size-4" /> : <Send className="size-4" />}
            {sendMut.isPending ? "Envoi..." : channel === "whatsapp" ? "Envoyer via WhatsApp" : channel === "gmail" ? "Envoyer via Gmail" : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function DevisDetailPage() {
  const params = useParams<{ id: string }>();
  const quoteId = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // State
  const [lines, setLines] = useState<LineItem[]>([]);
  const [showPdf, setShowPdf] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showMargins, setShowMargins] = useState(false);
  const [showFacturer, setShowFacturer] = useState(false);
  const [facturerType, setFacturerType] = useState<"facture" | "acompte" | "situation">("facture");
  const [facturerPercent, setFacturerPercent] = useState("30");
  const [facturerSituation, setFacturerSituation] = useState("1");
  const [quoteForm, setQuoteForm] = useState({
    title: "", description: "", valid_until: "", notes: "", conditions: "Validité 30 jours. Acompte 30% à la commande.",
    contact_id: "", discount_percent: "",
  });
  const [headerFields, setHeaderFields] = useState({
    debutTravaux: "", dureeEstimee: "", visitePrealable: "",
  });
  const [adjustments, setAdjustments] = useState({
    remisePercent: "", remiseAmount: "", ajustementLabel: "", ajustementAmount: "",
  });

  // Queries — Supabase direct
  const { data: quote, isLoading } = useQuery<any>({
    queryKey: ["quotes", quoteId],
    queryFn: () => db.getQuote(quoteId),
  });
  const { data: existingLines = [] } = useQuery<any[]>({
    queryKey: ["document-lines", "quote", quoteId],
    queryFn: () => db.getDocumentLines("quote", quoteId),
  });
  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ["contacts"],
    queryFn: () => db.getContacts(),
  });
  const { data: company } = useQuery<any>({
    queryKey: ["company"],
    queryFn: () => db.getCompanySettings(),
  });
  // Templates — static, empty (templates served from modeles-devis page)
  const templates: any[] = [];

  const contactMap = new Map((contacts as any[]).map((c: any) => [c.id, c]));
  const contact = quote ? contactMap.get(quote.contact_id) : undefined;
  const clients = (contacts as any[]).filter((c: any) => c.type === "client");

  // Initialize form from loaded quote
  useEffect(() => {
    if (quote) {
      setQuoteForm({
        title: quote.title || "",
        description: quote.description || "",
        valid_until: quote.valid_until || "",
        notes: quote.notes || "",
        conditions: quote.conditions || "Validité 30 jours. Acompte 30% à la commande.",
        contact_id: String(quote.contact_id || ""),
        discount_percent: quote.discount_percent || "",
      });
    }
  }, [quote]);

  // Initialize lines from loaded data
  useEffect(() => {
    if (existingLines.length > 0) {
      setLines(existingLines.map((l: any) => ({
        id: l.id,
        designation: l.designation || "",
        description: l.description || "",
        quantity: String(l.quantity || "1"),
        unit: l.unit || "u",
        unit_price_ht: String(l.unit_price_ht || "0"),
        tva_rate: String(l.tva_rate || "20"),
        is_title: l.is_title || false,
        is_subtotal: l.is_subtotal || false,
        line_type: (l.line_type as LineType) || "fourniture",
        purchase_price_ht: String(l.purchase_price_ht || ""),
        coefficient: String(l.coefficient || ""),
        margin_percent: String(l.margin_percent || ""),
      })));
    } else if (existingLines.length === 0 && quote && !isLoading) {
      setLines([{ ...EMPTY_LINE }]);
    }
  }, [existingLines, quote, isLoading]);

  // Line management
  function addLine() {
    setLines(prev => [...prev, { ...EMPTY_LINE }]);
  }
  function addTitleLine() {
    setLines(prev => [...prev, { ...EMPTY_LINE, is_title: true, designation: "Nouveau chapitre" }]);
  }
  function addSubtotalLine() {
    setLines(prev => [...prev, { ...EMPTY_LINE, is_subtotal: true, designation: "Sous-total" }]);
  }
  function removeLine(idx: number) {
    setLines(prev => prev.filter((_, i) => i !== idx));
  }
  function updateLine(idx: number, field: keyof LineItem, value: string | boolean) {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l;
      const updated = { ...l, [field]: value };
      // Auto-calculate margin fields
      if (field === "coefficient" && updated.purchase_price_ht) {
        const coeff = parseFloat(value as string);
        const purchase = parseFloat(updated.purchase_price_ht);
        if (coeff > 0 && purchase > 0) {
          updated.unit_price_ht = String((purchase * coeff).toFixed(2));
          updated.margin_percent = String(((1 - 1 / coeff) * 100).toFixed(1));
        }
      } else if (field === "unit_price_ht" && updated.purchase_price_ht) {
        const selling = parseFloat(value as string);
        const purchase = parseFloat(updated.purchase_price_ht);
        if (selling > 0 && purchase > 0) {
          updated.coefficient = String((selling / purchase).toFixed(2));
          updated.margin_percent = String(((1 - purchase / selling) * 100).toFixed(1));
        }
      } else if (field === "purchase_price_ht" && updated.unit_price_ht) {
        const purchase = parseFloat(value as string);
        const selling = parseFloat(updated.unit_price_ht);
        if (purchase > 0 && selling > 0) {
          updated.coefficient = String((selling / purchase).toFixed(2));
          updated.margin_percent = String(((1 - purchase / selling) * 100).toFixed(1));
        }
      }
      return updated;
    }));
  }
  function moveLine(from: number, to: number) {
    if (to < 0 || to >= lines.length) return;
    const arr = [...lines];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    setLines(arr);
  }

  // Apply template
  function applyTemplate(template: any) {
    if (!template.lines) return;
    const newLines: LineItem[] = template.lines.map((l: any) => ({
      designation: l.designation || "",
      description: l.description || "",
      quantity: "1",
      unit: l.unit || "u",
      unit_price_ht: l.unit_price_ht || "0",
      tva_rate: l.tva_rate || "10",
      is_title: false,
      is_subtotal: false,
      line_type: (l.line_type as LineType) || "fourniture",
      purchase_price_ht: l.purchase_price_ht || "",
      coefficient: l.coefficient || "",
      margin_percent: l.margin_percent || "",
    }));
    setLines(prev => {
      const nonEmpty = prev.filter(l => l.designation.trim() !== "");
      if (nonEmpty.length === 0) return newLines;
      return [...prev, { ...EMPTY_LINE, is_title: true, designation: template.name }, ...newLines];
    });
    toast({ title: "Modèle appliqué", description: `${template.name} — ${newLines.length} lignes ajoutées` });
  }

  // Calculations
  const dataLines = lines.filter(l => !l.is_title && !l.is_subtotal);
  const totalHT = dataLines
    .reduce((s, l) => s + (parseFloat(l.quantity || "0") * parseFloat(l.unit_price_ht || "0")), 0);
  const totalTVA = dataLines
    .reduce((s, l) => {
      const ht = parseFloat(l.quantity || "0") * parseFloat(l.unit_price_ht || "0");
      return s + ht * (parseFloat(l.tva_rate || "0") / 100);
    }, 0);
  const discountPct = parseFloat(quoteForm.discount_percent || "0");
  const discountAmount = discountPct > 0 ? totalHT * (discountPct / 100) : 0;

  // Global adjustments
  const adjRemisePct = parseFloat(adjustments.remisePercent || "0");
  const adjRemiseAmt = parseFloat(adjustments.remiseAmount || "0");
  const adjLibreAmt = parseFloat(adjustments.ajustementAmount || "0");
  const totalAdjustments = (adjRemisePct > 0 ? totalHT * adjRemisePct / 100 : 0) + adjRemiseAmt - adjLibreAmt;

  const finalHT = totalHT - discountAmount - totalAdjustments;
  const discountRatio = totalHT > 0 ? finalHT / totalHT : 1;
  const finalTVA = totalTVA * discountRatio;
  const totalTTC = finalHT + finalTVA;

  // Margin totals
  const totalPurchaseHT = dataLines
    .reduce((s, l) => s + (parseFloat(l.quantity || "0") * parseFloat(l.purchase_price_ht || "0")), 0);
  const margeBruteHT = finalHT - totalPurchaseHT;

  // Save mutation (bulk lines + quote update)
  const saveMut = useMutation({
    mutationFn: async () => {
      // Update quote metadata
      await db.updateQuote(quoteId, {
        title: quoteForm.title,
        description: quoteForm.description,
        valid_until: quoteForm.valid_until || null,
        notes: quoteForm.notes || null,
        conditions: quoteForm.conditions || null,
        contact_id: Number(quoteForm.contact_id) || quote?.contact_id,
        discount_percent: quoteForm.discount_percent || null,
        amount_ht: finalHT.toFixed(2),
        amount_tva: finalTVA.toFixed(2),
        amount_ttc: totalTTC.toFixed(2),
      });
      // Save lines via bulk operation
      const cleanLines = lines
        .filter(l => l.designation.trim() !== "" || l.is_title || l.is_subtotal)
        .map(l => ({
          designation: l.designation,
          description: l.description || null,
          quantity: l.quantity || "1",
          unit: l.unit || "u",
          unit_price_ht: l.unit_price_ht || "0",
          tva_rate: l.tva_rate || "20",
          is_title: l.is_title || false,
          is_subtotal: l.is_subtotal || false,
          line_type: l.line_type || null,
          purchase_price_ht: l.purchase_price_ht || null,
          coefficient: l.coefficient || null,
          margin_percent: l.margin_percent || null,
        }));
      await db.bulkSaveDocumentLines("quote", quoteId, cleanLines);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quotes", quoteId] });
      queryClient.invalidateQueries({ queryKey: ["document-lines", "quote", quoteId] });
      toast({ title: "Devis enregistré", description: "Toutes les modifications ont été sauvegardées." });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  // Delete
  const deleteMut = useMutation({
    mutationFn: async () => db.deleteQuote(quoteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: "Devis supprimé" });
      setLocation("/devis");
    },
  });

  // Facturer (create invoice from quote)
  const facturerMut = useMutation({
    mutationFn: async () => {
      return db.createInvoiceFromQuote(quoteId);
    },
    onSuccess: (invoice: any) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["quotes", quoteId] });
      setShowFacturer(false);
      toast({ title: "Facture créée", description: `${invoice.number} — ${invoice.title}` });
      setLocation("/factures");
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <AppLayout title="Devis">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Chargement du devis...</div>
        </div>
      </AppLayout>
    );
  }

  if (!quote) {
    return (
      <AppLayout title="Devis">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Devis introuvable</p>
          <Button variant="outline" onClick={() => setLocation("/devis")} className="gap-2">
            <ArrowLeft className="size-4" /> Retour aux devis
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={`Devis ${quote.number}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-2 h-8 text-xs" onClick={() => setLocation("/devis")} data-testid="btn-back">
            <ArrowLeft className="size-3.5" /> Retour
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => {
            setShowPdf(true);
          }} data-testid="btn-preview-pdf">
            <Eye className="size-3.5" /> Aperçu PDF
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => {
            toast({ title: "Téléchargement PDF", description: "Téléchargement PDF bientôt disponible." });
          }} data-testid="btn-download-pdf">
            <Download className="size-3.5" /> Télécharger
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-8 text-xs" onClick={() => setShowEmail(true)} data-testid="btn-send-email">
            <Send className="size-3.5" /> Envoyer
          </Button>
          {(quote.status === "signé" || quote.status === "envoyé") && (
            <Button variant="outline" size="sm" className="gap-2 h-8 text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" onClick={() => setShowFacturer(true)} data-testid="btn-facturer">
              <FileText className="size-3.5" /> Facturer
            </Button>
          )}
          <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => saveMut.mutate()} disabled={saveMut.isPending} data-testid="btn-save">
            <Save className="size-3.5" /> {saveMut.isPending ? "Sauvegarde..." : "Enregistrer"}
          </Button>
        </div>
      }
    >
      {/* Mentions légales checker */}
      {company && (() => {
        const missing: string[] = [];
        if (!company.siret) missing.push("SIRET");
        if (!company.assurance_decennale) missing.push("Assurance décennale");
        if (!company.tva_intracom) missing.push("TVA intracommunautaire");
        if (!company.rcs_number) missing.push("RCS");
        return missing.length > 0 ? (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-xs text-amber-400">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{missing.length} mention{missing.length > 1 ? "s" : ""} légale{missing.length > 1 ? "s" : ""} obligatoire{missing.length > 1 ? "s" : ""} manquante{missing.length > 1 ? "s" : ""} : {missing.join(", ")}.</span>
            <a href="/#/parametres" className="ml-auto text-primary underline shrink-0">Configurer</a>
          </div>
        ) : null;
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Metadata */}
        <div className="space-y-4">
          {/* Status & Info */}
          <Card>
            <CardContent className="py-4 px-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{quote.number}</span>
                <StatusBadge status={quote.status} />
              </div>
              <Separator />
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Client</Label>
                  <Select value={quoteForm.contact_id} onValueChange={v => setQuoteForm(f => ({ ...f, contact_id: v }))}>
                    <SelectTrigger className="h-8 text-sm mt-1" data-testid="select-detail-client">
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c: any) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {contactName({ first_name: c.first_name, last_name: c.last_name, company: c.company })}{c.company ? ` — ${c.company}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Objet du devis</Label>
                  <Input
                    value={quoteForm.title}
                    onChange={e => setQuoteForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Ex: Rénovation salle de bain"
                    className="h-8 text-sm mt-1"
                    data-testid="input-detail-title"
                  />
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Textarea
                    value={quoteForm.description}
                    onChange={e => setQuoteForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Description détaillée..."
                    rows={2} className="text-sm mt-1"
                    data-testid="input-detail-description"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Valide jusqu'au</Label>
                    <Input
                      type="date" value={quoteForm.valid_until}
                      onChange={e => setQuoteForm(f => ({ ...f, valid_until: e.target.value }))}
                      className="h-8 text-sm mt-1" data-testid="input-detail-valid"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Remise (%)</Label>
                    <Input
                      type="number" step="0.1" min="0" max="100"
                      value={quoteForm.discount_percent}
                      onChange={e => setQuoteForm(f => ({ ...f, discount_percent: e.target.value }))}
                      placeholder="0" className="h-8 text-sm mt-1" data-testid="input-detail-discount"
                    />
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs flex items-center gap-1"><Calendar className="size-3" /> Début des travaux</Label>
                    <Input
                      type="date" value={headerFields.debutTravaux}
                      onChange={e => setHeaderFields(f => ({ ...f, debutTravaux: e.target.value }))}
                      className="h-8 text-sm mt-1" data-testid="input-debut-travaux"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Durée estimée</Label>
                    <Input
                      value={headerFields.dureeEstimee}
                      onChange={e => setHeaderFields(f => ({ ...f, dureeEstimee: e.target.value }))}
                      placeholder="Ex: 2 semaines" className="h-8 text-sm mt-1" data-testid="input-duree"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><Calendar className="size-3" /> Visite préalable</Label>
                  <Input
                    type="date" value={headerFields.visitePrealable}
                    onChange={e => setHeaderFields(f => ({ ...f, visitePrealable: e.target.value }))}
                    className="h-8 text-sm mt-1" data-testid="input-visite"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conditions */}
          <Card>
            <CardContent className="py-4 px-4 space-y-3">
              <Label className="text-xs">Conditions</Label>
              <Textarea
                value={quoteForm.conditions}
                onChange={e => setQuoteForm(f => ({ ...f, conditions: e.target.value }))}
                rows={3} className="text-sm" data-testid="input-detail-conditions"
              />
              <Label className="text-xs">Notes internes</Label>
              <Textarea
                value={quoteForm.notes}
                onChange={e => setQuoteForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} className="text-sm" placeholder="Notes visibles uniquement par vous"
                data-testid="input-detail-notes"
              />
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardContent className="py-4 px-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total HT</span>
                <span className="font-medium">{formatCurrency(totalHT)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm text-orange-400">
                  <span>Remise ({discountPct}%)</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              {totalAdjustments !== 0 && (
                <div className="flex justify-between text-sm text-orange-400">
                  <span>Ajustements</span>
                  <span>{totalAdjustments > 0 ? "-" : "+"}{formatCurrency(Math.abs(totalAdjustments))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total TVA</span>
                <span className="font-medium">{formatCurrency(finalTVA)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-bold text-primary">
                <span>Total TTC</span>
                <span>{formatCurrency(totalTTC)}</span>
              </div>
              {showMargins && totalPurchaseHT > 0 && (
                <>
                  <Separator />
                  <div className="flex justify-between text-sm text-emerald-400">
                    <span>Marge brute HT</span>
                    <span className="font-medium">{formatCurrency(margeBruteHT)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Taux de marge</span>
                    <span>{finalHT > 0 ? ((margeBruteHT / finalHT) * 100).toFixed(1) : "0"}%</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Templates */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                <Package className="size-3.5" /> Modèles de devis
              </CardTitle>
            </CardHeader>
            <CardContent className="py-0 px-4 pb-4 space-y-1.5">
              {templates.map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className="w-full text-left p-2 rounded-md hover:bg-muted/50 transition-colors text-xs border border-border/50"
                  data-testid={`template-${t.id}`}
                >
                  <div className="font-medium">{t.name}</div>
                  <div className="text-muted-foreground mt-0.5">{t.description}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Danger zone */}
          <Card className="border-destructive/30">
            <CardContent className="py-3 px-4">
              <Button
                variant="destructive" size="sm" className="w-full gap-2 h-8 text-xs"
                onClick={() => { if (confirm("Supprimer ce devis ?")) deleteMut.mutate(); }}
                data-testid="btn-delete-devis"
              >
                <Trash2 className="size-3.5" /> Supprimer le devis
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right: Lines */}
        <div className="lg:col-span-2 space-y-4">
          {/* Actions bar */}
          <Card>
            <CardContent className="py-3 px-4 flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" className="gap-2 h-7 text-xs" onClick={addLine} data-testid="btn-add-line">
                <Plus className="size-3" /> Ligne
              </Button>
              <Button size="sm" variant="outline" className="gap-2 h-7 text-xs" onClick={addTitleLine} data-testid="btn-add-title">
                <Heading className="size-3" /> Titre / Section
              </Button>
              <Button size="sm" variant="outline" className="gap-2 h-7 text-xs" onClick={addSubtotalLine} data-testid="btn-add-subtotal">
                <Calculator className="size-3" /> Sous-total
              </Button>
              <Button
                size="sm"
                variant={showMargins ? "default" : "outline"}
                className="gap-2 h-7 text-xs"
                onClick={() => setShowMargins(v => !v)}
                data-testid="btn-toggle-margins"
              >
                <BarChart3 className="size-3" /> Marges
              </Button>
              <div className="ml-auto text-xs text-muted-foreground">
                {lines.filter(l => !l.is_title && !l.is_subtotal).length} ligne(s)
              </div>
            </CardContent>
          </Card>

          {/* Lines list */}
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <Card key={idx} className={`transition-all ${line.is_title ? "border-l-[3px] border-l-primary border-primary/30 bg-primary/5" : line.is_subtotal ? "border-border bg-muted/30" : ""}`}>
                <CardContent className="py-3 px-4">
                  {line.is_title ? (
                    /* Title line */
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveLine(idx, idx - 1)} disabled={idx === 0}>
                          <ChevronUp className="size-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveLine(idx, idx + 1)} disabled={idx === lines.length - 1}>
                          <ChevronDown className="size-3" />
                        </Button>
                      </div>
                      <Heading className="size-4 text-primary shrink-0" />
                      <Input
                        value={line.designation}
                        onChange={e => updateLine(idx, "designation", e.target.value)}
                        className="h-9 text-sm font-bold flex-1"
                        placeholder="Titre de la section"
                        data-testid={`line-title-${idx}`}
                      />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeLine(idx)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ) : line.is_subtotal ? (
                    /* Subtotal line */
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveLine(idx, idx - 1)} disabled={idx === 0}>
                          <ChevronUp className="size-3" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveLine(idx, idx + 1)} disabled={idx === lines.length - 1}>
                          <ChevronDown className="size-3" />
                        </Button>
                      </div>
                      <Calculator className="size-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium text-muted-foreground flex-1">
                        {(() => {
                          for (let j = idx - 1; j >= 0; j--) {
                            if (lines[j].is_title) return `Sous-total ${lines[j].designation}`;
                            if (lines[j].is_subtotal) break;
                          }
                          return "Sous-total";
                        })()}
                      </span>
                      <span className="text-sm font-semibold mr-2">
                        {(() => {
                          const prevLines: LineItem[] = [];
                          for (let j = idx - 1; j >= 0; j--) {
                            if (lines[j].is_title || lines[j].is_subtotal) break;
                            prevLines.push(lines[j]);
                          }
                          return formatCurrency(prevLines.reduce((s, l) => s + (parseFloat(l.quantity || "0") * parseFloat(l.unit_price_ht || "0")), 0));
                        })()}
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => removeLine(idx)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    /* Regular line */
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex flex-col gap-1 mt-1">
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveLine(idx, idx - 1)} disabled={idx === 0}>
                            <ChevronUp className="size-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveLine(idx, idx + 1)} disabled={idx === lines.length - 1}>
                            <ChevronDown className="size-3" />
                          </Button>
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              value={line.designation}
                              onChange={e => updateLine(idx, "designation", e.target.value)}
                              className="h-8 text-sm font-medium flex-1"
                              placeholder="Désignation de la prestation"
                              data-testid={`line-designation-${idx}`}
                            />
                            {(() => {
                              const lt = LINE_TYPE_MAP[line.line_type];
                              if (!lt) return null;
                              const Icon = lt.icon;
                              return (
                                <Select value={line.line_type} onValueChange={v => updateLine(idx, "line_type", v)}>
                                  <SelectTrigger className="h-7 w-auto gap-1 border-0 px-2 text-[10px] shrink-0" style={{ background: `${lt.color}15`, color: lt.color }}>
                                    <Icon className="size-3" />
                                    <span>{lt.label}</span>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {LINE_TYPES.map(t => (
                                      <SelectItem key={t.value} value={t.value}>
                                        <span className="flex items-center gap-1.5">
                                          <span className="size-2 rounded-full" style={{ background: t.color }} />
                                          {t.label}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            })()}
                          </div>
                          <Input
                            value={line.description}
                            onChange={e => updateLine(idx, "description", e.target.value)}
                            className="h-7 text-xs text-muted-foreground"
                            placeholder="Description complémentaire (optionnel)"
                            data-testid={`line-description-${idx}`}
                          />
                          <div className={`grid gap-2 ${showMargins ? "grid-cols-8" : "grid-cols-5"}`}>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Qté</Label>
                              <Input
                                type="number" step="0.01" min="0"
                                value={line.quantity}
                                onChange={e => updateLine(idx, "quantity", e.target.value)}
                                className="h-7 text-xs" data-testid={`line-qty-${idx}`}
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Unité</Label>
                              <Select value={line.unit} onValueChange={v => updateLine(idx, "unit", v)}>
                                <SelectTrigger className="h-7 text-xs" data-testid={`line-unit-${idx}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            {showMargins && (
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Coût achat</Label>
                                <Input
                                  type="number" step="0.01" min="0"
                                  value={line.purchase_price_ht}
                                  onChange={e => updateLine(idx, "purchase_price_ht", e.target.value)}
                                  className="h-7 text-xs" placeholder="0" data-testid={`line-purchase-${idx}`}
                                />
                              </div>
                            )}
                            {showMargins && (
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Coeff.</Label>
                                <Input
                                  type="number" step="0.01" min="0"
                                  value={line.coefficient}
                                  onChange={e => updateLine(idx, "coefficient", e.target.value)}
                                  className="h-7 text-xs" placeholder="1.0" data-testid={`line-coeff-${idx}`}
                                />
                              </div>
                            )}
                            <div>
                              <Label className="text-[10px] text-muted-foreground">P.U. HT</Label>
                              <Input
                                type="number" step="0.01" min="0"
                                value={line.unit_price_ht}
                                onChange={e => updateLine(idx, "unit_price_ht", e.target.value)}
                                className="h-7 text-xs" data-testid={`line-price-${idx}`}
                              />
                            </div>
                            {showMargins && (
                              <div>
                                <Label className="text-[10px] text-muted-foreground">Marge %</Label>
                                <div className="h-7 flex items-center text-xs text-emerald-400 pr-1">
                                  {line.margin_percent ? `${line.margin_percent}%` : "—"}
                                </div>
                              </div>
                            )}
                            <div>
                              <Label className="text-[10px] text-muted-foreground">TVA</Label>
                              <Select value={line.tva_rate} onValueChange={v => updateLine(idx, "tva_rate", v)}>
                                <SelectTrigger className="h-7 text-xs" data-testid={`line-tva-${idx}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TVA_RATES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[10px] text-muted-foreground">Total HT</Label>
                              <div className="h-7 flex items-center text-xs font-semibold text-right pr-2">
                                {formatCurrency(parseFloat(line.quantity || "0") * parseFloat(line.unit_price_ht || "0"))}
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 mt-1 text-destructive hover:text-destructive shrink-0" onClick={() => removeLine(idx)}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {lines.length === 0 && (
              <Card>
                <CardContent className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <FileText className="size-8 opacity-50" />
                  <p className="text-sm">Aucune ligne dans ce devis</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-2 text-xs" onClick={addLine}>
                      <Plus className="size-3" /> Ajouter une ligne
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Global Adjustments */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">Ajustements</CardTitle>
            </CardHeader>
            <CardContent className="py-0 px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Remise globale (%)</Label>
                  <Input
                    type="number" step="0.1" min="0" max="100"
                    value={adjustments.remisePercent}
                    onChange={e => setAdjustments(f => ({ ...f, remisePercent: e.target.value }))}
                    className="h-7 text-xs" placeholder="0" data-testid="input-adj-remise-pct"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Remise globale (€)</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    value={adjustments.remiseAmount}
                    onChange={e => setAdjustments(f => ({ ...f, remiseAmount: e.target.value }))}
                    className="h-7 text-xs" placeholder="0" data-testid="input-adj-remise-amt"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Ajustement libre — Libellé</Label>
                  <Input
                    value={adjustments.ajustementLabel}
                    onChange={e => setAdjustments(f => ({ ...f, ajustementLabel: e.target.value }))}
                    className="h-7 text-xs" placeholder="Ex: Arrondi" data-testid="input-adj-label"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">Montant (+ ou -)</Label>
                  <Input
                    type="number" step="0.01"
                    value={adjustments.ajustementAmount}
                    onChange={e => setAdjustments(f => ({ ...f, ajustementAmount: e.target.value }))}
                    className="h-7 text-xs" placeholder="0" data-testid="input-adj-amount"
                  />
                </div>
              </div>
              {totalAdjustments !== 0 && (
                <div className="text-xs text-muted-foreground text-right">
                  Impact: <span className="font-medium text-orange-400">{totalAdjustments > 0 ? "-" : "+"}{formatCurrency(Math.abs(totalAdjustments))}</span> sur le total HT
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bottom action bar */}
          <div className="flex items-center gap-2 justify-between">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-2 h-8 text-xs" onClick={addLine}>
                <Plus className="size-3" /> Ajouter une ligne
              </Button>
            </div>
            <Button size="sm" className="gap-2 h-8 text-xs" onClick={() => saveMut.mutate()} disabled={saveMut.isPending} data-testid="btn-save-bottom">
              <Save className="size-3.5" /> {saveMut.isPending ? "Sauvegarde..." : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>

      {/* PDF Preview */}
      {showPdf && (
        <DevisPDFPreview
          quote={quote}
          contact={contact}
          company={company}
          lines={lines}
          onClose={() => setShowPdf(false)}
          adjustments={adjustments}
          headerFields={headerFields}
          showMargins={showMargins}
        />
      )}

      {/* Email Dialog */}
      {showEmail && (
        <SendEmailDialog
          quote={quote}
          contact={contact}
          onClose={() => setShowEmail(false)}
          onSent={() => {
            setShowEmail(false);
            queryClient.invalidateQueries({ queryKey: ["quotes", quoteId] });
          }}
        />
      )}

      {/* Facturer Dialog */}
      <Dialog open={showFacturer} onOpenChange={setShowFacturer}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-5 text-emerald-400" /> Facturer le devis {quote.number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Montant du devis : <span className="font-bold text-foreground">{formatCurrency(parseFloat(quote.amount_ttc || "0"))} TTC</span>
            </div>

            {/* Type selection */}
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "acompte" as const, label: "Acompte", desc: "Paiement partiel anticipé" },
                { value: "situation" as const, label: "Situation", desc: "Avancement des travaux" },
                { value: "facture" as const, label: "Finale", desc: "Facture complète" },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`rounded-lg border p-3 text-left transition-all ${
                    facturerType === opt.value
                      ? "ring-2 ring-primary bg-primary/5 border-primary"
                      : "bg-card border-border hover:bg-muted/30"
                  }`}
                  onClick={() => setFacturerType(opt.value)}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Percent input for acompte/situation */}
            {(facturerType === "acompte" || facturerType === "situation") && (
              <div className="space-y-3">
                <div>
                  <Label>Pourcentage (%)</Label>
                  <Input
                    type="number" min="1" max="100" step="1"
                    value={facturerPercent}
                    onChange={e => setFacturerPercent(e.target.value)}
                    data-testid="input-facturer-percent"
                  />
                </div>
                {facturerType === "situation" && (
                  <div>
                    <Label>N° de situation</Label>
                    <Input
                      type="number" min="1" step="1"
                      value={facturerSituation}
                      onChange={e => setFacturerSituation(e.target.value)}
                      data-testid="input-facturer-situation"
                    />
                  </div>
                )}
                <div className="bg-muted/30 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Montant facturé :</span>
                    <span className="font-bold">
                      {formatCurrency(parseFloat(quote.amount_ttc || "0") * (parseFloat(facturerPercent || "0") / 100))} TTC
                    </span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="secondary" onClick={() => setShowFacturer(false)}>Annuler</Button>
              <Button
                onClick={() => facturerMut.mutate()}
                disabled={facturerMut.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="btn-submit-facturer"
              >
                {facturerMut.isPending ? "Création..." : "Créer la facture"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

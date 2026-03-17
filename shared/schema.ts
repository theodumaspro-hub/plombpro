import { z } from "zod";

// ─── Company / Onboarding ─────────────────────────────────────────
export const companySettingsSchema = z.object({
  id: z.number(),
  name: z.string(),
  siret: z.string().nullable(),
  tva_intracom: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  postal_code: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  rcs_number: z.string().nullable(),
  assurance_decennale: z.string().nullable(),
  qualifications: z.string().nullable(),
  logo: z.string().nullable(),
  trade: z.string().nullable(),
  legal_form: z.string().nullable(),
  capital: z.string().nullable(),
  ape_code: z.string().nullable(),
  iban: z.string().nullable(),
  bic: z.string().nullable(),
  bank_name: z.string().nullable(),
  default_tva_rate: z.string().nullable(),
  default_payment_delay: z.number().nullable(),
  document_color: z.string().nullable(),
  logo_alignment: z.string().nullable(),
  table_style: z.string().nullable(),
  devis_prefix: z.string().nullable(),
  facture_prefix: z.string().nullable(),
  avoir_prefix: z.string().nullable(),
  number_separator: z.string().nullable(),
  number_year_format: z.string().nullable(),
  default_validity: z.number().nullable(),
  default_payment_methods: z.string().nullable(),
  default_acompte_rate: z.string().nullable(),
  cgv_text: z.string().nullable(),
  show_cgv: z.boolean().nullable(),
  autoliquidation_mention: z.string().nullable(),
  onboarding_completed: z.boolean().nullable(),
  onboarding_step: z.number().nullable(),
  plan: z.string().nullable(),
  plan_start_date: z.string().nullable(),
  plan_end_date: z.string().nullable(),
  trial_ends_at: z.string().nullable(),
});
export type CompanySettings = z.infer<typeof companySettingsSchema>;
export const insertCompanySettingsSchema = companySettingsSchema.omit({ id: true });
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;

// ─── Contacts (Clients + Fournisseurs) ───────────────────────────
export const contactSchema = z.object({
  id: z.number(),
  type: z.string(),
  category: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  company: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  mobile: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  postal_code: z.string().nullable(),
  siret: z.string().nullable(),
  tva_intracom: z.string().nullable(),
  notes: z.string().nullable(),
  tags: z.string().nullable(),
  total_quoted: z.string().nullable(),
  total_billed: z.string().nullable(),
  total_paid: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type Contact = z.infer<typeof contactSchema>;
export const insertContactSchema = contactSchema.omit({ id: true, created_at: true });
export type InsertContact = z.infer<typeof insertContactSchema>;

// ─── Devis (Quotes) ──────────────────────────────────────────────
export const quoteSchema = z.object({
  id: z.number(),
  contact_id: z.number(),
  chantier_id: z.number().nullable(),
  number: z.string(),
  status: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  amount_ht: z.string().nullable(),
  amount_tva: z.string().nullable(),
  amount_ttc: z.string().nullable(),
  discount_percent: z.string().nullable(),
  discount_amount: z.string().nullable(),
  valid_until: z.string().nullable(),
  signed_at: z.string().nullable(),
  signature_data: z.string().nullable(),
  notes: z.string().nullable(),
  conditions: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type Quote = z.infer<typeof quoteSchema>;
export const insertQuoteSchema = quoteSchema.omit({ id: true, created_at: true });
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

// ─── Factures (Invoices) ─────────────────────────────────────────
export const invoiceSchema = z.object({
  id: z.number(),
  contact_id: z.number(),
  chantier_id: z.number().nullable(),
  quote_id: z.number().nullable(),
  number: z.string(),
  type: z.string(),
  status: z.string(),
  title: z.string().nullable(),
  amount_ht: z.string().nullable(),
  amount_tva: z.string().nullable(),
  amount_ttc: z.string().nullable(),
  amount_paid: z.string().nullable(),
  payment_method: z.string().nullable(),
  payment_date: z.string().nullable(),
  due_date: z.string().nullable(),
  reminder_count: z.number().nullable(),
  last_reminder_date: z.string().nullable(),
  situation_number: z.number().nullable(),
  situation_percent: z.string().nullable(),
  retenue_garantie_percent: z.string().nullable(),
  retenue_garantie_amount: z.string().nullable(),
  retenue_garantie_due_date: z.string().nullable(),
  prime_energie_amount: z.string().nullable(),
  prime_energie_type: z.string().nullable(),
  factur_x_status: z.string().nullable(),
  factur_x_format: z.string().nullable(),
  notes: z.string().nullable(),
  conditions: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type Invoice = z.infer<typeof invoiceSchema>;
export const insertInvoiceSchema = invoiceSchema.omit({ id: true, created_at: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

// ─── Document Lines (shared by quotes + invoices) ────────────────
export const documentLineSchema = z.object({
  id: z.number(),
  document_type: z.string(),
  document_id: z.number(),
  library_item_id: z.number().nullable(),
  designation: z.string(),
  description: z.string().nullable(),
  quantity: z.string().nullable(),
  unit: z.string().nullable(),
  unit_price_ht: z.string().nullable(),
  tva_rate: z.string().nullable(),
  total_ht: z.string().nullable(),
  sort_order: z.number().nullable(),
  is_title: z.boolean().nullable(),
  is_subtotal: z.boolean().nullable(),
  line_type: z.string().nullable(),
  purchase_price_ht: z.string().nullable(),
  coefficient: z.string().nullable(),
  margin_percent: z.string().nullable(),
});
export type DocumentLine = z.infer<typeof documentLineSchema>;
export const insertDocumentLineSchema = documentLineSchema.omit({ id: true });
export type InsertDocumentLine = z.infer<typeof insertDocumentLineSchema>;

// ─── Chantiers (Job Sites / Projects) ────────────────────────────
export const chantierSchema = z.object({
  id: z.number(),
  contact_id: z.number(),
  reference: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  priority: z.string().nullable(),
  type: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  postal_code: z.string().nullable(),
  estimated_amount_ht: z.string().nullable(),
  actual_amount_ht: z.string().nullable(),
  cost_materials: z.string().nullable(),
  cost_labor: z.string().nullable(),
  cost_subcontractors: z.string().nullable(),
  margin: z.string().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  completion_percent: z.number().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type Chantier = z.infer<typeof chantierSchema>;
export const insertChantierSchema = chantierSchema.omit({ id: true, created_at: true });
export type InsertChantier = z.infer<typeof insertChantierSchema>;

// ─── Ressources (Employés, Intérimaires, Sous-traitants, Matériels) ─
export const resourceSchema = z.object({
  id: z.number(),
  type: z.string(),
  name: z.string(),
  role: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  hourly_rate: z.string().nullable(),
  daily_rate: z.string().nullable(),
  color: z.string().nullable(),
  status: z.string(),
  skills: z.string().nullable(),
  certifications: z.string().nullable(),
  company: z.string().nullable(),
  siret: z.string().nullable(),
  assurance_decennale: z.string().nullable(),
  assurance_expiry: z.string().nullable(),
  category: z.string().nullable(),
  serial_number: z.string().nullable(),
  purchase_date: z.string().nullable(),
  purchase_price: z.string().nullable(),
  next_maintenance_date: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type Resource = z.infer<typeof resourceSchema>;
export const insertResourceSchema = resourceSchema.omit({ id: true, created_at: true });
export type InsertResource = z.infer<typeof insertResourceSchema>;

// ─── Bibliothèque (Price Catalog / Library) ──────────────────────
export const libraryItemSchema = z.object({
  id: z.number(),
  type: z.string(),
  family: z.string().nullable(),
  sub_family: z.string().nullable(),
  reference: z.string().nullable(),
  designation: z.string(),
  description: z.string().nullable(),
  unit: z.string().nullable(),
  purchase_price_ht: z.string().nullable(),
  selling_price_ht: z.string().nullable(),
  margin_percent: z.string().nullable(),
  tva_rate: z.string().nullable(),
  supplier_id: z.number().nullable(),
  created_at: z.string().nullable(),
});
export type LibraryItem = z.infer<typeof libraryItemSchema>;
export const insertLibraryItemSchema = libraryItemSchema.omit({ id: true, created_at: true });
export type InsertLibraryItem = z.infer<typeof insertLibraryItemSchema>;

// ─── Achats (Purchases / Orders) ─────────────────────────────────
export const purchaseSchema = z.object({
  id: z.number(),
  supplier_id: z.number(),
  chantier_id: z.number().nullable(),
  number: z.string(),
  status: z.string(),
  amount_ht: z.string().nullable(),
  amount_tva: z.string().nullable(),
  amount_ttc: z.string().nullable(),
  order_date: z.string().nullable(),
  delivery_date: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type Purchase = z.infer<typeof purchaseSchema>;
export const insertPurchaseSchema = purchaseSchema.omit({ id: true, created_at: true });
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;

// ─── Purchase Lines ──────────────────────────────────────────────
export const purchaseLineSchema = z.object({
  id: z.number(),
  purchase_id: z.number(),
  library_item_id: z.number().nullable(),
  designation: z.string(),
  quantity: z.string().nullable(),
  unit: z.string().nullable(),
  unit_price_ht: z.string().nullable(),
  tva_rate: z.string().nullable(),
  total_ht: z.string().nullable(),
  sort_order: z.number().nullable(),
});
export type PurchaseLine = z.infer<typeof purchaseLineSchema>;
export const insertPurchaseLineSchema = purchaseLineSchema.omit({ id: true });
export type InsertPurchaseLine = z.infer<typeof insertPurchaseLineSchema>;

// ─── Bank Transactions ───────────────────────────────────────────
export const bankTransactionSchema = z.object({
  id: z.number(),
  date: z.string(),
  label: z.string(),
  amount: z.string(),
  type: z.string(),
  category: z.string().nullable(),
  matched_invoice_id: z.number().nullable(),
  matched_purchase_id: z.number().nullable(),
  reconciled: z.boolean().nullable(),
  bank_name: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type BankTransaction = z.infer<typeof bankTransactionSchema>;
export const insertBankTransactionSchema = bankTransactionSchema.omit({ id: true, created_at: true });
export type InsertBankTransaction = z.infer<typeof insertBankTransactionSchema>;

// ─── Planning / Appointments ─────────────────────────────────────
export const appointmentSchema = z.object({
  id: z.number(),
  chantier_id: z.number().nullable(),
  resource_id: z.number().nullable(),
  contact_id: z.number().nullable(),
  title: z.string(),
  type: z.string(),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  status: z.string(),
  notes: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type Appointment = z.infer<typeof appointmentSchema>;
export const insertAppointmentSchema = appointmentSchema.omit({ id: true, created_at: true });
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

// ─── Time Entries (Suivi du temps) ─────────────────────────────
export const timeEntrySchema = z.object({
  id: z.number(),
  resource_id: z.number(),
  chantier_id: z.number().nullable(),
  appointment_id: z.number().nullable(),
  date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  duration: z.string(),
  description: z.string().nullable(),
  type: z.string(),
  billable: z.boolean().nullable(),
  validated: z.boolean().nullable(),
  created_at: z.string().nullable(),
});
export type TimeEntry = z.infer<typeof timeEntrySchema>;
export const insertTimeEntrySchema = timeEntrySchema.omit({ id: true, created_at: true });
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;

// ─── Documents (Pièces jointes / Documents digitalisés) ───────
export const documentSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  category: z.string().nullable(),
  related_type: z.string().nullable(),
  related_id: z.number().nullable(),
  size: z.number().nullable(),
  mime_type: z.string().nullable(),
  url: z.string().nullable(),
  notes: z.string().nullable(),
  uploaded_by: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type Document = z.infer<typeof documentSchema>;
export const insertDocumentSchema = documentSchema.omit({ id: true, created_at: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

// ─── Payment Links (Paiements clients) ────────────────────────
export const paymentLinkSchema = z.object({
  id: z.number(),
  invoice_id: z.number(),
  contact_id: z.number(),
  amount: z.string(),
  status: z.string(),
  payment_method: z.string().nullable(),
  link_url: z.string().nullable(),
  expires_at: z.string().nullable(),
  paid_at: z.string().nullable(),
  stripe_payment_intent_id: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type PaymentLink = z.infer<typeof paymentLinkSchema>;
export const insertPaymentLinkSchema = paymentLinkSchema.omit({ id: true, created_at: true });
export type InsertPaymentLink = z.infer<typeof insertPaymentLinkSchema>;

// ─── Bank Accounts (Multi-comptes bancaires) ──────────────────
export const bankAccountSchema = z.object({
  id: z.number(),
  bank_name: z.string(),
  account_name: z.string(),
  iban: z.string().nullable(),
  bic: z.string().nullable(),
  balance: z.string().nullable(),
  currency: z.string().nullable(),
  status: z.string(),
  last_sync_at: z.string().nullable(),
  color: z.string().nullable(),
  is_default: z.boolean().nullable(),
  created_at: z.string().nullable(),
});
export type BankAccount = z.infer<typeof bankAccountSchema>;
export const insertBankAccountSchema = bankAccountSchema.omit({ id: true, created_at: true });
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;

// ─── Companies (Multi-sociétés) ───────────────────────────────
export const companySchema = z.object({
  id: z.number(),
  name: z.string(),
  siret: z.string().nullable(),
  legal_form: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  postal_code: z.string().nullable(),
  is_active: z.boolean().nullable(),
  is_primary: z.boolean().nullable(),
  color: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type Company = z.infer<typeof companySchema>;
export const insertCompanySchema = companySchema.omit({ id: true, created_at: true });
export type InsertCompany = z.infer<typeof insertCompanySchema>;

// ─── Supplier Marketplace Items ───────────────────────────────
export const marketplaceItemSchema = z.object({
  id: z.number(),
  supplier_id: z.number().nullable(),
  supplier_name: z.string(),
  category: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price_ht: z.string().nullable(),
  unit: z.string().nullable(),
  min_quantity: z.number().nullable(),
  delivery_days: z.number().nullable(),
  rating: z.string().nullable(),
  image_url: z.string().nullable(),
  in_stock: z.boolean().nullable(),
  promo_percent: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type MarketplaceItem = z.infer<typeof marketplaceItemSchema>;
export const insertMarketplaceItemSchema = marketplaceItemSchema.omit({ id: true, created_at: true });
export type InsertMarketplaceItem = z.infer<typeof insertMarketplaceItemSchema>;

// ─── API Keys (Intégrations) ─────────────────────────────────
export const apiKeySchema = z.object({
  id: z.number(),
  name: z.string(),
  key: z.string(),
  permissions: z.string().nullable(),
  last_used_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  status: z.string(),
  created_at: z.string().nullable(),
});
export type ApiKey = z.infer<typeof apiKeySchema>;
export const insertApiKeySchema = apiKeySchema.omit({ id: true, created_at: true });
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

// ─── Integration Settings (Gmail, WhatsApp) ──────────────────
export const integrationSettingsSchema = z.object({
  id: z.number(),
  provider: z.string(),
  status: z.string(),
  access_token: z.string().nullable(),
  refresh_token: z.string().nullable(),
  token_expiry: z.string().nullable(),
  gmail_email: z.string().nullable(),
  whatsapp_phone: z.string().nullable(),
  whatsapp_api_key: z.string().nullable(),
  whatsapp_instance_id: z.string().nullable(),
  metadata: z.string().nullable(),
  connected_at: z.string().nullable(),
  created_at: z.string().nullable(),
});
export type IntegrationSettings = z.infer<typeof integrationSettingsSchema>;
export const insertIntegrationSettingsSchema = integrationSettingsSchema.omit({ id: true, created_at: true });
export type InsertIntegrationSettings = z.infer<typeof insertIntegrationSettingsSchema>;

// ─── Webhooks ─────────────────────────────────────────────────
export const webhookSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string(),
  events: z.string(),
  secret: z.string().nullable(),
  status: z.string(),
  last_triggered_at: z.string().nullable(),
  failure_count: z.number().nullable(),
  created_at: z.string().nullable(),
});
export type Webhook = z.infer<typeof webhookSchema>;
export const insertWebhookSchema = webhookSchema.omit({ id: true, created_at: true });
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;

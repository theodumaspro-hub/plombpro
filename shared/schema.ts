import { pgTable, text, serial, integer, boolean, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Company / Onboarding ─────────────────────────────────────────
export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  siret: text("siret"),
  tvaIntracom: text("tva_intracom"),
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  phone: text("phone"),
  email: text("email"),
  rcsNumber: text("rcs_number"),
  assuranceDecennale: text("assurance_decennale"),
  qualifications: text("qualifications"),
  logo: text("logo"),
  trade: text("trade"), // plomberie, chauffage, climatisation etc.
  legalForm: text("legal_form"), // SARL, SAS, auto-entrepreneur etc.
  capital: text("capital"),
  apeCode: text("ape_code"),
  iban: text("iban"),
  bic: text("bic"),
  bankName: text("bank_name"),
  defaultTvaRate: decimal("default_tva_rate").default("20"),
  defaultPaymentDelay: integer("default_payment_delay").default(30),
  // Document template settings
  documentColor: text("document_color").default("#C87941"),
  logoAlignment: text("logo_alignment").default("left"), // left, center, right
  tableStyle: text("table_style").default("striped"), // striped, bordered, minimal
  devisPrefix: text("devis_prefix").default("DEV"),
  facturePrefix: text("facture_prefix").default("FAC"),
  avoirPrefix: text("avoir_prefix").default("AV"),
  numberSeparator: text("number_separator").default("-"),
  numberYearFormat: text("number_year_format").default("YYYY"), // YYYY, YY
  defaultValidity: integer("default_validity").default(30), // devis validity in days
  defaultPaymentMethods: text("default_payment_methods"), // JSON array: ["virement","chèque","CB"]
  defaultAcompteRate: decimal("default_acompte_rate").default("30"),
  cgvText: text("cgv_text"),
  showCgv: boolean("show_cgv").default(false),
  autoliquidationMention: text("autoliquidation_mention"),
  // Onboarding state
  onboardingCompleted: boolean("onboarding_completed").default(false),
  onboardingStep: integer("onboarding_step").default(0),
  // Subscription
  plan: text("plan").default("free"), // free, pro, croissance, booster
  planStartDate: text("plan_start_date"),
  planEndDate: text("plan_end_date"),
  trialEndsAt: text("trial_ends_at"),
});
export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({ id: true });
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;

// ─── Contacts (Clients + Fournisseurs) ───────────────────────────
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // client, fournisseur
  category: text("category"), // particulier, professionnel
  firstName: text("first_name"),
  lastName: text("last_name"),
  company: text("company"),
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  siret: text("siret"),
  tvaIntracom: text("tva_intracom"),
  notes: text("notes"),
  tags: text("tags"), // JSON array
  totalQuoted: decimal("total_quoted").default("0"),
  totalBilled: decimal("total_billed").default("0"),
  totalPaid: decimal("total_paid").default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true });
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

// ─── Devis (Quotes) ──────────────────────────────────────────────
export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  chantierId: integer("chantier_id"),
  number: text("number").notNull(), // DEV-2026-001
  status: text("status").notNull(), // brouillon, envoyé, signé, refusé, expiré
  title: text("title"),
  description: text("description"),
  amountHT: decimal("amount_ht").default("0"),
  amountTVA: decimal("amount_tva").default("0"),
  amountTTC: decimal("amount_ttc").default("0"),
  discountPercent: decimal("discount_percent"),
  discountAmount: decimal("discount_amount"),
  validUntil: text("valid_until"),
  signedAt: text("signed_at"),
  signatureData: text("signature_data"),
  notes: text("notes"),
  conditions: text("conditions"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertQuoteSchema = createInsertSchema(quotes).omit({ id: true, createdAt: true });
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

// ─── Factures (Invoices) ─────────────────────────────────────────
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  chantierId: integer("chantier_id"),
  quoteId: integer("quote_id"),
  number: text("number").notNull(), // FAC-2026-001
  type: text("type").notNull(), // facture, avoir, acompte, situation, retenue_garantie
  status: text("status").notNull(), // brouillon, envoyée, payée, en_retard, annulée, partiellement_payée
  title: text("title"),
  amountHT: decimal("amount_ht").default("0"),
  amountTVA: decimal("amount_tva").default("0"),
  amountTTC: decimal("amount_ttc").default("0"),
  amountPaid: decimal("amount_paid").default("0"),
  paymentMethod: text("payment_method"),
  paymentDate: text("payment_date"),
  dueDate: text("due_date"),
  reminderCount: integer("reminder_count").default(0),
  lastReminderDate: text("last_reminder_date"),
  // Situation invoice fields
  situationNumber: integer("situation_number"),
  situationPercent: decimal("situation_percent"),
  // Retenue de garantie
  retenueGarantiePercent: decimal("retenue_garantie_percent"),
  retenueGarantieAmount: decimal("retenue_garantie_amount"),
  retenueGarantieDueDate: text("retenue_garantie_due_date"),
  // Prime énergie / CEE
  primeEnergieAmount: decimal("prime_energie_amount"),
  primeEnergieType: text("prime_energie_type"), // CEE, MaPrimeRenov, eco-PTZ
  // E-invoicing (Factur-X)
  facturXStatus: text("factur_x_status"),
  facturXFormat: text("factur_x_format"),
  notes: text("notes"),
  conditions: text("conditions"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true });
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

// ─── Document Lines (shared by quotes + invoices) ────────────────
export const documentLines = pgTable("document_lines", {
  id: serial("id").primaryKey(),
  documentType: text("document_type").notNull(), // quote, invoice
  documentId: integer("document_id").notNull(),
  libraryItemId: integer("library_item_id"),
  designation: text("designation").notNull(),
  description: text("description"),
  quantity: decimal("quantity").default("1"),
  unit: text("unit").default("u"), // u, m, m², m³, h, forfait, ens, kg, l
  unitPriceHT: decimal("unit_price_ht").default("0"),
  tvaRate: decimal("tva_rate").default("20"), // 20, 10, 5.5, 2.1, 0
  totalHT: decimal("total_ht").default("0"),
  sortOrder: integer("sort_order").default(0),
  isTitle: boolean("is_title").default(false), // for section headings
  isSubtotal: boolean("is_subtotal").default(false),
  lineType: text("line_type"), // fourniture, main_oeuvre, ouvrage, sous_traitance, materiel, divers
  purchasePriceHT: decimal("purchase_price_ht"),
  coefficient: decimal("coefficient"),
  marginPercent: decimal("margin_percent"),
});
export const insertDocumentLineSchema = createInsertSchema(documentLines).omit({ id: true });
export type DocumentLine = typeof documentLines.$inferSelect;
export type InsertDocumentLine = z.infer<typeof insertDocumentLineSchema>;

// ─── Chantiers (Job Sites / Projects) ────────────────────────────
export const chantiers = pgTable("chantiers", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  reference: text("reference").notNull(), // CH-2026-001
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull(), // prospect, planifié, en_cours, terminé, facturé, annulé
  priority: text("priority").default("normale"), // basse, normale, haute, urgente
  type: text("type"), // dépannage, rénovation, neuf, entretien, diagnostic
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  estimatedAmountHT: decimal("estimated_amount_ht").default("0"),
  actualAmountHT: decimal("actual_amount_ht").default("0"),
  costMaterials: decimal("cost_materials").default("0"),
  costLabor: decimal("cost_labor").default("0"),
  costSubcontractors: decimal("cost_subcontractors").default("0"),
  margin: decimal("margin"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  completionPercent: integer("completion_percent").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertChantierSchema = createInsertSchema(chantiers).omit({ id: true, createdAt: true });
export type Chantier = typeof chantiers.$inferSelect;
export type InsertChantier = z.infer<typeof insertChantierSchema>;

// ─── Ressources (Employés, Intérimaires, Sous-traitants, Matériels) ─
export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // employe, interimaire, sous_traitant, materiel
  name: text("name").notNull(),
  role: text("role"), // plombier, apprenti, chef d'équipe
  phone: text("phone"),
  email: text("email"),
  hourlyRate: decimal("hourly_rate"),
  dailyRate: decimal("daily_rate"),
  color: text("color"),
  status: text("status").notNull(), // actif, inactif, en_mission
  skills: text("skills"),
  certifications: text("certifications"),
  company: text("company"), // for sous-traitants
  siret: text("siret"), // for sous-traitants
  assuranceDecennale: text("assurance_decennale"),
  assuranceExpiry: text("assurance_expiry"),
  // For matériels
  category: text("category"), // véhicule, outillage, machine
  serialNumber: text("serial_number"),
  purchaseDate: text("purchase_date"),
  purchasePrice: decimal("purchase_price"),
  nextMaintenanceDate: text("next_maintenance_date"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertResourceSchema = createInsertSchema(resources).omit({ id: true, createdAt: true });
export type Resource = typeof resources.$inferSelect;
export type InsertResource = z.infer<typeof insertResourceSchema>;

// ─── Bibliothèque (Price Catalog / Library) ──────────────────────
export const libraryItems = pgTable("library_items", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // ouvrage, fourniture, main_oeuvre
  family: text("family"), // Plomberie, Chauffage, Sanitaire, etc.
  subFamily: text("sub_family"),
  reference: text("reference"),
  designation: text("designation").notNull(),
  description: text("description"),
  unit: text("unit").default("u"),
  purchasePriceHT: decimal("purchase_price_ht"),
  sellingPriceHT: decimal("selling_price_ht").default("0"),
  marginPercent: decimal("margin_percent"),
  tvaRate: decimal("tva_rate").default("20"),
  supplierId: integer("supplier_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertLibraryItemSchema = createInsertSchema(libraryItems).omit({ id: true, createdAt: true });
export type LibraryItem = typeof libraryItems.$inferSelect;
export type InsertLibraryItem = z.infer<typeof insertLibraryItemSchema>;

// ─── Achats (Purchases / Orders) ─────────────────────────────────
export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id").notNull(),
  chantierId: integer("chantier_id"),
  number: text("number").notNull(), // ACH-2026-001
  status: text("status").notNull(), // brouillon, commandé, reçu, partiellement_reçu, annulé
  amountHT: decimal("amount_ht").default("0"),
  amountTVA: decimal("amount_tva").default("0"),
  amountTTC: decimal("amount_ttc").default("0"),
  orderDate: text("order_date"),
  deliveryDate: text("delivery_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPurchaseSchema = createInsertSchema(purchases).omit({ id: true, createdAt: true });
export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;

// ─── Purchase Lines ──────────────────────────────────────────────
export const purchaseLines = pgTable("purchase_lines", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id").notNull(),
  libraryItemId: integer("library_item_id"),
  designation: text("designation").notNull(),
  quantity: decimal("quantity").default("1"),
  unit: text("unit").default("u"),
  unitPriceHT: decimal("unit_price_ht").default("0"),
  tvaRate: decimal("tva_rate").default("20"),
  totalHT: decimal("total_ht").default("0"),
  sortOrder: integer("sort_order").default(0),
});
export const insertPurchaseLineSchema = createInsertSchema(purchaseLines).omit({ id: true });
export type PurchaseLine = typeof purchaseLines.$inferSelect;
export type InsertPurchaseLine = z.infer<typeof insertPurchaseLineSchema>;

// ─── Bank Transactions ───────────────────────────────────────────
export const bankTransactions = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  label: text("label").notNull(),
  amount: decimal("amount").notNull(),
  type: text("type").notNull(), // credit, debit
  category: text("category"), // auto-categorized
  matchedInvoiceId: integer("matched_invoice_id"),
  matchedPurchaseId: integer("matched_purchase_id"),
  reconciled: boolean("reconciled").default(false),
  bankName: text("bank_name"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertBankTransactionSchema = createInsertSchema(bankTransactions).omit({ id: true, createdAt: true });
export type BankTransaction = typeof bankTransactions.$inferSelect;
export type InsertBankTransaction = z.infer<typeof insertBankTransactionSchema>;

// ─── Planning / Appointments ─────────────────────────────────────
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  chantierId: integer("chantier_id"),
  resourceId: integer("resource_id"),
  contactId: integer("contact_id"),
  title: text("title").notNull(),
  type: text("type").notNull(), // intervention, visite_technique, livraison, reunion, rdv_client
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  address: text("address"),
  city: text("city"),
  status: text("status").notNull(), // planifié, en_cours, terminé, annulé
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertAppointmentSchema = createInsertSchema(appointments).omit({ id: true, createdAt: true });
export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

// ─── Time Entries (Suivi du temps) ─────────────────────────────
export const timeEntries = pgTable("time_entries", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").notNull(),
  chantierId: integer("chantier_id"),
  appointmentId: integer("appointment_id"),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  duration: decimal("duration").notNull(), // in hours
  description: text("description"),
  type: text("type").notNull(), // intervention, deplacement, administratif, pause
  billable: boolean("billable").default(true),
  validated: boolean("validated").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertTimeEntrySchema = createInsertSchema(timeEntries).omit({ id: true, createdAt: true });
export type TimeEntry = typeof timeEntries.$inferSelect;
export type InsertTimeEntry = z.infer<typeof insertTimeEntrySchema>;

// ─── Documents (Pièces jointes / Documents digitalisés) ───────
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // devis, facture, chantier, contact, photo, attestation, autre
  category: text("category"), // technique, administratif, photo, plan
  relatedType: text("related_type"), // quote, invoice, chantier, contact
  relatedId: integer("related_id"),
  size: integer("size"), // bytes
  mimeType: text("mime_type"),
  url: text("url"), // simulated storage URL
  notes: text("notes"),
  uploadedBy: text("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

// ─── Payment Links (Paiements clients) ────────────────────────
export const paymentLinks = pgTable("payment_links", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull(),
  contactId: integer("contact_id").notNull(),
  amount: decimal("amount").notNull(),
  status: text("status").notNull(), // active, paid, expired, cancelled
  paymentMethod: text("payment_method"), // carte, virement, prélèvement
  linkUrl: text("link_url"),
  expiresAt: text("expires_at"),
  paidAt: text("paid_at"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPaymentLinkSchema = createInsertSchema(paymentLinks).omit({ id: true, createdAt: true });
export type PaymentLink = typeof paymentLinks.$inferSelect;
export type InsertPaymentLink = z.infer<typeof insertPaymentLinkSchema>;

// ─── Bank Accounts (Multi-comptes bancaires) ──────────────────
export const bankAccounts = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  bankName: text("bank_name").notNull(),
  accountName: text("account_name").notNull(),
  iban: text("iban"),
  bic: text("bic"),
  balance: decimal("balance").default("0"),
  currency: text("currency").default("EUR"),
  status: text("status").notNull(), // connected, disconnected, pending
  lastSyncAt: text("last_sync_at"),
  color: text("color"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({ id: true, createdAt: true });
export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;

// ─── Companies (Multi-sociétés) ───────────────────────────────
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  siret: text("siret"),
  legalForm: text("legal_form"),
  address: text("address"),
  city: text("city"),
  postalCode: text("postal_code"),
  isActive: boolean("is_active").default(true),
  isPrimary: boolean("is_primary").default(false),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

// ─── Supplier Marketplace Items ───────────────────────────────
export const marketplaceItems = pgTable("marketplace_items", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id"),
  supplierName: text("supplier_name").notNull(),
  category: text("category").notNull(), // sanitaire, chauffage, outillage, EPI, tuyauterie
  name: text("name").notNull(),
  description: text("description"),
  priceHT: decimal("price_ht"),
  unit: text("unit").default("u"),
  minQuantity: integer("min_quantity").default(1),
  deliveryDays: integer("delivery_days"),
  rating: decimal("rating"),
  imageUrl: text("image_url"),
  inStock: boolean("in_stock").default(true),
  promoPercent: decimal("promo_percent"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertMarketplaceItemSchema = createInsertSchema(marketplaceItems).omit({ id: true, createdAt: true });
export type MarketplaceItem = typeof marketplaceItems.$inferSelect;
export type InsertMarketplaceItem = z.infer<typeof insertMarketplaceItemSchema>;

// ─── API Keys (Intégrations) ─────────────────────────────────
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  key: text("key").notNull(),
  permissions: text("permissions"), // JSON array: ["read:quotes","write:invoices"]
  lastUsedAt: text("last_used_at"),
  expiresAt: text("expires_at"),
  status: text("status").notNull(), // active, revoked, expired
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertApiKeySchema = createInsertSchema(apiKeys).omit({ id: true, createdAt: true });
export type ApiKey = typeof apiKeys.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

// ─── Integration Settings (Gmail, WhatsApp) ──────────────────
export const integrationSettings = pgTable("integration_settings", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(), // gmail, whatsapp
  status: text("status").notNull(), // connected, disconnected, expired
  // Gmail OAuth
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: text("token_expiry"),
  gmailEmail: text("gmail_email"),
  // WhatsApp Business
  whatsappPhone: text("whatsapp_phone"),
  whatsappApiKey: text("whatsapp_api_key"),
  whatsappInstanceId: text("whatsapp_instance_id"),
  // General
  metadata: text("metadata"), // JSON for additional provider config
  connectedAt: text("connected_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertIntegrationSettingsSchema = createInsertSchema(integrationSettings).omit({ id: true, createdAt: true });
export type IntegrationSettings = typeof integrationSettings.$inferSelect;
export type InsertIntegrationSettings = z.infer<typeof insertIntegrationSettingsSchema>;

// ─── Webhooks ─────────────────────────────────────────────────
export const webhooks = pgTable("webhooks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  events: text("events").notNull(), // JSON array: ["invoice.created","quote.signed"]
  secret: text("secret"),
  status: text("status").notNull(), // active, paused, failed
  lastTriggeredAt: text("last_triggered_at"),
  failureCount: integer("failure_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertWebhookSchema = createInsertSchema(webhooks).omit({ id: true, createdAt: true });
export type Webhook = typeof webhooks.$inferSelect;
export type InsertWebhook = z.infer<typeof insertWebhookSchema>;

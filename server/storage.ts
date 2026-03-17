import type {
  CompanySettings, InsertCompanySettings,
  Contact, InsertContact,
  Quote, InsertQuote,
  Invoice, InsertInvoice,
  DocumentLine, InsertDocumentLine,
  Chantier, InsertChantier,
  Resource, InsertResource,
  LibraryItem, InsertLibraryItem,
  Purchase, InsertPurchase,
  PurchaseLine, InsertPurchaseLine,
  BankTransaction, InsertBankTransaction,
  Appointment, InsertAppointment,
  TimeEntry, InsertTimeEntry,
  Document, InsertDocument,
  PaymentLink, InsertPaymentLink,
  BankAccount, InsertBankAccount,
  Company, InsertCompany,
  MarketplaceItem, InsertMarketplaceItem,
  ApiKey, InsertApiKey,
  Webhook, InsertWebhook,
  IntegrationSettings, InsertIntegrationSettings,
} from "@shared/schema";

export interface IStorage {
  // Set current user context
  setUserId(userId: string): void;
  // Company
  getCompanySettings(): Promise<CompanySettings | undefined>;
  updateCompanySettings(data: Partial<InsertCompanySettings>): Promise<CompanySettings>;
  // Contacts
  getContacts(): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  createContact(data: InsertContact): Promise<Contact>;
  updateContact(id: number, data: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: number): Promise<void>;
  // Quotes
  getQuotes(): Promise<Quote[]>;
  getQuote(id: number): Promise<Quote | undefined>;
  createQuote(data: InsertQuote): Promise<Quote>;
  updateQuote(id: number, data: Partial<InsertQuote>): Promise<Quote>;
  deleteQuote(id: number): Promise<void>;
  // Invoices
  getInvoices(): Promise<Invoice[]>;
  getInvoice(id: number): Promise<Invoice | undefined>;
  createInvoice(data: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, data: Partial<InsertInvoice>): Promise<Invoice>;
  deleteInvoice(id: number): Promise<void>;
  // Document Lines
  getDocumentLines(documentType: string, documentId: number): Promise<DocumentLine[]>;
  createDocumentLine(data: InsertDocumentLine): Promise<DocumentLine>;
  deleteDocumentLines(documentType: string, documentId: number): Promise<void>;
  // Chantiers
  getChantiers(): Promise<Chantier[]>;
  getChantier(id: number): Promise<Chantier | undefined>;
  createChantier(data: InsertChantier): Promise<Chantier>;
  updateChantier(id: number, data: Partial<InsertChantier>): Promise<Chantier>;
  deleteChantier(id: number): Promise<void>;
  // Resources
  getResources(): Promise<Resource[]>;
  getResource(id: number): Promise<Resource | undefined>;
  createResource(data: InsertResource): Promise<Resource>;
  updateResource(id: number, data: Partial<InsertResource>): Promise<Resource>;
  deleteResource(id: number): Promise<void>;
  // Library
  getLibraryItems(): Promise<LibraryItem[]>;
  getLibraryItem(id: number): Promise<LibraryItem | undefined>;
  createLibraryItem(data: InsertLibraryItem): Promise<LibraryItem>;
  updateLibraryItem(id: number, data: Partial<InsertLibraryItem>): Promise<LibraryItem>;
  deleteLibraryItem(id: number): Promise<void>;
  // Purchases
  getPurchases(): Promise<Purchase[]>;
  getPurchase(id: number): Promise<Purchase | undefined>;
  createPurchase(data: InsertPurchase): Promise<Purchase>;
  updatePurchase(id: number, data: Partial<InsertPurchase>): Promise<Purchase>;
  deletePurchase(id: number): Promise<void>;
  // Purchase Lines
  getPurchaseLines(purchaseId: number): Promise<PurchaseLine[]>;
  createPurchaseLine(data: InsertPurchaseLine): Promise<PurchaseLine>;
  // Bank Transactions
  getBankTransactions(): Promise<BankTransaction[]>;
  createBankTransaction(data: InsertBankTransaction): Promise<BankTransaction>;
  updateBankTransaction(id: number, data: Partial<InsertBankTransaction>): Promise<BankTransaction>;
  // Appointments
  getAppointments(): Promise<Appointment[]>;
  createAppointment(data: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, data: Partial<InsertAppointment>): Promise<Appointment>;
  deleteAppointment(id: number): Promise<void>;
  // Time Entries
  getTimeEntries(): Promise<TimeEntry[]>;
  createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: number, data: Partial<InsertTimeEntry>): Promise<TimeEntry>;
  deleteTimeEntry(id: number): Promise<void>;
  // Documents
  getDocuments(): Promise<Document[]>;
  createDocument(data: InsertDocument): Promise<Document>;
  deleteDocument(id: number): Promise<void>;
  // Payment Links
  getPaymentLinks(): Promise<PaymentLink[]>;
  createPaymentLink(data: InsertPaymentLink): Promise<PaymentLink>;
  updatePaymentLink(id: number, data: Partial<InsertPaymentLink>): Promise<PaymentLink>;
  // Bank Accounts
  getBankAccounts(): Promise<BankAccount[]>;
  createBankAccount(data: InsertBankAccount): Promise<BankAccount>;
  updateBankAccount(id: number, data: Partial<InsertBankAccount>): Promise<BankAccount>;
  deleteBankAccount(id: number): Promise<void>;
  // Companies
  getCompanies(): Promise<Company[]>;
  createCompany(data: InsertCompany): Promise<Company>;
  updateCompany(id: number, data: Partial<InsertCompany>): Promise<Company>;
  deleteCompany(id: number): Promise<void>;
  // Marketplace
  getMarketplaceItems(): Promise<MarketplaceItem[]>;
  createMarketplaceItem(data: InsertMarketplaceItem): Promise<MarketplaceItem>;
  // API Keys
  getApiKeys(): Promise<ApiKey[]>;
  createApiKey(data: InsertApiKey): Promise<ApiKey>;
  updateApiKey(id: number, data: Partial<InsertApiKey>): Promise<ApiKey>;
  deleteApiKey(id: number): Promise<void>;
  // Webhooks
  getWebhooks(): Promise<Webhook[]>;
  createWebhook(data: InsertWebhook): Promise<Webhook>;
  updateWebhook(id: number, data: Partial<InsertWebhook>): Promise<Webhook>;
  deleteWebhook(id: number): Promise<void>;
  // Integration Settings
  getIntegrations(): Promise<IntegrationSettings[]>;
  getIntegration(provider: string): Promise<IntegrationSettings | undefined>;
  upsertIntegration(provider: string, data: Record<string, any>): Promise<IntegrationSettings>;
  deleteIntegration(provider: string): Promise<void>;
}

// ─── Utility: camelCase <-> snake_case ────────────────────────
function toSnakeCase(str: string): string {
  // Handle consecutive uppercase letters (abbreviations like HT, TTC, TVA)
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

function toCamelCase(str: string): string {
  const result = str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  // Fix known abbreviations that should be uppercase
  // Only match at end of string (e.g. amountHt -> amountHT, not tvaRate -> TVARate)
  return result
    .replace(/Ht$/g, 'HT')
    .replace(/Ttc$/g, 'TTC')
    .replace(/Tva$/g, 'TVA');
}

function keysToSnake(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toSnakeCase(key)] = value;
  }
  return result;
}

function keysToCamel(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toCamelCase(key)] = value;
  }
  return result;
}

function rowToCamel<T>(row: any): T {
  if (!row) return row;
  return keysToCamel(row) as T;
}

function rowsToCamel<T>(rows: any[]): T[] {
  return rows.map(r => rowToCamel<T>(r));
}

// ─── Supabase Storage Implementation ─────────────────────────
import { supabaseAdmin } from "./supabaseClient";

export class SupabaseStorage implements IStorage {
  private userId: string = "";

  setUserId(userId: string): void {
    this.userId = userId;
  }

  private ensureUserId(): string {
    if (!this.userId) throw new Error("User ID not set — must authenticate first");
    return this.userId;
  }

  // ─── Generic CRUD helpers ────────────────────────────────
  private async getAll<T>(table: string): Promise<T[]> {
    const uid = this.ensureUserId();
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .eq("user_id", uid)
      .order("id", { ascending: true });
    if (error) throw new Error(`Supabase error (${table}): ${error.message}`);
    return rowsToCamel<T>(data || []);
  }

  private async getOne<T>(table: string, id: number): Promise<T | undefined> {
    const uid = this.ensureUserId();
    const { data, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .eq("id", id)
      .eq("user_id", uid)
      .maybeSingle();
    if (error) throw new Error(`Supabase error (${table}): ${error.message}`);
    return data ? rowToCamel<T>(data) : undefined;
  }

  private async insertOne<T>(table: string, data: Record<string, any>): Promise<T> {
    const uid = this.ensureUserId();
    const snakeData = keysToSnake(data);
    snakeData.user_id = uid;
    // Remove undefined/null keys
    for (const key of Object.keys(snakeData)) {
      if (snakeData[key] === undefined) delete snakeData[key];
    }
    const { data: row, error } = await supabaseAdmin
      .from(table)
      .insert(snakeData)
      .select()
      .single();
    if (error) throw new Error(`Supabase insert error (${table}): ${error.message}`);
    return rowToCamel<T>(row);
  }

  private async updateOne<T>(table: string, id: number, data: Record<string, any>): Promise<T> {
    const uid = this.ensureUserId();
    const snakeData = keysToSnake(data);
    // Remove undefined keys, keep nulls
    for (const key of Object.keys(snakeData)) {
      if (snakeData[key] === undefined) delete snakeData[key];
    }
    const { data: row, error } = await supabaseAdmin
      .from(table)
      .update(snakeData)
      .eq("id", id)
      .eq("user_id", uid)
      .select()
      .single();
    if (error) throw new Error(`Supabase update error (${table}): ${error.message}`);
    return rowToCamel<T>(row);
  }

  private async deleteOne(table: string, id: number): Promise<void> {
    const uid = this.ensureUserId();
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq("id", id)
      .eq("user_id", uid);
    if (error) throw new Error(`Supabase delete error (${table}): ${error.message}`);
  }

  // ─── Company Settings ────────────────────────────────────
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const uid = this.ensureUserId();
    const { data, error } = await supabaseAdmin
      .from("company_settings")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return data ? rowToCamel<CompanySettings>(data) : undefined;
  }

  async updateCompanySettings(data: Partial<InsertCompanySettings>): Promise<CompanySettings> {
    const uid = this.ensureUserId();
    const existing = await this.getCompanySettings();
    const snakeData = keysToSnake(data as Record<string, any>);
    snakeData.user_id = uid;
    for (const key of Object.keys(snakeData)) {
      if (snakeData[key] === undefined) delete snakeData[key];
    }

    if (existing) {
      const { data: row, error } = await supabaseAdmin
        .from("company_settings")
        .update(snakeData)
        .eq("id", existing.id)
        .eq("user_id", uid)
        .select()
        .single();
      if (error) throw new Error(`Supabase update error: ${error.message}`);
      return rowToCamel<CompanySettings>(row);
    } else {
      if (!snakeData.name) snakeData.name = "";
      const { data: row, error } = await supabaseAdmin
        .from("company_settings")
        .insert(snakeData)
        .select()
        .single();
      if (error) throw new Error(`Supabase insert error: ${error.message}`);
      return rowToCamel<CompanySettings>(row);
    }
  }

  // ─── Contacts ────────────────────────────────────────────
  async getContacts(): Promise<Contact[]> { return this.getAll<Contact>("contacts"); }
  async getContact(id: number): Promise<Contact | undefined> { return this.getOne<Contact>("contacts", id); }
  async createContact(data: InsertContact): Promise<Contact> { return this.insertOne<Contact>("contacts", data as any); }
  async updateContact(id: number, data: Partial<InsertContact>): Promise<Contact> { return this.updateOne<Contact>("contacts", id, data as any); }
  async deleteContact(id: number): Promise<void> { return this.deleteOne("contacts", id); }

  // ─── Quotes ──────────────────────────────────────────────
  async getQuotes(): Promise<Quote[]> { return this.getAll<Quote>("quotes"); }
  async getQuote(id: number): Promise<Quote | undefined> { return this.getOne<Quote>("quotes", id); }
  async createQuote(data: InsertQuote): Promise<Quote> { return this.insertOne<Quote>("quotes", data as any); }
  async updateQuote(id: number, data: Partial<InsertQuote>): Promise<Quote> { return this.updateOne<Quote>("quotes", id, data as any); }
  async deleteQuote(id: number): Promise<void> { return this.deleteOne("quotes", id); }

  // ─── Invoices ────────────────────────────────────────────
  async getInvoices(): Promise<Invoice[]> { return this.getAll<Invoice>("invoices"); }
  async getInvoice(id: number): Promise<Invoice | undefined> { return this.getOne<Invoice>("invoices", id); }
  async createInvoice(data: InsertInvoice): Promise<Invoice> { return this.insertOne<Invoice>("invoices", data as any); }
  async updateInvoice(id: number, data: Partial<InsertInvoice>): Promise<Invoice> { return this.updateOne<Invoice>("invoices", id, data as any); }
  async deleteInvoice(id: number): Promise<void> { return this.deleteOne("invoices", id); }

  // ─── Document Lines ──────────────────────────────────────
  async getDocumentLines(documentType: string, documentId: number): Promise<DocumentLine[]> {
    const uid = this.ensureUserId();
    const { data, error } = await supabaseAdmin
      .from("document_lines")
      .select("*")
      .eq("user_id", uid)
      .eq("document_type", documentType)
      .eq("document_id", documentId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return rowsToCamel<DocumentLine>(data || []);
  }

  async createDocumentLine(data: InsertDocumentLine): Promise<DocumentLine> {
    return this.insertOne<DocumentLine>("document_lines", data as any);
  }

  async deleteDocumentLines(documentType: string, documentId: number): Promise<void> {
    const uid = this.ensureUserId();
    const { error } = await supabaseAdmin
      .from("document_lines")
      .delete()
      .eq("user_id", uid)
      .eq("document_type", documentType)
      .eq("document_id", documentId);
    if (error) throw new Error(`Supabase delete error: ${error.message}`);
  }

  // ─── Chantiers ───────────────────────────────────────────
  async getChantiers(): Promise<Chantier[]> { return this.getAll<Chantier>("chantiers"); }
  async getChantier(id: number): Promise<Chantier | undefined> { return this.getOne<Chantier>("chantiers", id); }
  async createChantier(data: InsertChantier): Promise<Chantier> { return this.insertOne<Chantier>("chantiers", data as any); }
  async updateChantier(id: number, data: Partial<InsertChantier>): Promise<Chantier> { return this.updateOne<Chantier>("chantiers", id, data as any); }
  async deleteChantier(id: number): Promise<void> { return this.deleteOne("chantiers", id); }

  // ─── Resources ───────────────────────────────────────────
  async getResources(): Promise<Resource[]> { return this.getAll<Resource>("resources"); }
  async getResource(id: number): Promise<Resource | undefined> { return this.getOne<Resource>("resources", id); }
  async createResource(data: InsertResource): Promise<Resource> { return this.insertOne<Resource>("resources", data as any); }
  async updateResource(id: number, data: Partial<InsertResource>): Promise<Resource> { return this.updateOne<Resource>("resources", id, data as any); }
  async deleteResource(id: number): Promise<void> { return this.deleteOne("resources", id); }

  // ─── Library ─────────────────────────────────────────────
  async getLibraryItems(): Promise<LibraryItem[]> { return this.getAll<LibraryItem>("library_items"); }
  async getLibraryItem(id: number): Promise<LibraryItem | undefined> { return this.getOne<LibraryItem>("library_items", id); }
  async createLibraryItem(data: InsertLibraryItem): Promise<LibraryItem> { return this.insertOne<LibraryItem>("library_items", data as any); }
  async updateLibraryItem(id: number, data: Partial<InsertLibraryItem>): Promise<LibraryItem> { return this.updateOne<LibraryItem>("library_items", id, data as any); }
  async deleteLibraryItem(id: number): Promise<void> { return this.deleteOne("library_items", id); }

  // ─── Purchases ───────────────────────────────────────────
  async getPurchases(): Promise<Purchase[]> { return this.getAll<Purchase>("purchases"); }
  async getPurchase(id: number): Promise<Purchase | undefined> { return this.getOne<Purchase>("purchases", id); }
  async createPurchase(data: InsertPurchase): Promise<Purchase> { return this.insertOne<Purchase>("purchases", data as any); }
  async updatePurchase(id: number, data: Partial<InsertPurchase>): Promise<Purchase> { return this.updateOne<Purchase>("purchases", id, data as any); }
  async deletePurchase(id: number): Promise<void> { return this.deleteOne("purchases", id); }

  // ─── Purchase Lines ──────────────────────────────────────
  async getPurchaseLines(purchaseId: number): Promise<PurchaseLine[]> {
    const uid = this.ensureUserId();
    const { data, error } = await supabaseAdmin
      .from("purchase_lines")
      .select("*")
      .eq("user_id", uid)
      .eq("purchase_id", purchaseId)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return rowsToCamel<PurchaseLine>(data || []);
  }
  async createPurchaseLine(data: InsertPurchaseLine): Promise<PurchaseLine> {
    return this.insertOne<PurchaseLine>("purchase_lines", data as any);
  }

  // ─── Bank Transactions ───────────────────────────────────
  async getBankTransactions(): Promise<BankTransaction[]> { return this.getAll<BankTransaction>("bank_transactions"); }
  async createBankTransaction(data: InsertBankTransaction): Promise<BankTransaction> { return this.insertOne<BankTransaction>("bank_transactions", data as any); }
  async updateBankTransaction(id: number, data: Partial<InsertBankTransaction>): Promise<BankTransaction> { return this.updateOne<BankTransaction>("bank_transactions", id, data as any); }

  // ─── Appointments ────────────────────────────────────────
  async getAppointments(): Promise<Appointment[]> { return this.getAll<Appointment>("appointments"); }
  async createAppointment(data: InsertAppointment): Promise<Appointment> { return this.insertOne<Appointment>("appointments", data as any); }
  async updateAppointment(id: number, data: Partial<InsertAppointment>): Promise<Appointment> { return this.updateOne<Appointment>("appointments", id, data as any); }
  async deleteAppointment(id: number): Promise<void> { return this.deleteOne("appointments", id); }

  // ─── Time Entries ────────────────────────────────────────
  async getTimeEntries(): Promise<TimeEntry[]> { return this.getAll<TimeEntry>("time_entries"); }
  async createTimeEntry(data: InsertTimeEntry): Promise<TimeEntry> { return this.insertOne<TimeEntry>("time_entries", data as any); }
  async updateTimeEntry(id: number, data: Partial<InsertTimeEntry>): Promise<TimeEntry> { return this.updateOne<TimeEntry>("time_entries", id, data as any); }
  async deleteTimeEntry(id: number): Promise<void> { return this.deleteOne("time_entries", id); }

  // ─── Documents ───────────────────────────────────────────
  async getDocuments(): Promise<Document[]> { return this.getAll<Document>("documents"); }
  async createDocument(data: InsertDocument): Promise<Document> { return this.insertOne<Document>("documents", data as any); }
  async deleteDocument(id: number): Promise<void> { return this.deleteOne("documents", id); }

  // ─── Payment Links ───────────────────────────────────────
  async getPaymentLinks(): Promise<PaymentLink[]> { return this.getAll<PaymentLink>("payment_links"); }
  async createPaymentLink(data: InsertPaymentLink): Promise<PaymentLink> { return this.insertOne<PaymentLink>("payment_links", data as any); }
  async updatePaymentLink(id: number, data: Partial<InsertPaymentLink>): Promise<PaymentLink> { return this.updateOne<PaymentLink>("payment_links", id, data as any); }

  // ─── Bank Accounts ───────────────────────────────────────
  async getBankAccounts(): Promise<BankAccount[]> { return this.getAll<BankAccount>("bank_accounts"); }
  async createBankAccount(data: InsertBankAccount): Promise<BankAccount> { return this.insertOne<BankAccount>("bank_accounts", data as any); }
  async updateBankAccount(id: number, data: Partial<InsertBankAccount>): Promise<BankAccount> { return this.updateOne<BankAccount>("bank_accounts", id, data as any); }
  async deleteBankAccount(id: number): Promise<void> { return this.deleteOne("bank_accounts", id); }

  // ─── Companies ───────────────────────────────────────────
  async getCompanies(): Promise<Company[]> { return this.getAll<Company>("companies"); }
  async createCompany(data: InsertCompany): Promise<Company> { return this.insertOne<Company>("companies", data as any); }
  async updateCompany(id: number, data: Partial<InsertCompany>): Promise<Company> { return this.updateOne<Company>("companies", id, data as any); }
  async deleteCompany(id: number): Promise<void> { return this.deleteOne("companies", id); }

  // ─── Marketplace ─────────────────────────────────────────
  async getMarketplaceItems(): Promise<MarketplaceItem[]> {
    // Marketplace items are global (system items + user's own)
    const { data, error } = await supabaseAdmin
      .from("marketplace_items")
      .select("*")
      .order("id", { ascending: true });
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return rowsToCamel<MarketplaceItem>(data || []);
  }
  async createMarketplaceItem(data: InsertMarketplaceItem): Promise<MarketplaceItem> { return this.insertOne<MarketplaceItem>("marketplace_items", data as any); }

  // ─── API Keys ────────────────────────────────────────────
  async getApiKeys(): Promise<ApiKey[]> { return this.getAll<ApiKey>("api_keys"); }
  async createApiKey(data: InsertApiKey): Promise<ApiKey> { return this.insertOne<ApiKey>("api_keys", data as any); }
  async updateApiKey(id: number, data: Partial<InsertApiKey>): Promise<ApiKey> { return this.updateOne<ApiKey>("api_keys", id, data as any); }
  async deleteApiKey(id: number): Promise<void> { return this.deleteOne("api_keys", id); }

  // ─── Webhooks ────────────────────────────────────────────
  async getWebhooks(): Promise<Webhook[]> { return this.getAll<Webhook>("webhooks"); }
  async createWebhook(data: InsertWebhook): Promise<Webhook> { return this.insertOne<Webhook>("webhooks", data as any); }
  async updateWebhook(id: number, data: Partial<InsertWebhook>): Promise<Webhook> { return this.updateOne<Webhook>("webhooks", id, data as any); }
  async deleteWebhook(id: number): Promise<void> { return this.deleteOne("webhooks", id); }

  // ─── Integration Settings (Gmail, WhatsApp) ─────────────
  async getIntegrations(): Promise<IntegrationSettings[]> {
    try {
      const uid = this.ensureUserId();
      const { data, error } = await supabaseAdmin
        .from("integration_settings")
        .select("*")
        .eq("user_id", uid);
      if (error) throw error;
      return rowsToCamel<IntegrationSettings>(data || []);
    } catch {
      return [];
    }
  }

  async getIntegration(provider: string): Promise<IntegrationSettings | undefined> {
    try {
      const uid = this.ensureUserId();
      const { data, error } = await supabaseAdmin
        .from("integration_settings")
        .select("*")
        .eq("user_id", uid)
        .eq("provider", provider)
        .maybeSingle();
      if (error) throw error;
      return data ? rowToCamel<IntegrationSettings>(data) : undefined;
    } catch {
      return undefined;
    }
  }

  async upsertIntegration(provider: string, data: Record<string, any>): Promise<IntegrationSettings> {
    const uid = this.ensureUserId();
    const snakeData = keysToSnake(data);
    snakeData.user_id = uid;
    snakeData.provider = provider;
    for (const key of Object.keys(snakeData)) {
      if (snakeData[key] === undefined) delete snakeData[key];
    }

    // Check if exists
    const existing = await this.getIntegration(provider);
    if (existing) {
      const { data: row, error } = await supabaseAdmin
        .from("integration_settings")
        .update(snakeData)
        .eq("user_id", uid)
        .eq("provider", provider)
        .select()
        .single();
      if (error) throw new Error(`Integration update error: ${error.message}`);
      return rowToCamel<IntegrationSettings>(row);
    } else {
      const { data: row, error } = await supabaseAdmin
        .from("integration_settings")
        .insert(snakeData)
        .select()
        .single();
      if (error) throw new Error(`Integration insert error: ${error.message}`);
      return rowToCamel<IntegrationSettings>(row);
    }
  }

  async deleteIntegration(provider: string): Promise<void> {
    const uid = this.ensureUserId();
    await supabaseAdmin
      .from("integration_settings")
      .delete()
      .eq("user_id", uid)
      .eq("provider", provider);
  }
}

export const storage: IStorage = new SupabaseStorage();

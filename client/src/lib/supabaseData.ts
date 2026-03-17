// Supabase direct data access layer — replaces all Express /api/* calls
import { supabase } from './supabase';
import type {
  CompanySettings, Contact, Quote, Invoice, DocumentLine,
  Chantier, Resource, LibraryItem, Purchase, PurchaseLine,
  BankTransaction, BankAccount, Appointment, TimeEntry,
  Document as DocType, PaymentLink, MarketplaceItem, ApiKey,
  IntegrationSettings, Webhook,
} from '@shared/schema';

// ── Generic helpers ──────────────────────────────────────────────
async function getAll<T>(table: string, orderBy = 'id'): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').order(orderBy);
  if (error) throw error;
  return (data ?? []) as T[];
}

async function getOne<T>(table: string, id: number): Promise<T> {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error) throw error;
  return data as T;
}

async function insertOne<T>(table: string, values: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from(table).insert(values).select().single();
  if (error) throw error;
  return data as T;
}

async function updateOne<T>(table: string, id: number, values: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.from(table).update(values).eq('id', id).select().single();
  if (error) throw error;
  return data as T;
}

async function deleteOne(table: string, id: number): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

// ── Company Settings ─────────────────────────────────────────────
async function getCompanySettings(): Promise<CompanySettings | null> {
  const { data, error } = await supabase.from('company_settings').select('*').limit(1).single();
  if (error && error.code === 'PGRST116') return null; // no rows
  if (error) throw error;
  return data as CompanySettings;
}

async function updateCompanySettings(values: Partial<CompanySettings>): Promise<CompanySettings> {
  // Upsert: if exists update, else insert
  const existing = await getCompanySettings();
  if (existing) {
    return updateOne<CompanySettings>('company_settings', existing.id, values);
  }
  return insertOne<CompanySettings>('company_settings', values as Record<string, unknown>);
}

// ── Contacts ─────────────────────────────────────────────────────
const getContacts = () => getAll<Contact>('contacts', 'created_at');
const getContact = (id: number) => getOne<Contact>('contacts', id);
const createContact = (v: Record<string, unknown>) => insertOne<Contact>('contacts', v);
const updateContact = (id: number, v: Record<string, unknown>) => updateOne<Contact>('contacts', id, v);
const deleteContact = (id: number) => deleteOne('contacts', id);

// ── Quotes ───────────────────────────────────────────────────────
const getQuotes = () => getAll<Quote>('quotes', 'created_at');
const getQuote = (id: number) => getOne<Quote>('quotes', id);
const createQuote = (v: Record<string, unknown>) => insertOne<Quote>('quotes', v);
const updateQuote = (id: number, v: Record<string, unknown>) => updateOne<Quote>('quotes', id, v);
const deleteQuote = (id: number) => deleteOne('quotes', id);

async function duplicateQuote(id: number): Promise<Quote> {
  const original = await getQuote(id);
  const { id: _id, created_at: _ca, ...rest } = original as Record<string, unknown>;
  const newQuote = await createQuote({
    ...rest,
    number: `DEV-${Date.now().toString(36).toUpperCase()}`,
    status: 'brouillon',
    title: `${original.title || ''} (copie)`,
  });
  // Copy lines
  const lines = await getDocumentLines('quote', id);
  for (const line of lines) {
    const { id: _lid, ...lineRest } = line as Record<string, unknown>;
    await insertOne('document_lines', { ...lineRest, document_id: newQuote.id });
  }
  return newQuote;
}

// ── Invoices ─────────────────────────────────────────────────────
const getInvoices = () => getAll<Invoice>('invoices', 'created_at');
const getInvoice = (id: number) => getOne<Invoice>('invoices', id);
const createInvoice = (v: Record<string, unknown>) => insertOne<Invoice>('invoices', v);
const updateInvoice = (id: number, v: Record<string, unknown>) => updateOne<Invoice>('invoices', id, v);
const deleteInvoice = (id: number) => deleteOne('invoices', id);

async function createInvoiceFromQuote(quoteId: number): Promise<Invoice> {
  const quote = await getQuote(quoteId);
  const invoice = await createInvoice({
    contact_id: quote.contact_id,
    chantier_id: quote.chantier_id,
    quote_id: quoteId,
    number: `FAC-${Date.now().toString(36).toUpperCase()}`,
    type: 'facture',
    status: 'brouillon',
    title: quote.title,
    amount_ht: quote.amount_ht,
    amount_tva: quote.amount_tva,
    amount_ttc: quote.amount_ttc,
    notes: quote.notes,
    conditions: quote.conditions,
  });
  // Copy lines
  const lines = await getDocumentLines('quote', quoteId);
  for (const line of lines) {
    const { id: _lid, ...lineRest } = line as Record<string, unknown>;
    await insertOne('document_lines', {
      ...lineRest,
      document_type: 'invoice',
      document_id: invoice.id,
    });
  }
  // Mark quote as signed
  await updateQuote(quoteId, { status: 'signé' });
  return invoice;
}

async function duplicateInvoice(id: number): Promise<Invoice> {
  const original = await getInvoice(id);
  const { id: _id, created_at: _ca, ...rest } = original as Record<string, unknown>;
  const newInvoice = await createInvoice({
    ...rest,
    number: `FAC-${Date.now().toString(36).toUpperCase()}`,
    status: 'brouillon',
    title: `${original.title || ''} (copie)`,
    amount_paid: '0',
  });
  // Copy lines
  const lines = await getDocumentLines('invoice', id);
  for (const line of lines) {
    const { id: _lid, ...lineRest } = line as Record<string, unknown>;
    await insertOne('document_lines', { ...lineRest, document_id: newInvoice.id });
  }
  return newInvoice;
}

// ── Document Lines ───────────────────────────────────────────────
async function getDocumentLines(documentType: string, documentId: number): Promise<DocumentLine[]> {
  const { data, error } = await supabase
    .from('document_lines')
    .select('*')
    .eq('document_type', documentType)
    .eq('document_id', documentId)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as DocumentLine[];
}

const createDocumentLine = (v: Record<string, unknown>) => insertOne<DocumentLine>('document_lines', v);
const updateDocumentLine = (id: number, v: Record<string, unknown>) => updateOne<DocumentLine>('document_lines', id, v);
const deleteDocumentLine = (id: number) => deleteOne('document_lines', id);

async function deleteDocumentLinesByDocument(documentType: string, documentId: number): Promise<void> {
  const { error } = await supabase
    .from('document_lines')
    .delete()
    .eq('document_type', documentType)
    .eq('document_id', documentId);
  if (error) throw error;
}

async function bulkSaveDocumentLines(documentType: string, documentId: number, lines: Record<string, unknown>[]): Promise<DocumentLine[]> {
  // Delete existing, then insert new batch
  await deleteDocumentLinesByDocument(documentType, documentId);
  if (lines.length === 0) return [];
  const withContext = lines.map((l, i) => ({
    ...l,
    document_type: documentType,
    document_id: documentId,
    sort_order: i,
  }));
  const { data, error } = await supabase.from('document_lines').insert(withContext).select();
  if (error) throw error;
  return (data ?? []) as DocumentLine[];
}

// ── Chantiers ────────────────────────────────────────────────────
const getChantiers = () => getAll<Chantier>('chantiers', 'created_at');
const getChantier = (id: number) => getOne<Chantier>('chantiers', id);
const createChantier = (v: Record<string, unknown>) => insertOne<Chantier>('chantiers', v);
const updateChantier = (id: number, v: Record<string, unknown>) => updateOne<Chantier>('chantiers', id, v);
const deleteChantier = (id: number) => deleteOne('chantiers', id);

// ── Resources ────────────────────────────────────────────────────
const getResources = () => getAll<Resource>('resources', 'created_at');
const getResource = (id: number) => getOne<Resource>('resources', id);
const createResource = (v: Record<string, unknown>) => insertOne<Resource>('resources', v);
const updateResource = (id: number, v: Record<string, unknown>) => updateOne<Resource>('resources', id, v);
const deleteResource = (id: number) => deleteOne('resources', id);

// ── Library Items ────────────────────────────────────────────────
const getLibraryItems = () => getAll<LibraryItem>('library_items', 'created_at');
const getLibraryItem = (id: number) => getOne<LibraryItem>('library_items', id);
const createLibraryItem = (v: Record<string, unknown>) => insertOne<LibraryItem>('library_items', v);
const updateLibraryItem = (id: number, v: Record<string, unknown>) => updateOne<LibraryItem>('library_items', id, v);
const deleteLibraryItem = (id: number) => deleteOne('library_items', id);

// ── Purchases ────────────────────────────────────────────────────
const getPurchases = () => getAll<Purchase>('purchases', 'created_at');
const getPurchase = (id: number) => getOne<Purchase>('purchases', id);
const createPurchase = (v: Record<string, unknown>) => insertOne<Purchase>('purchases', v);
const updatePurchase = (id: number, v: Record<string, unknown>) => updateOne<Purchase>('purchases', id, v);
const deletePurchase = (id: number) => deleteOne('purchases', id);

// ── Purchase Lines ───────────────────────────────────────────────
async function getPurchaseLines(purchaseId: number): Promise<PurchaseLine[]> {
  const { data, error } = await supabase
    .from('purchase_lines')
    .select('*')
    .eq('purchase_id', purchaseId)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as PurchaseLine[];
}

const createPurchaseLine = (v: Record<string, unknown>) => insertOne<PurchaseLine>('purchase_lines', v);
const updatePurchaseLine = (id: number, v: Record<string, unknown>) => updateOne<PurchaseLine>('purchase_lines', id, v);
const deletePurchaseLine = (id: number) => deleteOne('purchase_lines', id);

// ── Bank Transactions ────────────────────────────────────────────
const getBankTransactions = () => getAll<BankTransaction>('bank_transactions', 'date');
const createBankTransaction = (v: Record<string, unknown>) => insertOne<BankTransaction>('bank_transactions', v);
const updateBankTransaction = (id: number, v: Record<string, unknown>) => updateOne<BankTransaction>('bank_transactions', id, v);
const deleteBankTransaction = (id: number) => deleteOne('bank_transactions', id);

// ── Bank Accounts ────────────────────────────────────────────────
const getBankAccounts = () => getAll<BankAccount>('bank_accounts', 'created_at');
const createBankAccount = (v: Record<string, unknown>) => insertOne<BankAccount>('bank_accounts', v);
const updateBankAccount = (id: number, v: Record<string, unknown>) => updateOne<BankAccount>('bank_accounts', id, v);
const deleteBankAccount = (id: number) => deleteOne('bank_accounts', id);

// ── Appointments / Planning ──────────────────────────────────────
const getAppointments = () => getAll<Appointment>('appointments', 'date');
const createAppointment = (v: Record<string, unknown>) => insertOne<Appointment>('appointments', v);
const updateAppointment = (id: number, v: Record<string, unknown>) => updateOne<Appointment>('appointments', id, v);
const deleteAppointment = (id: number) => deleteOne('appointments', id);

// ── Time Entries ─────────────────────────────────────────────────
const getTimeEntries = () => getAll<TimeEntry>('time_entries', 'date');
const createTimeEntry = (v: Record<string, unknown>) => insertOne<TimeEntry>('time_entries', v);
const updateTimeEntry = (id: number, v: Record<string, unknown>) => updateOne<TimeEntry>('time_entries', id, v);
const deleteTimeEntry = (id: number) => deleteOne('time_entries', id);

// ── Documents ────────────────────────────────────────────────────
const getDocuments = () => getAll<DocType>('documents', 'created_at');
const createDocument = (v: Record<string, unknown>) => insertOne<DocType>('documents', v);
const updateDocument = (id: number, v: Record<string, unknown>) => updateOne<DocType>('documents', id, v);
const deleteDocument = (id: number) => deleteOne('documents', id);

// ── Payment Links ────────────────────────────────────────────────
const getPaymentLinks = () => getAll<PaymentLink>('payment_links', 'created_at');

async function getPaymentLinksForInvoice(invoiceId: number): Promise<PaymentLink[]> {
  const { data, error } = await supabase
    .from('payment_links')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as PaymentLink[];
}

const createPaymentLink = (v: Record<string, unknown>) => insertOne<PaymentLink>('payment_links', v);

// ── Marketplace ──────────────────────────────────────────────────
const getMarketplaceItems = () => getAll<MarketplaceItem>('marketplace_items', 'created_at');

// ── API Keys ─────────────────────────────────────────────────────
const getApiKeys = () => getAll<ApiKey>('api_keys', 'created_at');
const createApiKey = (v: Record<string, unknown>) => insertOne<ApiKey>('api_keys', v);
const updateApiKey = (id: number, v: Record<string, unknown>) => updateOne<ApiKey>('api_keys', id, v);
const deleteApiKey = (id: number) => deleteOne('api_keys', id);

// ── Integration Settings ─────────────────────────────────────────
async function getIntegrationSettings(): Promise<IntegrationSettings[]> {
  return getAll<IntegrationSettings>('integration_settings', 'created_at');
}

const createIntegrationSetting = (v: Record<string, unknown>) => insertOne<IntegrationSettings>('integration_settings', v);
const updateIntegrationSetting = (id: number, v: Record<string, unknown>) => updateOne<IntegrationSettings>('integration_settings', id, v);
const deleteIntegrationSetting = (id: number) => deleteOne('integration_settings', id);

// ── Webhooks ─────────────────────────────────────────────────────
const getWebhooks = () => getAll<Webhook>('webhooks', 'created_at');
const createWebhook = (v: Record<string, unknown>) => insertOne<Webhook>('webhooks', v);
const updateWebhook = (id: number, v: Record<string, unknown>) => updateOne<Webhook>('webhooks', id, v);
const deleteWebhook = (id: number) => deleteOne('webhooks', id);

// ── Import helpers ───────────────────────────────────────────────
async function importContacts(rows: Record<string, unknown>[]): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      await insertOne('contacts', rows[i]);
      imported++;
    } catch (e: any) {
      errors.push(`Ligne ${i + 1}: ${e.message || 'Erreur inconnue'}`);
    }
  }
  return { imported, skipped: rows.length - imported - errors.length, errors };
}

async function importArticles(rows: Record<string, unknown>[]): Promise<{ imported: number; skipped: number; errors: string[] }> {
  let imported = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      await insertOne('library_items', rows[i]);
      imported++;
    } catch (e: any) {
      errors.push(`Ligne ${i + 1}: ${e.message || 'Erreur inconnue'}`);
    }
  }
  return { imported, skipped: rows.length - imported - errors.length, errors };
}

// ── FEC Export ────────────────────────────────────────────────────
async function getFECData(year: string): Promise<string> {
  // Fetch invoices for the given year and generate FEC-format CSV client-side
  const { data: invs, error } = await supabase
    .from('invoices')
    .select('*')
    .gte('created_at', `${year}-01-01`)
    .lte('created_at', `${year}-12-31T23:59:59`)
    .order('created_at');
  if (error) throw error;
  const invoicesList = (invs ?? []) as Invoice[];

  // FEC headers per French tax authority requirements
  const headers = ['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'EcritereLettrage', 'DateLettrage', 'ValidDate', 'MontantDevise', 'Idevise'];
  const lines = [headers.join('\t')];

  invoicesList.forEach((inv, idx) => {
    const date = inv.created_at ? new Date(inv.created_at).toISOString().slice(0, 10).replace(/-/g, '') : '';
    const num = String(idx + 1).padStart(6, '0');
    // Revenue line
    lines.push(['VE', 'Journal des Ventes', num, date, '701000', 'Ventes de services', '', '', inv.number, date, inv.title || 'Facture', '', String(inv.amount_ht || '0'), '', '', date, '', 'EUR'].join('\t'));
    // TVA line
    lines.push(['VE', 'Journal des Ventes', num, date, '445710', 'TVA collectée', '', '', inv.number, date, 'TVA', '', String(inv.amount_tva || '0'), '', '', date, '', 'EUR'].join('\t'));
    // Client line
    lines.push(['VE', 'Journal des Ventes', num, date, '411000', 'Clients', '', '', inv.number, date, inv.title || 'Facture', String(inv.amount_ttc || '0'), '', '', '', date, '', 'EUR'].join('\t'));
  });

  return lines.join('\n');
}

// ── Devis Templates (static, kept in client) ─────────────────────
// Templates are served from the static data in the page component itself

// ── Export db object ─────────────────────────────────────────────
export const db = {
  // Company
  getCompanySettings,
  updateCompanySettings,
  // Contacts
  getContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  // Quotes
  getQuotes,
  getQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  duplicateQuote,
  // Invoices
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  createInvoiceFromQuote,
  duplicateInvoice,
  // Document Lines
  getDocumentLines,
  createDocumentLine,
  updateDocumentLine,
  deleteDocumentLine,
  deleteDocumentLinesByDocument,
  bulkSaveDocumentLines,
  // Chantiers
  getChantiers,
  getChantier,
  createChantier,
  updateChantier,
  deleteChantier,
  // Resources
  getResources,
  getResource,
  createResource,
  updateResource,
  deleteResource,
  // Library
  getLibraryItems,
  getLibraryItem,
  createLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  // Purchases
  getPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
  getPurchaseLines,
  createPurchaseLine,
  updatePurchaseLine,
  deletePurchaseLine,
  // Bank
  getBankTransactions,
  createBankTransaction,
  updateBankTransaction,
  deleteBankTransaction,
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  // Planning
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  // Time
  getTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  // Documents
  getDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
  // Payment Links
  getPaymentLinks,
  getPaymentLinksForInvoice,
  createPaymentLink,
  // Marketplace
  getMarketplaceItems,
  // API Keys
  getApiKeys,
  createApiKey,
  updateApiKey,
  deleteApiKey,
  // Integrations
  getIntegrationSettings,
  createIntegrationSetting,
  updateIntegrationSetting,
  deleteIntegrationSetting,
  // Webhooks
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  // Import
  importContacts,
  importArticles,
  // FEC Export
  getFECData,
};

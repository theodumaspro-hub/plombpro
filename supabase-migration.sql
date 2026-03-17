-- ========================================================
-- PlombPro - Migration Supabase complète
-- Copiez et collez ce SQL dans l'éditeur SQL de Supabase
-- Dashboard > SQL Editor > New Query > Coller > Run
-- ========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Company Settings ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_settings (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  siret TEXT,
  tva_intracom TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  rcs_number TEXT,
  assurance_decennale TEXT,
  qualifications TEXT,
  logo TEXT,
  trade TEXT,
  legal_form TEXT,
  capital TEXT,
  ape_code TEXT,
  iban TEXT,
  bic TEXT,
  bank_name TEXT,
  default_tva_rate NUMERIC DEFAULT 20,
  default_payment_delay INTEGER DEFAULT 30,
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 0,
  plan TEXT DEFAULT 'free',
  plan_start_date TEXT,
  plan_end_date TEXT,
  trial_ends_at TEXT
);

-- ─── Contacts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  category TEXT,
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  siret TEXT,
  tva_intracom TEXT,
  notes TEXT,
  tags TEXT,
  total_quoted NUMERIC DEFAULT 0,
  total_billed NUMERIC DEFAULT 0,
  total_paid NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Quotes ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL,
  chantier_id INTEGER,
  number TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT,
  description TEXT,
  amount_ht NUMERIC DEFAULT 0,
  amount_tva NUMERIC DEFAULT 0,
  amount_ttc NUMERIC DEFAULT 0,
  discount_percent NUMERIC,
  discount_amount NUMERIC,
  valid_until TEXT,
  signed_at TEXT,
  signature_data TEXT,
  notes TEXT,
  conditions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Invoices ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL,
  chantier_id INTEGER,
  quote_id INTEGER,
  number TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT,
  amount_ht NUMERIC DEFAULT 0,
  amount_tva NUMERIC DEFAULT 0,
  amount_ttc NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  payment_method TEXT,
  payment_date TEXT,
  due_date TEXT,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_date TEXT,
  situation_number INTEGER,
  situation_percent NUMERIC,
  retenue_garantie_percent NUMERIC,
  retenue_garantie_amount NUMERIC,
  retenue_garantie_due_date TEXT,
  prime_energie_amount NUMERIC,
  prime_energie_type TEXT,
  factur_x_status TEXT,
  factur_x_format TEXT,
  notes TEXT,
  conditions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Document Lines ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_lines (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_id INTEGER NOT NULL,
  library_item_id INTEGER,
  designation TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'u',
  unit_price_ht NUMERIC DEFAULT 0,
  tva_rate NUMERIC DEFAULT 20,
  total_ht NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_title BOOLEAN DEFAULT false,
  is_subtotal BOOLEAN DEFAULT false
);

-- ─── Chantiers ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chantiers (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL,
  reference TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  priority TEXT DEFAULT 'normale',
  type TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  estimated_amount_ht NUMERIC DEFAULT 0,
  actual_amount_ht NUMERIC DEFAULT 0,
  cost_materials NUMERIC DEFAULT 0,
  cost_labor NUMERIC DEFAULT 0,
  cost_subcontractors NUMERIC DEFAULT 0,
  margin NUMERIC,
  start_date TEXT,
  end_date TEXT,
  completion_percent INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Resources ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS resources (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  hourly_rate NUMERIC,
  daily_rate NUMERIC,
  color TEXT,
  status TEXT NOT NULL,
  skills TEXT,
  certifications TEXT,
  company TEXT,
  siret TEXT,
  assurance_decennale TEXT,
  assurance_expiry TEXT,
  category TEXT,
  serial_number TEXT,
  purchase_date TEXT,
  purchase_price NUMERIC,
  next_maintenance_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Library Items ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS library_items (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  family TEXT,
  sub_family TEXT,
  reference TEXT,
  designation TEXT NOT NULL,
  description TEXT,
  unit TEXT DEFAULT 'u',
  purchase_price_ht NUMERIC,
  selling_price_ht NUMERIC DEFAULT 0,
  margin_percent NUMERIC,
  tva_rate NUMERIC DEFAULT 20,
  supplier_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Purchases ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL,
  chantier_id INTEGER,
  number TEXT NOT NULL,
  status TEXT NOT NULL,
  amount_ht NUMERIC DEFAULT 0,
  amount_tva NUMERIC DEFAULT 0,
  amount_ttc NUMERIC DEFAULT 0,
  order_date TEXT,
  delivery_date TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Purchase Lines ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_lines (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_id INTEGER NOT NULL,
  library_item_id INTEGER,
  designation TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit TEXT DEFAULT 'u',
  unit_price_ht NUMERIC DEFAULT 0,
  tva_rate NUMERIC DEFAULT 20,
  total_ht NUMERIC DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

-- ─── Bank Transactions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_transactions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  matched_invoice_id INTEGER,
  matched_purchase_id INTEGER,
  reconciled BOOLEAN DEFAULT false,
  bank_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Appointments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chantier_id INTEGER,
  resource_id INTEGER,
  contact_id INTEGER,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  address TEXT,
  city TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Time Entries ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_entries (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL,
  chantier_id INTEGER,
  appointment_id INTEGER,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  duration NUMERIC NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  billable BOOLEAN DEFAULT true,
  validated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Documents ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT,
  related_type TEXT,
  related_id INTEGER,
  size INTEGER,
  mime_type TEXT,
  url TEXT,
  notes TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Payment Links ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_links (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT NOT NULL,
  payment_method TEXT,
  link_url TEXT,
  expires_at TEXT,
  paid_at TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Bank Accounts ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  iban TEXT,
  bic TEXT,
  balance NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  status TEXT NOT NULL,
  last_sync_at TEXT,
  color TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Companies ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  siret TEXT,
  legal_form TEXT,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  is_active BOOLEAN DEFAULT true,
  is_primary BOOLEAN DEFAULT false,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Marketplace Items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_items (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id INTEGER,
  supplier_name TEXT NOT NULL,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price_ht NUMERIC,
  unit TEXT DEFAULT 'u',
  min_quantity INTEGER DEFAULT 1,
  delivery_days INTEGER,
  rating NUMERIC,
  image_url TEXT,
  in_stock BOOLEAN DEFAULT true,
  promo_percent NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── API Keys ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL,
  permissions TEXT,
  last_used_at TEXT,
  expires_at TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Webhooks ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhooks (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  secret TEXT,
  status TEXT NOT NULL,
  last_triggered_at TEXT,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Quote Templates ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_templates (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  lines JSONB DEFAULT '[]'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  is_system BOOLEAN DEFAULT false
);

-- ========================================================
-- Enable Row Level Security on all tables
-- ========================================================
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE chantiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_templates ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- RLS Policies (individual statements)
-- ========================================================

-- company_settings
CREATE POLICY "users_select_company_settings" ON company_settings FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_company_settings" ON company_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_company_settings" ON company_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_company_settings" ON company_settings FOR DELETE USING (auth.uid() = user_id);

-- contacts
CREATE POLICY "users_select_contacts" ON contacts FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_contacts" ON contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_contacts" ON contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_contacts" ON contacts FOR DELETE USING (auth.uid() = user_id);

-- quotes
CREATE POLICY "users_select_quotes" ON quotes FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_quotes" ON quotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_quotes" ON quotes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_quotes" ON quotes FOR DELETE USING (auth.uid() = user_id);

-- invoices
CREATE POLICY "users_select_invoices" ON invoices FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_invoices" ON invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_invoices" ON invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_invoices" ON invoices FOR DELETE USING (auth.uid() = user_id);

-- document_lines
CREATE POLICY "users_select_document_lines" ON document_lines FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_document_lines" ON document_lines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_document_lines" ON document_lines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_document_lines" ON document_lines FOR DELETE USING (auth.uid() = user_id);

-- chantiers
CREATE POLICY "users_select_chantiers" ON chantiers FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_chantiers" ON chantiers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_chantiers" ON chantiers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_chantiers" ON chantiers FOR DELETE USING (auth.uid() = user_id);

-- resources
CREATE POLICY "users_select_resources" ON resources FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_resources" ON resources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_resources" ON resources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_resources" ON resources FOR DELETE USING (auth.uid() = user_id);

-- library_items
CREATE POLICY "users_select_library_items" ON library_items FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_library_items" ON library_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_library_items" ON library_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_library_items" ON library_items FOR DELETE USING (auth.uid() = user_id);

-- purchases
CREATE POLICY "users_select_purchases" ON purchases FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_purchases" ON purchases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_purchases" ON purchases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_purchases" ON purchases FOR DELETE USING (auth.uid() = user_id);

-- purchase_lines
CREATE POLICY "users_select_purchase_lines" ON purchase_lines FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_purchase_lines" ON purchase_lines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_purchase_lines" ON purchase_lines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_purchase_lines" ON purchase_lines FOR DELETE USING (auth.uid() = user_id);

-- bank_transactions
CREATE POLICY "users_select_bank_transactions" ON bank_transactions FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_bank_transactions" ON bank_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_bank_transactions" ON bank_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_bank_transactions" ON bank_transactions FOR DELETE USING (auth.uid() = user_id);

-- appointments
CREATE POLICY "users_select_appointments" ON appointments FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_appointments" ON appointments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_appointments" ON appointments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_appointments" ON appointments FOR DELETE USING (auth.uid() = user_id);

-- time_entries
CREATE POLICY "users_select_time_entries" ON time_entries FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_time_entries" ON time_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_time_entries" ON time_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_time_entries" ON time_entries FOR DELETE USING (auth.uid() = user_id);

-- documents
CREATE POLICY "users_select_documents" ON documents FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_documents" ON documents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_documents" ON documents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_documents" ON documents FOR DELETE USING (auth.uid() = user_id);

-- payment_links
CREATE POLICY "users_select_payment_links" ON payment_links FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_payment_links" ON payment_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_payment_links" ON payment_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_payment_links" ON payment_links FOR DELETE USING (auth.uid() = user_id);

-- bank_accounts
CREATE POLICY "users_select_bank_accounts" ON bank_accounts FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_bank_accounts" ON bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_bank_accounts" ON bank_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_bank_accounts" ON bank_accounts FOR DELETE USING (auth.uid() = user_id);

-- companies
CREATE POLICY "users_select_companies" ON companies FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_companies" ON companies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_companies" ON companies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_companies" ON companies FOR DELETE USING (auth.uid() = user_id);

-- marketplace_items
CREATE POLICY "users_select_marketplace_items" ON marketplace_items FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_marketplace_items" ON marketplace_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_marketplace_items" ON marketplace_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_marketplace_items" ON marketplace_items FOR DELETE USING (auth.uid() = user_id);

-- api_keys
CREATE POLICY "users_select_api_keys" ON api_keys FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_api_keys" ON api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_api_keys" ON api_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_api_keys" ON api_keys FOR DELETE USING (auth.uid() = user_id);

-- webhooks
CREATE POLICY "users_select_webhooks" ON webhooks FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_webhooks" ON webhooks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_webhooks" ON webhooks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_webhooks" ON webhooks FOR DELETE USING (auth.uid() = user_id);

-- quote_templates
CREATE POLICY "users_select_quote_templates" ON quote_templates FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "users_insert_quote_templates" ON quote_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_quote_templates" ON quote_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_quote_templates" ON quote_templates FOR DELETE USING (auth.uid() = user_id);

-- ========================================================
-- Insert system quote templates
-- ========================================================
INSERT INTO quote_templates (id, category, name, description, lines, is_system) VALUES
('sdb-complete', 'Sanitaire', 'Rénovation salle de bain complète', 'Dépose + fourniture et pose douche/baignoire, vasque, WC', '[{"designation":"Dépose sanitaires existants","unit":"forfait","unitPriceHT":"800","tvaRate":"10"},{"designation":"Fourniture et pose douche italienne","unit":"ens","unitPriceHT":"3200","tvaRate":"10"},{"designation":"Meuble vasque + robinetterie","unit":"ens","unitPriceHT":"1800","tvaRate":"10"},{"designation":"WC suspendu (Geberit + cuvette)","unit":"ens","unitPriceHT":"1500","tvaRate":"10"},{"designation":"Raccordements eau + évacuations","unit":"forfait","unitPriceHT":"950","tvaRate":"10"}]', true),
('chaudiere-install', 'Chauffage', 'Installation chaudière gaz condensation', 'Dépose ancienne + fourniture et pose nouvelle chaudière', '[{"designation":"Dépose ancienne chaudière + évacuation","unit":"forfait","unitPriceHT":"450","tvaRate":"10"},{"designation":"Chaudière gaz condensation murale","unit":"u","unitPriceHT":"2800","tvaRate":"5.5"},{"designation":"Kit raccordement hydraulique","unit":"ens","unitPriceHT":"380","tvaRate":"10"},{"designation":"Raccordement fumisterie ventouse","unit":"forfait","unitPriceHT":"520","tvaRate":"10"},{"designation":"Mise en service + réglages","unit":"forfait","unitPriceHT":"350","tvaRate":"10"}]', true),
('pac-air-eau', 'Chauffage', 'Installation PAC air/eau', 'Pompe à chaleur air/eau avec plancher chauffant ou radiateurs', '[{"designation":"PAC air/eau monobloc (ex: Daikin Altherma)","unit":"u","unitPriceHT":"6500","tvaRate":"5.5"},{"designation":"Ballon tampon + accessoires hydrauliques","unit":"ens","unitPriceHT":"1200","tvaRate":"5.5"},{"designation":"Raccordements frigorifiques + hydrauliques","unit":"forfait","unitPriceHT":"1500","tvaRate":"10"},{"designation":"Mise en service + programmation","unit":"forfait","unitPriceHT":"600","tvaRate":"10"},{"designation":"Dossier MaPrimeRénov + CEE","unit":"forfait","unitPriceHT":"0","tvaRate":"0"}]', true),
('depannage-fuite', 'Dépannage', 'Dépannage fuite eau', 'Recherche de fuite + réparation sur réseau cuivre ou PER', '[{"designation":"Déplacement + diagnostic","unit":"forfait","unitPriceHT":"85","tvaRate":"20"},{"designation":"Recherche de fuite","unit":"h","unitPriceHT":"55","tvaRate":"20"},{"designation":"Réparation réseau (soudure/sertissage)","unit":"forfait","unitPriceHT":"180","tvaRate":"20"},{"designation":"Fournitures (raccords, tube)","unit":"ens","unitPriceHT":"45","tvaRate":"20"}]', true),
('entretien-chaudiere', 'Entretien', 'Entretien annuel chaudière gaz', 'Visite annuelle obligatoire avec attestation', '[{"designation":"Visite de contrôle + nettoyage","unit":"forfait","unitPriceHT":"120","tvaRate":"10"},{"designation":"Analyse combustion + réglages","unit":"forfait","unitPriceHT":"45","tvaRate":"10"},{"designation":"Attestation entretien","unit":"u","unitPriceHT":"0","tvaRate":"0"}]', true)
ON CONFLICT (id) DO NOTHING;

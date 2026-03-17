-- Integration Settings table for Gmail OAuth and WhatsApp Business
CREATE TABLE IF NOT EXISTS integration_settings (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  provider TEXT NOT NULL, -- gmail, whatsapp
  status TEXT NOT NULL DEFAULT 'disconnected', -- connected, disconnected, expired
  -- Gmail OAuth
  access_token TEXT,
  refresh_token TEXT,
  token_expiry TEXT,
  gmail_email TEXT,
  -- WhatsApp Business
  whatsapp_phone TEXT,
  whatsapp_api_key TEXT,
  whatsapp_instance_id TEXT,
  -- General
  metadata TEXT, -- JSON for extra provider config
  connected_at TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations"
  ON integration_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own integrations"
  ON integration_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own integrations"
  ON integration_settings FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own integrations"
  ON integration_settings FOR DELETE
  USING (user_id = auth.uid());

-- Service role bypass for server-side operations
CREATE POLICY "Service role full access to integrations"
  ON integration_settings FOR ALL
  USING (auth.role() = 'service_role');

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_integration_settings_user_provider ON integration_settings(user_id, provider);

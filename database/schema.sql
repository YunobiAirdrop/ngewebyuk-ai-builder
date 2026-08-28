-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT UNIQUE NOT NULL,
  username TEXT,
  password TEXT,
  saldo_kredit INTEGER DEFAULT 0,
  daily_free_token INTEGER DEFAULT 700,
  trial_start_date TEXT,
  last_token_reset TEXT,
  is_premium INTEGER DEFAULT 0,
  premium_expires_at TEXT,
  referral_code TEXT UNIQUE,
  referred_by_id INTEGER,
  user_vercel_token TEXT,
  user_netlify_token TEXT,
  user_supabase_url TEXT,
  user_supabase_key TEXT,
  midtrans_client_key TEXT,
  parent_agency_id INTEGER,
  is_reseller INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referred_by_id) REFERENCES users(id),
  FOREIGN KEY (parent_agency_id) REFERENCES users(id)
);

-- Deposits table
CREATE TABLE IF NOT EXISTS deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  jumlah INTEGER NOT NULL,
  token_amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  bukti_transfer_path TEXT,
  is_proof_received INTEGER DEFAULT 0,
  is_fraud_suspected INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Vouchers table
CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  token_amount INTEGER NOT NULL,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  category_function TEXT NOT NULL,
  status INTEGER DEFAULT 1,
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Pricing settings table
CREATE TABLE IF NOT EXISTS pricing_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flat_command_cost INTEGER DEFAULT 270,
  free_trial_daily_tokens INTEGER DEFAULT 700,
  trial_duration_days INTEGER DEFAULT 2,
  token_rate_idr INTEGER DEFAULT 1000,
  bot_wa_number TEXT DEFAULT '089514953909',
  admin_wa_number TEXT DEFAULT '085894336189',
  backup_admin_wa TEXT,
  dana_number TEXT,
  dana_account_name TEXT,
  qris_image_url TEXT,
  cloudflare_api_token TEXT,
  unsplash_access_key TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Web projects table
CREATE TABLE IF NOT EXISTS web_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  project_name TEXT NOT NULL,
  html_code TEXT,
  css_code TEXT,
  js_code TEXT,
  tech_stack TEXT DEFAULT 'html,tailwind,js',
  preview_id TEXT UNIQUE,
  vercel_url TEXT,
  custom_domain TEXT,
  subdomain_name TEXT,
  passcode_protected TEXT,
  version_history_json TEXT,
  is_saved INTEGER DEFAULT 1,
  is_external_zip INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Lead contacts table
CREATE TABLE IF NOT EXISTS lead_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  user_id INTEGER NOT NULL,
  sender_name TEXT,
  sender_phone TEXT,
  form_data_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES web_projects(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Chat history table
CREATE TABLE IF NOT EXISTS chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_referral ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_projects_user ON web_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_preview ON web_projects(preview_id);
CREATE INDEX IF NOT EXISTS idx_deposits_user ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_category ON api_keys(category_function);

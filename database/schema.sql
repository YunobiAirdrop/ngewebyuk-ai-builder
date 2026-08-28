-- Schema Produksi Database SQLite NgeWebYuk AI Builder
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone_number TEXT UNIQUE NOT NULL,
  username TEXT,
  saldo_kredit INTEGER DEFAULT 700,
  daily_free_token INTEGER DEFAULT 700,
  is_premium INTEGER DEFAULT 0,
  referral_code TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deposits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  payment_method TEXT DEFAULT 'QRIS/DANA',
  jumlah INTEGER,
  token_amount INTEGER,
  status TEXT DEFAULT 'awaiting_proof',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  category_function TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  usage_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS web_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  project_name TEXT,
  html_code TEXT,
  preview_id TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
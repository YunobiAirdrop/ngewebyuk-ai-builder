const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || './database/database.sqlite';

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = null;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeTables();
  }
  return db;
}

function initializeTables() {
  const db = getDb();
  
  // Users table
  db.exec(`
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
    )
  `);

  // Deposits table
  db.exec(`
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
    )
  `);

  // Vouchers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      token_amount INTEGER NOT NULL,
      max_uses INTEGER DEFAULT 1,
      current_uses INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // API Keys table
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_name TEXT NOT NULL,
      api_key TEXT NOT NULL,
      category_function TEXT NOT NULL,
      status INTEGER DEFAULT 1,
      usage_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Pricing settings table
  db.exec(`
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
    )
  `);

  // Web projects table
  db.exec(`
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
    )
  `);

  // Lead contacts table
  db.exec(`
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
    )
  `);

  // Transactions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Chat history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Insert default admin user if not exists
  const adminCheck = db.prepare('SELECT * FROM users WHERE phone_number = ?');
  const admin = adminCheck.get(process.env.ADMIN_PHONE);
  
  if (!admin) {
    const insertAdmin = db.prepare(`
      INSERT INTO users (phone_number, username, is_premium, is_reseller, saldo_kredit)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertAdmin.run(process.env.ADMIN_PHONE, 'Admin', 1, 1, 10000);
  }

  // Insert default pricing settings if not exists
  const pricingCheck = db.prepare('SELECT * FROM pricing_settings LIMIT 1');
  const pricing = pricingCheck.get();
  
  if (!pricing) {
    const insertPricing = db.prepare(`
      INSERT INTO pricing_settings (
        flat_command_cost, free_trial_daily_tokens, trial_duration_days,
        token_rate_idr, bot_wa_number, admin_wa_number
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertPricing.run(270, 700, 2, 1000, '089514953909', '085894336189');
  }

  // Insert default API keys if not exists
  const apiCheck = db.prepare('SELECT * FROM api_keys LIMIT 1');
  const apiExists = apiCheck.get();
  
  if (!apiExists) {
    const insertApi = db.prepare(`
      INSERT INTO api_keys (provider_name, api_key, category_function, status)
      VALUES (?, ?, ?, ?)
    `);
    // Insert placeholder keys - user will update these
    const providers = [
      ['groq_console', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['google_gemini', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['openrouter', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['together_ai', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['deepinfra', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['fireworks_ai', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['cohere_ai', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['mistral_ai', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['huggingface', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['cerebras', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['sambanova', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['ai21_labs', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['anyscale', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['novita_ai', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['cloudflare_workers', 'PLACEHOLDER_KEY', 'text_chat', 1],
      ['deepseek', 'PLACEHOLDER_KEY', 'web_builder', 1],
      ['codeium', 'PLACEHOLDER_KEY', 'web_builder', 1],
      ['github_models', 'PLACEHOLDER_KEY', 'web_builder', 1],
      ['alibaba_dashscope', 'PLACEHOLDER_KEY', 'web_builder', 1],
      ['replit_ai', 'PLACEHOLDER_KEY', 'web_builder', 1],
      ['codestral', 'PLACEHOLDER_KEY', 'web_builder', 1],
      ['tabby_ml', 'PLACEHOLDER_KEY', 'web_builder', 1],
      ['glitch_api', 'PLACEHOLDER_KEY', 'web_builder', 1],
      ['sourcegraph_cody', 'PLACEHOLDER_KEY', 'web_builder', 1],
      ['blackbox_ai', 'PLACEHOLDER_KEY', 'web_builder', 1],
      ['pollinations', 'PLACEHOLDER_KEY', 'image_generator', 1],
      ['clipdrop', 'PLACEHOLDER_KEY', 'image_generator', 1],
      ['deepai_image', 'PLACEHOLDER_KEY', 'image_generator', 1],
      ['getimg_ai', 'PLACEHOLDER_KEY', 'image_generator', 1],
      ['lexica', 'PLACEHOLDER_KEY', 'image_generator', 1],
      ['prodia', 'PLACEHOLDER_KEY', 'image_generator', 1],
      ['craiyon', 'PLACEHOLDER_KEY', 'image_generator', 1],
      ['scenario_ai', 'PLACEHOLDER_KEY', 'image_generator', 1],
      ['recraft_ai', 'PLACEHOLDER_KEY', 'image_generator', 1],
      ['huggingface_sd', 'PLACEHOLDER_KEY', 'image_generator', 1],
      ['seaart_ai', 'PLACEHOLDER_KEY', 'image_generator', 1],
      ['limewire_ai', 'PLACEHOLDER_KEY', 'image_generator', 1],
      ['replicate', 'PLACEHOLDER_KEY', 'video_generator', 1],
      ['luma_dream', 'PLACEHOLDER_KEY', 'video_generator', 1],
      ['pika_labs', 'PLACEHOLDER_KEY', 'video_generator', 1],
      ['livepeer', 'PLACEHOLDER_KEY', 'video_generator', 1],
      ['heygen', 'PLACEHOLDER_KEY', 'video_generator', 1],
      ['did_video', 'PLACEHOLDER_KEY', 'video_generator', 1],
      ['synthesia', 'PLACEHOLDER_KEY', 'video_generator', 1],
      ['kaiber_ai', 'PLACEHOLDER_KEY', 'video_generator', 1],
      ['groq_whisper', 'PLACEHOLDER_KEY', 'voice_engine', 1],
      ['openai_whisper_hf', 'PLACEHOLDER_KEY', 'voice_engine', 1],
      ['elevenlabs', 'PLACEHOLDER_KEY', 'voice_engine', 1],
      ['deepgram', 'PLACEHOLDER_KEY', 'voice_engine', 1],
      ['assemblyai', 'PLACEHOLDER_KEY', 'voice_engine', 1],
      ['play_ht', 'PLACEHOLDER_KEY', 'voice_engine', 1],
      ['speechify', 'PLACEHOLDER_KEY', 'voice_engine', 1],
      ['unstructured', 'PLACEHOLDER_KEY', 'document_analyzer', 1],
      ['pinecone', 'PLACEHOLDER_KEY', 'document_analyzer', 1],
      ['qdrant', 'PLACEHOLDER_KEY', 'document_analyzer', 1],
      ['llamaindex', 'PLACEHOLDER_KEY', 'document_analyzer', 1],
      ['langchain_smith', 'PLACEHOLDER_KEY', 'document_analyzer', 1],
      ['vercel', 'PLACEHOLDER_KEY', 'infra_deploy', 1],
      ['netlify', 'PLACEHOLDER_KEY', 'infra_deploy', 1],
      ['cloudflare', 'PLACEHOLDER_KEY', 'infra_deploy', 1],
      ['supabase', 'PLACEHOLDER_KEY', 'infra_deploy', 1],
      ['render', 'PLACEHOLDER_KEY', 'infra_deploy', 1]
    ];
    
    for (const [provider, key, category, status] of providers) {
      insertApi.run(provider, key, category, status);
    }
  }

  console.log('✅ Database initialized successfully');
}

function getDbInstance() {
  return getDb();
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = {
  getDb: getDbInstance,
  closeDb,
  initDatabase: initializeTables
};

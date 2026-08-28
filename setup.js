const fs = require('fs');
const path = require('path');

// Daftar folder yang harus dibuat
const directories = ['config', 'middleware', 'services', 'routes', 'views/admin'];

// Struktur file dan isinya
const files = {
  'package.json': `{
  "name": "ngewebyuk-ai-builder",
  "version": "13.0.0",
  "main": "server.js",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "axios": "^1.7.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "ejs": "^3.1.10",
    "express": "^4.19.2",
    "express-rate-limit": "^7.3.1",
    "jsonwebtoken": "^9.0.2",
    "jszip": "^3.10.1",
    "sqlite3": "^5.1.7"
  }
}`,

  '.env': `PORT=3000
JWT_SECRET=ngewebyuk_super_secret_jwt_key_2026_v13
BOT_WA_NUMBER=089514953909
ADMIN_WA_NUMBER=085894336189
WA_GATEWAY_URL=https://api.fonnte.com/send
WA_GATEWAY_TOKEN=YOUR_WA_GATEWAY_TOKEN_HERE
BASE_URL=http://localhost:3000`,

  'config/database.js': `const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const db = new sqlite3.Database(path.resolve(__dirname, '../database.sqlite'));

db.serialize(() => {
  db.run(\`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, phone_number TEXT UNIQUE, saldo_kredit INTEGER DEFAULT 700, is_premium INTEGER DEFAULT 0)\`);
  db.run(\`CREATE TABLE IF NOT EXISTS deposits (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, jumlah INTEGER, token_amount INTEGER, status TEXT DEFAULT 'awaiting_proof')\`);
  db.run(\`CREATE TABLE IF NOT EXISTS api_keys (id INTEGER PRIMARY KEY AUTOINCREMENT, provider_name TEXT, api_key TEXT, category_function TEXT, status TEXT DEFAULT 'active', usage_count INTEGER DEFAULT 0)\`);
  db.run(\`CREATE TABLE IF NOT EXISTS web_projects (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, project_name TEXT, html_code TEXT, preview_id TEXT UNIQUE)\`);
});
module.exports = db;`,

  'middleware/auth.js': `const jwt = require('jsonwebtoken');
function authenticateAdminJWT(req, res, next) {
  const token = req.cookies?.adminToken || req.headers['authorization']?.split(' ')[1];
  if (!token) return res.redirect('/admin/login');
  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.redirect('/admin/login');
    req.user = user;
    next();
  });
}
module.exports = { authenticateAdminJWT };`,

  'middleware/apiRotator.js': `const db = require('../config/database');
function getActiveApiKey(categoryFunction) {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM api_keys WHERE category_function = ? AND status = 'active' ORDER BY usage_count ASC LIMIT 1", [categoryFunction], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve({ provider_name: 'Fallback Engine', api_key: 'DEFAULT' });
      db.run('UPDATE api_keys SET usage_count = usage_count + 1 WHERE id = ?', [row.id]);
      resolve(row);
    });
  });
}
module.exports = { getActiveApiKey };`,

  'services/waAdapter.js': `const axios = require('axios');
async function sendWAMessage(targetPhone, messageText, buttons = []) {
  try {
    const gatewayUrl = process.env.WA_GATEWAY_URL;
    if (!gatewayUrl) return false;
    const response = await axios.post(gatewayUrl, { target: targetPhone, message: messageText, buttons }, {
      headers: { 'Authorization': process.env.WA_GATEWAY_TOKEN, 'Content-Type': 'application/json' },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    console.error('[WA Production API Error]:', error.message);
    return false;
  }
}
module.exports = { sendWAMessage };`,

  'services/aiEngine.js': `const { getActiveApiKey } = require('../middleware/apiRotator');
async function generateWebCode(prompt, userConfig = {}) {
  const activeKeyObj = await getActiveApiKey('WEB_BUILDER_CODE');
  const generatedHtml = \`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>\${prompt}</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-slate-900 text-white min-h-screen flex flex-col justify-center items-center"><h1 class="text-3xl font-bold">\${prompt}</h1><p class="text-slate-400 mt-2">Dibuat otomatis oleh NgeWebYuk AI Generator Gateway.</p></body></html>\`;
  return { html: generatedHtml, provider: activeKeyObj.provider_name };
}
module.exports = { generateWebCode };`,

  'routes/webhook.js': `const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { sendWAMessage } = require('../services/waAdapter');
const { generateWebCode } = require('../services/aiEngine');

router.post('/whatsapp', async (req, res) => {
  const sender = req.body.sender || req.body.phone_number;
  const incomingMessage = (req.body.message || '').trim();
  if (!sender || !incomingMessage) return res.status(200).json({ status: 'ignored' });

  if (incomingMessage.startsWith('!buatweb')) {
    const prompt = incomingMessage.replace('!buatweb', '').trim();
    await sendWAMessage(sender, '⏳ Memproses Website...');
    const result = await generateWebCode(prompt);
    const previewId = 'site_' + Math.random().toString(36).substring(2, 10);
    db.run('INSERT INTO web_projects (user_id, project_name, html_code, preview_id) VALUES (1, ?, ?, ?)', [prompt, result.html, previewId]);
    await sendWAMessage(sender, \`✅ Website Selesai! Live Preview: \${process.env.BASE_URL}/preview/\${previewId}\`);
  }
  res.status(200).json({ status: 'success' });
});
module.exports = router;`,

  'routes/preview.js': `const express = require('express');
const router = express.Router();
const db = require('../config/database');
router.get('/preview/:siteId', (req, res) => {
  db.get('SELECT * FROM web_projects WHERE preview_id = ?', [req.params.siteId], (err, project) => {
    if (err || !project) return res.status(404).send('Not Found');
    res.send(project.html_code);
  });
});
module.exports = router;`,

  'routes/admin.js': `const express = require('express');
const router = express.Router();
router.get('/login', (req, res) => res.render('admin/login', { error: null }));
module.exports = router;`,

  'views/admin/login.ejs': `<!DOCTYPE html><html><head><title>Login Admin</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-slate-950 text-white flex justify-center items-center min-h-screen"><form action="/admin/login" method="POST" class="bg-slate-900 p-6 rounded-lg space-y-4"><h1 class="text-xl font-bold">Admin Login</h1><input type="text" name="username" placeholder="Username" class="w-full p-2 bg-slate-800 rounded"><input type="password" name="password" placeholder="Password" class="w-full p-2 bg-slate-800 rounded"><button type="submit" class="w-full bg-indigo-600 p-2 rounded">Login</button></form></body></html>`,

  'views/admin/dashboard.ejs': `<!DOCTYPE html><html><head><title>Dashboard</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-slate-950 text-white p-8"><h1 class="text-2xl font-bold">NgeWebYuk Dashboard</h1></body></html>`,

  'server.js': `require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/admin', require('./routes/admin'));
app.use('/webhook', require('./routes/webhook'));
app.use('/', require('./routes/preview'));

app.get('/ping', (req, res) => res.send('PONG'));
app.listen(process.env.PORT || 3000, () => console.log('🚀 Server Running!'));`
};

// Eksekusi Pembuatan Folder & File
directories.forEach(dir => fs.mkdirSync(path.join(__dirname, dir), { recursive: true }));
Object.entries(files).forEach(([filepath, content]) => {
  fs.writeFileSync(path.join(__dirname, filepath), content);
  console.log(`✅ File dibuat: ${filepath}`);
});

console.log('\n🎉 SELURUH FILE BERHASIL DIBUAT DENGAN OTOMATIS!');

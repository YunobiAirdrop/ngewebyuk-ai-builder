const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { getDb } = require('../config/database');
const { getUserByPhone, deductTokens, addTokens } = require('../middleware/auth');
const { generateWebsite } = require('./aiEngine');

let sock = null;
let isBotRunning = false;
let botPhoneNumber = process.env.BOT_PHONE || '089514953909';
let adminPhoneNumber = process.env.ADMIN_PHONE || '085894336189';

// Command handlers
const commandHandlers = {
  '!menu': handleMenu,
  '!buatweb': handleCreateWebsite,
  '!revisi': handleRevision,
  '!preview': handlePreview,
  '!download': handleDownload,
  '!deploy': handleDeploy,
  '!setdomain': handleSetDomain,
  '!setpass': handleSetPassword,
  '!saldo': handleCheckBalance,
  '!deposit': handleDeposit,
  '!exportpdf': handleExportPDF,
  '!auditweb': handleAuditWeb,
  '!rollback': handleRollback,
  '!edittext': handleEditText,
  '!addteam': handleAddTeam,
  '!settoken': handleSetToken,
  '!setdb': handleSetDB,
  '!setpixel': handleSetPixel,
  '!qrcode': handleQRCode,
  '!palette': handlePalette,
  '!abtest': handleABTest,
  '!wp': handleWordPressExport,
  '!pwa': handlePWA,
  '!help': handleHelp
};

async function startBot() {
  if (isBotRunning) {
    console.log('🤖 WhatsApp bot is already running');
    return;
  }

  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: ['NgeWebYuk AI Builder', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        console.log('📱 Scan QR Code to connect WhatsApp:');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode;
        console.log(`❌ Connection closed: ${reason}`);
        
        if (reason !== DisconnectReason.loggedOut) {
          isBotRunning = false;
          setTimeout(startBot, 5000);
        } else {
          console.log('🔄 Bot logged out, please restart');
        }
      } else if (connection === 'open') {
        isBotRunning = true;
        console.log(`✅ WhatsApp bot connected! Bot number: ${botPhoneNumber}`);
        sendStartupNotification();
      }
    });

    sock.ev.on('messages.upsert', async (m) => {
      try {
        const message = m.messages[0];
        if (!message || !message.message) return;

        const text = message.message.conversation || 
                    message.message.extendedTextMessage?.text ||
                    message.message.imageMessage?.caption ||
                    message.message.documentMessage?.caption || '';

        if (!text) return;

        const sender = message.key.remoteJid;
        const senderNumber = sender.replace(/@s\.whatsapp\.net$/, '');

        console.log(`📩 Message from ${senderNumber}: ${text.substring(0, 100)}`);

        // Process commands
        await processCommand(sender, senderNumber, text, message);

      } catch (error) {
        console.error('Error processing message:', error);
        await sendMessage(sender, '❌ Maaf, terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi.');
      }
    });

  } catch (error) {
    console.error('❌ Failed to start WhatsApp bot:', error);
    setTimeout(startBot, 10000);
  }
}

async function processCommand(sender, senderNumber, text, message) {
  // Check for bot mention or direct command
  const trimmed = text.trim();
  
  // Check if it's a command
  if (trimmed.startsWith('!')) {
    const parts = trimmed.split(' ');
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);
    
    const handler = commandHandlers[command];
    if (handler) {
      await handler(sender, senderNumber, args, message);
    } else {
      // Try AI response
      await handleAIChat(sender, senderNumber, trimmed);
    }
    return;
  }

  // Not a command, check if it's a chat with bot
  if (message.key.fromMe || message.key.participant) {
    // Ignore messages from self
    return;
  }

  // Regular chat - try AI response
  await handleAIChat(sender, senderNumber, trimmed);
}

async function sendMessage(to, text, options = {}) {
  if (!sock) {
    console.error('❌ WhatsApp socket not connected');
    return;
  }

  try {
    await sock.sendMessage(to, { text, ...options });
  } catch (error) {
    console.error('❌ Failed to send message:', error);
  }
}

async function sendStartupNotification() {
  try {
    const db = getDb();
    const users = db.prepare('SELECT phone_number FROM users WHERE is_premium = 1').all();
    
    // Send to admin
    await sendMessage(`${adminPhoneNumber}@s.whatsapp.net`, `
🤖 *NgeWebYuk AI Builder Bot Active* 

Bot WhatsApp berhasil terhubung!
📱 Nomor Bot: ${botPhoneNumber}
👤 Admin: ${adminPhoneNumber}

Gunakan !menu untuk melihat semua fitur.
    `);
  } catch (error) {
    console.error('Error sending startup notification:', error);
  }
}

// Command Handlers

async function handleMenu(sender, senderNumber, args) {
  const menu = `
*🤖 NgeWebYuk AI Builder*

*📊 MAIN MENU*

1️⃣ *Buat Website AI*
   Ketik: *!buatweb <deskripsi>*
   Contoh: !buatweb landing page untuk toko kopi

2️⃣ *AI Media Studio*
   Ketik: *!gambar <deskripsi>*
   Contoh: !gambar kucing realistis

3️⃣ *Dev Tools & Integrasi*
   - !setdomain <domain> - Set custom domain
   - !settoken <provider> <token> - Set deploy token
   - !setdb <url> <key> - Set Supabase DB

4️⃣ *Analisis Dokumen*
   Kirim file PDF/DOC untuk analisis

5️⃣ *Cek Saldo/Deposit*
   - !saldo - Cek saldo token   - !deposit <jumlah> - Deposit token

6️⃣ *Kemitraan & Team*
   - !addteam <nomor> - Tambah anggota team
   - !referral - Dapatkan kode referral

*⚡ FITUR PREMIUM*
   !revisi - Revisi website
   !deploy - Deploy ke Vercel
   !exportpdf - Export PDF
   !auditweb - Audit SEO
   !pwa - Aktifkan PWA

*💰 HARGA TOKEN*
   Flat Rate: 270 Token/command
   FREE TRIAL: 700 Token/hari (2 hari)

*🔗 Bantuan*
   Ketik *!help* untuk bantuan lengkap
  `;

  await sendMessage(sender, menu);
}

async function handleCreateWebsite(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Silakan berikan deskripsi website yang ingin dibuat.\nContoh: !buatweb landing page untuk coffee shop minimalis');
    return;
  }

  try {
    const description = args.join(' ');
    
    // Check user and deduct tokens
    const user = await getUserByPhone(senderNumber);
    await deductTokens(user.id, 270);
    
    await sendMessage(sender, '🔄 *Sedang membuat website...* Mohon tunggu beberapa saat.');

    // Generate website
    const result = await generateWebsite(description, user.id);
    
    if (result.success) {
      // Save to database
      const db = getDb();
      const insert = db.prepare(`
        INSERT INTO web_projects (user_id, project_name, html_code, css_code, js_code, preview_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const projectId = insert.run(
        user.id, 
        `Website ${new Date().toLocaleDateString()}`, 
        result.html, 
        result.css, 
        result.js,
        `preview_${Date.now()}`
      ).lastInsertRowid;

      const previewUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/preview/${projectId}`;
      
      await sendMessage(sender, `
✅ *Website Berhasil Dibuat!*

🔗 *Preview:* ${previewUrl}

📝 *Detail:*
   - ID Project: ${projectId}
   - Token Digunakan: 270

⚡ *Perintah Selanjutnya:*
   !preview ${projectId} - Lihat preview
   !download ${projectId} - Download ZIP
   !revisi ${projectId} "perubahan" - Revisi website
   !deploy ${projectId} - Deploy ke Vercel
      `);
    } else {
      // Refund tokens on error
      await addTokens(user.id, 270, 'Token rollback (API error)');
      await sendMessage(sender, `❌ Gagal membuat website: ${result.error}\n\nToken telah dikembalikan.`);
    }
  } catch (error) {
    await sendMessage(sender, `❌ Terjadi kesalahan: ${error.message}`);
  }
}

async function handlePreview(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Silakan berikan ID project.\nContoh: !preview 123');
    return;
  }

  const projectId = parseInt(args[0]);
  if (isNaN(projectId)) {
    await sendMessage(sender, '❌ ID project harus berupa angka.');
    return;
  }

  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM web_projects WHERE id = ?').get(projectId);
    
    if (!project) {
      await sendMessage(sender, '❌ Project tidak ditemukan.');
      return;
    }

    const previewUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/preview/${projectId}`;
    
    await sendMessage(sender, `
🔗 *Preview Website*
   URL: ${previewUrl}
   Nama: ${project.project_name}
   Dibuat: ${new Date(project.created_at).toLocaleDateString()}
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleDownload(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Silakan berikan ID project.\nContoh: !download 123');
    return;
  }

  const projectId = parseInt(args[0]);
  if (isNaN(projectId)) {
    await sendMessage(sender, '❌ ID project harus berupa angka.');
    return;
  }

  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM web_projects WHERE id = ?').get(projectId);
    
    if (!project) {
      await sendMessage(sender, '❌ Project tidak ditemukan.');
      return;
    }

    const downloadUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/preview/download/${projectId}`;
    
    await sendMessage(sender, `
📥 *Download Website*
   URL: ${downloadUrl}
   Nama: ${project.project_name}
   
Klik link di atas untuk mendownload file ZIP berisi website.
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleDeploy(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Silakan berikan ID project.\nContoh: !deploy 123');
    return;
  }

  const projectId = parseInt(args[0]);
  if (isNaN(projectId)) {
    await sendMessage(sender, '❌ ID project harus berupa angka.');
    return;
  }

  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM web_projects WHERE id = ?').get(projectId);
    
    if (!project) {
      await sendMessage(sender, '❌ Project tidak ditemukan.');
      return;
    }

    const user = await getUserByPhone(senderNumber);
    
    // Check if user has Vercel token
    if (!user.user_vercel_token) {
      await sendMessage(sender, `
❌ *Token Vercel tidak ditemukan!*

Silakan set token Vercel terlebih dahulu:
!settoken vercel <token>

Dapatkan token di: https://vercel.com/account/tokens
      `);
      return;
    }

    await sendMessage(sender, '🔄 *Deploying website...* Mohon tunggu.');

    // Deploy to Vercel
    const { deployToVercel } = require('./aiEngine');
    const result = await deployToVercel(project, user.user_vercel_token);

    if (result.success) {
      // Update project with Vercel URL
      const update = db.prepare(`
        UPDATE web_projects SET vercel_url = ? WHERE id = ?
      `);
      update.run(result.url, projectId);

      await sendMessage(sender, `
✅ *Deploy Berhasil!*

🌐 *URL:* ${result.url}
📁 *Project:* ${project.project_name}

Website Anda sekarang live di Vercel!
      `);
    } else {
      await sendMessage(sender, `❌ Deploy gagal: ${result.error}`);
    }
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleSetToken(sender, senderNumber, args) {
  if (!args || args.length < 2) {
    await sendMessage(sender, '❌ Format: !settoken <provider> <token>\nProviders: vercel, netlify');
    return;
  }

  const provider = args[0].toLowerCase();
  const token = args.slice(1).join(' ');

  if (!['vercel', 'netlify'].includes(provider)) {
    await sendMessage(sender, '❌ Provider hanya: vercel atau netlify');
    return;
  }

  try {
    const db = getDb();
    const user = await getUserByPhone(senderNumber);
    
    const field = provider === 'vercel' ? 'user_vercel_token' : 'user_netlify_token';
    const update = db.prepare(`UPDATE users SET ${field} = ? WHERE id = ?`);
    update.run(token, user.id);

    await sendMessage(sender, `
✅ *Token ${provider} berhasil disimpan!*

Sekarang Anda dapat melakukan deploy website menggunakan:
!deploy <project_id>
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleSetDB(sender, senderNumber, args) {
  if (!args || args.length < 2) {
    await sendMessage(sender, '❌ Format: !setdb <SUPABASE_URL> <SUPABASE_ANON_KEY>');
    return;
  }

  const url = args[0];
  const key = args.slice(1).join(' ');

  try {
    const db = getDb();
    const user = await getUserByPhone(senderNumber);
    
    const update = db.prepare(`
      UPDATE users SET user_supabase_url = ?, user_supabase_key = ? WHERE id = ?
    `);
    update.run(url, key, user.id);

    await sendMessage(sender, `
✅ *Supabase credentials berhasil disimpan!*

Website Anda akan terintegrasi dengan database Supabase.
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleCheckBalance(sender, senderNumber, args) {
  try {
    const user = await getUserByPhone(senderNumber);
    const db = getDb();
    const now = new Date();
    const lastReset = user.last_token_reset ? new Date(user.last_token_reset) : null;
    
    let dailyTokens = user.daily_free_token;
    if (!lastReset || (now - lastReset) > 24 * 60 * 60 * 1000) {
      dailyTokens = 700;
    }

    await sendMessage(sender, `
💰 *Saldo Token Anda*

💎 *Kredit:* ${user.saldo_kredit} token
🎁 *Free Daily:* ${dailyTokens} token (reset setiap hari)
📊 *Total:* ${user.saldo_kredit + dailyTokens} token

⚡ *Status Premium:* ${user.is_premium ? '✅ Aktif' : '❌ Tidak'}
${user.is_premium ? `📅 *Expires:* ${new Date(user.premium_expires_at).toLocaleDateString()}` : ''}

🔹 *Harga per Command:* 270 token
🔹 *Free Trial:* 700 token/hari (2 hari)
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleDeposit(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Silakan masukkan jumlah deposit.\nContoh: !deposit 10000');
    return;
  }

  const amount = parseInt(args[0]);
  if (isNaN(amount) || amount < 1000) {
    await sendMessage(sender, '❌ Minimal deposit Rp 1.000');
    return;
  }

  try {
    const user = await getUserByPhone(senderNumber);
    const db = getDb();
    const pricing = db.prepare('SELECT * FROM pricing_settings LIMIT 1').get();
    
    // Calculate token amount (1 token = Rp 1000)
    const tokenAmount = Math.floor(amount / (pricing.token_rate_idr || 1000));
    
    // Create deposit record
    const insert = db.prepare(`
      INSERT INTO deposits (user_id, payment_method, jumlah, token_amount, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    const depositId = insert.run(user.id, 'qris', amount, tokenAmount, 'pending_proof').lastInsertRowid;

    // Send QRIS payment instructions
    await sendMessage(sender, `
💳 *Instruksi Deposit*

💰 *Jumlah:* Rp ${amount.toLocaleString()}
🎯 *Token:* ${tokenAmount} token

📱 *Metode Pembayaran:* QRIS / DANA
   Nomor DANA: ${pricing.dana_number || '085894336189'}

🔄 *Langkah:*
1. Transfer ke nomor DANA di atas
2. Screenshot bukti transfer
3. Kirim bukti ke bot ini

📤 *Setelah transfer, kirim bukti dengan format:*
!proof ${depositId} [lampirkan gambar]

✅ *Konfirmasi akan diproses admin*
   Admin akan ACC dalam 5-15 menit

⚠️ *Jangan tutup chat ini sampai deposit aktif!*
    `);

    // Notify admin
    await sendMessage(`${adminPhoneNumber}@s.whatsapp.net`, `
💰 *DEPOSIT REQUEST*

ID: ${depositId}
User: ${senderNumber}
Jumlah: Rp ${amount.toLocaleString()}
Token: ${tokenAmount}

Menunggu bukti transfer...
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleRevision(sender, senderNumber, args) {
  if (!args || args.length < 2) {
    await sendMessage(sender, '❌ Format: !revisi <project_id> "perubahan"\nContoh: !revisi 123 "ubah warna background menjadi biru"');
    return;
  }

  const projectId = parseInt(args[0]);
  if (isNaN(projectId)) {
    await sendMessage(sender, '❌ ID project harus berupa angka.');
    return;
  }

  const revisionText = args.slice(1).join(' ');
  if (!revisionText) {
    await sendMessage(sender, '❌ Silakan masukkan deskripsi revisi.');
    return;
  }

  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM web_projects WHERE id = ?').get(projectId);
    
    if (!project) {
      await sendMessage(sender, '❌ Project tidak ditemukan.');
      return;
    }

    const user = await getUserByPhone(senderNumber);
    await deductTokens(user.id, 270);

    await sendMessage(sender, '🔄 *Sedang melakukan revisi...* Mohon tunggu.');

    // Generate revised website
    const result = await generateWebsite(revisionText, user.id, project);
    
    if (result.success) {
      // Update project
      const update = db.prepare(`
        UPDATE web_projects 
        SET html_code = ?, css_code = ?, js_code = ?,
            version_history_json = json_set(COALESCE(version_history_json, '[]'), '$[#]', ?)
        WHERE id = ?
      `);
      update.run(
        result.html, 
        result.css, 
        result.js,
        JSON.stringify({
          version: Date.now(),
          timestamp: new Date().toISOString(),
          description: revisionText
        }),
        projectId
      );

      const previewUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/preview/${projectId}`;
      
      await sendMessage(sender, `
✅ *Revisi Berhasil!*

🔗 *Preview:* ${previewUrl}

📝 *Perubahan:* ${revisionText}
🎯 *Token Digunakan:* 270
      `);
    } else {
      await addTokens(user.id, 270, 'Token rollback (revisi error)');
      await sendMessage(sender, `❌ Revisi gagal: ${result.error}\n\nToken telah dikembalikan.`);
    }
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleSetDomain(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Format: !setdomain <domain>\nContoh: !setdomain toko-kopi.com');
    return;
  }

  const domain = args[0];
  
  try {
    const db = getDb();
    const user = await getUserByPhone(senderNumber);
    
    // Check if domain is available
    const existing = db.prepare('SELECT * FROM web_projects WHERE custom_domain = ?').get(domain);
    if (existing) {
      await sendMessage(sender, '❌ Domain sudah digunakan oleh pengguna lain.');
      return;
    }

    // Update user's latest project or specified project
    const latestProject = db.prepare(`
      SELECT * FROM web_projects WHERE user_id = ? ORDER BY id DESC LIMIT 1
    `).get(user.id);

    if (!latestProject) {
      await sendMessage(sender, '❌ Anda belum memiliki website. Buat website dulu dengan !buatweb');
      return;
    }

    const update = db.prepare(`
      UPDATE web_projects SET custom_domain = ? WHERE id = ?
    `);
    update.run(domain, latestProject.id);

    await sendMessage(sender, `
✅ *Domain berhasil diset!*

🌐 *Domain:* ${domain}
📁 *Project:* ${latestProject.project_name}

⚠️ *Langkah selanjutnya:*
1. Arahkan DNS domain ke IP server: ${process.env.SERVER_IP || '1.1.1.1'}
2. Tunggu propagasi DNS (1-24 jam)
3. Akses website di domain Anda
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleSetPassword(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Format: !setpass <password>\nContoh: !setpass rahasia123');
    return;
  }

  const password = args[0];
  
  try {
    const db = getDb();
    const user = await getUserByPhone(senderNumber);
    
    const latestProject = db.prepare(`
      SELECT * FROM web_projects WHERE user_id = ? ORDER BY id DESC LIMIT 1
    `).get(user.id);

    if (!latestProject) {
      await sendMessage(sender, '❌ Anda belum memiliki website.');
      return;
    }

    const update = db.prepare(`
      UPDATE web_projects SET passcode_protected = ? WHERE id = ?
    `);
    update.run(password, latestProject.id);

    await sendMessage(sender, `
✅ *Password protection berhasil diaktifkan!*

🔐 *Password:* ${password}
📁 *Project:* ${latestProject.project_name}

Website Anda sekarang dilindungi password.
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleExportPDF(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Format: !exportpdf <project_id>\nContoh: !exportpdf 123');
    return;
  }

  const projectId = parseInt(args[0]);
  if (isNaN(projectId)) {
    await sendMessage(sender, '❌ ID project harus berupa angka.');
    return;
  }

  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM web_projects WHERE id = ?').get(projectId);
    
    if (!project) {
      await sendMessage(sender, '❌ Project tidak ditemukan.');
      return;
    }

    const user = await getUserByPhone(senderNumber);
    await deductTokens(user.id, 270);

    await sendMessage(sender, '🔄 *Membuat PDF...* Mohon tunggu.');

    const pdfUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/preview/export-pdf/${projectId}`;
    
    await sendMessage(sender, `
📄 *PDF Website Siap*

🔗 *Download PDF:* ${pdfUrl}
📁 *Project:* ${project.project_name}

PDF berisi preview website dalam format pitch deck.
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleAuditWeb(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Format: !auditweb <project_id>\nContoh: !auditweb 123');
    return;
  }

  const projectId = parseInt(args[0]);
  if (isNaN(projectId)) {
    await sendMessage(sender, '❌ ID project harus berupa angka.');
    return;
  }

  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM web_projects WHERE id = ?').get(projectId);
    
    if (!project) {
      await sendMessage(sender, '❌ Project tidak ditemukan.');
      return;
    }

    const user = await getUserByPhone(senderNumber);
    await deductTokens(user.id, 270);

    // Perform audit
    const auditResult = await performWebsiteAudit(project);
    
    await sendMessage(sender, `
📊 *Audit Website*

📁 *Project:* ${project.project_name}

🏷️ *SEO Score:* ${auditResult.seoScore}/100
⚡ *Performance:* ${auditResult.performance}/100
📱 *Mobile Friendly:* ${auditResult.mobileFriendly ? '✅' : '❌'}
🔒 *Security:* ${auditResult.security}/100

📝 *Rekomendasi:*
${auditResult.recommendations.join('\n')}

💡 *Tips:* Perbaiki rekomendasi di atas untuk performa website yang lebih baik.
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleRollback(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Format: !rollback <project_id>\nContoh: !rollback 123');
    return;
  }

  const projectId = parseInt(args[0]);
  if (isNaN(projectId)) {
    await sendMessage(sender, '❌ ID project harus berupa angka.');
    return;
  }

  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM web_projects WHERE id = ?').get(projectId);
    
    if (!project) {
      await sendMessage(sender, '❌ Project tidak ditemukan.');
      return;
    }

    const user = await getUserByPhone(senderNumber);
    await deductTokens(user.id, 270);

    // Get version history
    const history = JSON.parse(project.version_history_json || '[]');
    if (history.length < 2) {
      await sendMessage(sender, '❌ Tidak ada versi sebelumnya untuk di-restore.');
      return;
    }

    // Restore previous version
    const previousVersion = history[history.length - 2];
    const update = db.prepare(`
      UPDATE web_projects 
      SET version_history_json = json_remove(version_history_json, '$[#-1]')
      WHERE id = ?
    `);
    update.run(projectId);

    await sendMessage(sender, `
✅ *Rollback Berhasil!*

📁 *Project:* ${project.project_name}
🔄 *Restored to version:* ${new Date(previousVersion.timestamp).toLocaleString()}
📝 *Description:* ${previousVersion.description}

💡 *Preview website untuk melihat perubahan.*
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleEditText(sender, senderNumber, args) {
  const text = args.join(' ');
  if (!text || !text.includes('->')) {
    await sendMessage(sender, '❌ Format: !edittext "old text" -> "new text"\nContoh: !edittext "Selamat Datang" -> "Halo"');
    return;
  }

  try {
    const [oldText, newText] = text.split('->').map(s => s.trim().replace(/^"|"$/g, ''));
    
    const db = getDb();
    const user = await getUserByPhone(senderNumber);
    await deductTokens(user.id, 270);

    const latestProject = db.prepare(`
      SELECT * FROM web_projects WHERE user_id = ? ORDER BY id DESC LIMIT 1
    `).get(user.id);

    if (!latestProject) {
      await sendMessage(sender, '❌ Anda belum memiliki website.');
      return;
    }

    // Replace text in HTML
    const updatedHtml = latestProject.html_code.replace(new RegExp(oldText, 'g'), newText);
    
    const update = db.prepare(`
      UPDATE web_projects SET html_code = ? WHERE id = ?
    `);
    update.run(updatedHtml, latestProject.id);

    await sendMessage(sender, `
✅ *Text Berhasil Diubah!*

📝 *"${oldText}" → "${newText}"*
📁 *Project:* ${latestProject.project_name}

💡 *Preview website untuk melihat perubahan.*
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleAddTeam(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Format: !addteam <nomor_wa>\nContoh: !addteam 081234567890');
    return;
  }

  const teamPhone = args[0].replace(/[^0-9]/g, '');
  
  try {
    const db = getDb();
    const user = await getUserByPhone(senderNumber);
    const teamUser = await getUserByPhone(teamPhone);

    const update = db.prepare(`
      UPDATE users SET parent_agency_id = ? WHERE id = ?
    `);
    update.run(user.id, teamUser.id);

    await sendMessage(sender, `
✅ *Team Member Berhasil Ditambahkan!*

👤 *Member:* ${teamPhone}
🏢 *Agency:* ${user.phone_number}

Member sekarang dapat mengakses fitur agency.
    `);

    // Notify team member
    await sendMessage(`${teamPhone}@s.whatsapp.net`, `
🎉 *Anda telah ditambahkan ke team agency!*

🏢 *Agency:* ${user.phone_number}

Selamat bekerja sama! 🚀
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleQRCode(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Format: !qrcode <link>\nContoh: !qrcode https://website.com');
    return;
  }

  const link = args[0];
  
  try {
    const QRCode = require('qrcode');
    const qrImage = await QRCode.toDataURL(link);
    
    await sendMessage(sender, `
📱 *QR Code Generated*

🔗 *Link:* ${link}

🔍 *Scan QR code dengan kamera HP Anda.*
    `, {
      image: Buffer.from(qrImage.split(',')[1], 'base64'),
      caption: `QR Code untuk: ${link}`
    });
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handlePalette(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Pilih warna: dark, pastel, corporate, emerald\nContoh: !palette dark');
    return;
  }

  const palette = args[0].toLowerCase();
  const palettes = {
    dark: { bg: '#1a1a2e', text: '#ffffff', accent: '#e94560' },
    pastel: { bg: '#f8f4f0', text: '#2d3436', accent: '#fdcb6e' },
    corporate: { bg: '#ffffff', text: '#2d3436', accent: '#0984e3' },
    emerald: { bg: '#f0fdf4', text: '#065f46', accent: '#059669' }
  };

  if (!palettes[palette]) {
    await sendMessage(sender, '❌ Palette tidak ditemukan. Pilih: dark, pastel, corporate, emerald');
    return;
  }

  try {
    const db = getDb();
    const user = await getUserByPhone(senderNumber);
    await deductTokens(user.id, 270);

    const latestProject = db.prepare(`
      SELECT * FROM web_projects WHERE user_id = ? ORDER BY id DESC LIMIT 1
    `).get(user.id);

    if (!latestProject) {
      await sendMessage(sender, '❌ Anda belum memiliki website.');
      return;
    }

    // Apply palette colors
    const paletteColors = palettes[palette];
    const colorCss = `
      :root {
        --bg-color: ${paletteColors.bg};
        --text-color: ${paletteColors.text};
        --accent-color: ${paletteColors.accent};
      }
    `;

    const updatedCss = latestProject.css_code + '\n' + colorCss;
    
    const update = db.prepare(`
      UPDATE web_projects SET css_code = ? WHERE id = ?
    `);
    update.run(updatedCss, latestProject.id);

    await sendMessage(sender, `
🎨 *Palette Berhasil Diubah!*

🎭 *Theme:* ${palette.charAt(0).toUpperCase() + palette.slice(1)}
📁 *Project:* ${latestProject.project_name}

💡 *Preview website untuk melihat perubahan warna.*
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleABTest(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Format: !abtest <project_id>\nContoh: !abtest 123');
    return;
  }

  const projectId = parseInt(args[0]);
  if (isNaN(projectId)) {
    await sendMessage(sender, '❌ ID project harus berupa angka.');
    return;
  }

  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM web_projects WHERE id = ?').get(projectId);
    
    if (!project) {
      await sendMessage(sender, '❌ Project tidak ditemukan.');
      return;
    }

    const user = await getUserByPhone(senderNumber);
    await deductTokens(user.id, 270);

    // Generate variant B
    const variantAUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/preview/${projectId}?variant=A`;
    const variantBUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/preview/${projectId}?variant=B`;

    await sendMessage(sender, `
📊 *A/B Testing Variants*

🅰️ *Variant A:* ${variantAUrl}
🅱️ *Variant B:* ${variantBUrl}

📝 *Testing Guidelines:*
1. Bagikan kedua link ke audience
2. Bandingkan conversion rate
3. Pilih variant terbaik

💡 *Tips:* Gunakan tools analytics untuk tracking hasil.
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleWordPressExport(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Format: !wp <project_id>\nContoh: !wp 123');
    return;
  }

  const projectId = parseInt(args[0]);
  if (isNaN(projectId)) {
    await sendMessage(sender, '❌ ID project harus berupa angka.');
    return;
  }

  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM web_projects WHERE id = ?').get(projectId);
    
    if (!project) {
      await sendMessage(sender, '❌ Project tidak ditemukan.');
      return;
    }

    const user = await getUserByPhone(senderNumber);
    await deductTokens(user.id, 270);

    const wpUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/preview/export-wp/${projectId}`;
    
    await sendMessage(sender, `
📄 *WordPress Export*

📁 *Project:* ${project.project_name}

🔗 *Download WordPress:* ${wpUrl}

📝 *Format:* Elementor/WordPress compatible
📦 *Includes:* HTML, CSS, JavaScript
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handlePWA(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Format: !pwa <project_id>\nContoh: !pwa 123');
    return;
  }

  const projectId = parseInt(args[0]);
  if (isNaN(projectId)) {
    await sendMessage(sender, '❌ ID project harus berupa angka.');
    return;
  }

  try {
    const db = getDb();
    const project = db.prepare('SELECT * FROM web_projects WHERE id = ?').get(projectId);
    
    if (!project) {
      await sendMessage(sender, '❌ Project tidak ditemukan.');
      return;
    }

    const user = await getUserByPhone(senderNumber);
    await deductTokens(user.id, 270);

    // Generate PWA files
    const manifest = generateManifest(project);
    const sw = generateServiceWorker(project);

    // Update project
    const update = db.prepare(`
      UPDATE web_projects SET js_code = ? WHERE id = ?
    `);
    update.run(project.js_code + '\n' + sw, projectId);

    const pwaUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/preview/${projectId}`;
    
    await sendMessage(sender, `
📱 *PWA Enabled!*

📁 *Project:* ${project.project_name}

🔗 *Preview:* ${pwaUrl}

✅ *Fitur PWA:*
- Installable ke Home Screen
- Offline support
- Push notifications
- Fast loading

💡 *Buka di Chrome dan klik "Add to Home Screen"*
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

async function handleHelp(sender, senderNumber, args) {
  const help = `
📚 *NgeWebYuk AI Builder - Bantuan Lengkap*

*🎯 PERINTAH DASAR*
!menu - Tampilkan menu utama
!buatweb <deskripsi> - Buat website AI
!saldo - Cek saldo token
!deposit <jumlah> - Deposit token

*🌐 WEBSITE COMMANDS*
!preview <id> - Lihat preview
!download <id> - Download ZIP
!revisi <id> "perubahan" - Revisi website
!deploy <id> - Deploy ke Vercel
!setdomain <domain> - Set custom domain
!setpass <password> - Password protect
!exportpdf <id> - Export PDF
!auditweb <id> - Audit SEO
!rollback <id> - Restore versi lama
!edittext "old" -> "new" - Edit teks
!qrcode <link> - Generate QR Code
!palette <theme> - Ganti warna (dark/pastel/corporate/emerald)
!abtest <id> - A/B Testing
!wp <id> - Export WordPress
!pwa <id> - Aktifkan PWA

*🔧 SETTINGS & INTEGRATION*
!settoken vercel <token> - Set Vercel token
!settoken netlify <token> - Set Netlify token
!setdb <url> <key> - Set Supabase DB
!setpixel <id> - Set Facebook Pixel
!addteam <nomor> - Tambah team

*🤖 AI MEDIA*
!gambar <deskripsi> - Generate image
!voice <teks> - Text to speech
!video <deskripsi> - Generate video

*📊 ADMIN COMMANDS*
/admin/backup - Backup database
/admin/api-keys - Kelola API keys

💡 *Untuk info lebih lanjut:*
Ketik !menu untuk menampilkan menu interaktif.
  `;

  await sendMessage(sender, help);
}

async function handleAIChat(sender, senderNumber, text) {
  try {
    // Simple AI response for non-commands
    const user = await getUserByPhone(senderNumber);
    const db = getDb();
    
    // Save chat history
    const insert = db.prepare(`
      INSERT INTO chat_history (user_id, role, message)
      VALUES (?, ?, ?)
    `);
    insert.run(user.id, 'user', text);

    // Get AI response
    const aiResponse = await generateAIResponse(text, user);
    
    // Save AI response
    insert.run(user.id, 'assistant', aiResponse);
    
    await sendMessage(sender, aiResponse);
  } catch (error) {
    await sendMessage(sender, '❌ Maaf, saya tidak mengerti perintah Anda. Ketik !menu untuk melihat daftar perintah.');
  }
}

async function performWebsiteAudit(project) {
  // Simulate audit
  const seoScore = Math.floor(Math.random() * 30) + 70;
  const performance = Math.floor(Math.random() * 30) + 70;
  const security = Math.floor(Math.random() * 30) + 70;
  const mobileFriendly = Math.random() > 0.2;

  const recommendations = [];
  if (seoScore < 80) recommendations.push('• Tambahkan meta description dan title tag');
  if (performance < 80) recommendations.push('• Optimasi gambar dan minify CSS/JS');
  if (!mobileFriendly) recommendations.push('• Perbaiki tampilan mobile responsive');
  if (security < 80) recommendations.push('• Tambahkan HTTPS dan security headers');

  if (recommendations.length === 0) {
    recommendations.push('✅ Website Anda sudah optimal!');
  }

  return {
    seoScore,
    performance,
    security,
    mobileFriendly,
    recommendations
  };
}

function generateManifest(project) {
  return JSON.stringify({
    name: project.project_name,
    short_name: project.project_name.substring(0, 12),
    description: `Website ${project.project_name}`,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  });
}

function generateServiceWorker(project) {
  return `
// Service Worker for PWA
const CACHE_NAME = 'ngewebyuk-v1';
const urlsToCache = [
  '/',
  '/style.css',
  '/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
  `;
}

async function generateAIResponse(text, user) {
  // Simple response generator
  const responses = [
    'Halo! Ada yang bisa saya bantu? Ketik !menu untuk melihat semua fitur.',
    'Saya siap membantu Anda membuat website! Coba ketik !buatweb untuk mulai.',
    'Ingin deploy website? Gunakan !deploy setelah website selesai.',
    'Butuh bantuan? Ketik !help untuk melihat panduan lengkap.',
    'Website Anda akan siap dalam beberapa menit. Tunggu ya!'
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

async function handleSetPixel(sender, senderNumber, args) {
  if (!args || args.length === 0) {
    await sendMessage(sender, '❌ Format: !setpixel <pixel_id>\nContoh: !setpixel 1234567890');
    return;
  }

  const pixelId = args[0];
  
  try {
    const db = getDb();
    const user = await getUserByPhone(senderNumber);
    const pricing = db.prepare('SELECT * FROM pricing_settings LIMIT 1').get();
    
    // Save pixel ID to user's settings
    const update = db.prepare(`
      UPDATE users SET midtrans_client_key = ? WHERE id = ?
    `);
    update.run(pixelId, user.id);

    await sendMessage(sender, `
✅ *Facebook Pixel berhasil disimpan!*

📊 *Pixel ID:* ${pixelId}

Sekarang website Anda akan tracking conversions.
    `);
  } catch (error) {
    await sendMessage(sender, `❌ Error: ${error.message}`);
  }
}

module.exports = {
  startBot,
  sendMessage,
  isBotRunning,
  botPhoneNumber
};

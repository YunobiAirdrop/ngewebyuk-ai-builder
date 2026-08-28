const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { sendMessage } = require('../services/waAdapter');

// Webhook endpoint for WhatsApp
router.post('/', async (req, res) => {
  try {
    const { message, sender, type } = req.body;
    
    if (!message || !sender) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    console.log(`📩 Webhook received from ${sender}: ${message}`);

    // Process the message
    const response = await processWebhookMessage(sender, message, type);
    
    res.json({ success: true, response });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Google Sheets webhook endpoint
router.post('/google-sheets', async (req, res) => {
  try {
    const { data, sheetId } = req.body;
    
    if (!data || !sheetId) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    // Forward to Google Sheets
    const response = await forwardToGoogleSheets(data, sheetId);
    
    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Google Sheets webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Payment webhook
router.post('/payment', async (req, res) => {
  try {
    const { orderId, status, amount, paymentMethod } = req.body;
    
    if (!orderId || !status) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    // Process payment status
    const result = await processPaymentWebhook(orderId, status, amount, paymentMethod);
    
    res.json({ success: true, result });
  } catch (error) {
    console.error('Payment webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get webhook status
router.get('/status', authenticate, (req, res) => {
  res.json({
    success: true,
    status: 'active',
    botNumber: process.env.BOT_PHONE,
    adminNumber: process.env.ADMIN_PHONE
  });
});

// Deposit approval webhook (for admin)
router.post('/admin/deposit-approve', async (req, res) => {
  try {
    const { depositId, action } = req.body;
    
    if (!depositId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, error: 'Invalid payload' });
    }

    const db = getDb();
    const deposit = db.prepare('SELECT * FROM deposits WHERE id = ?').get(depositId);
    
    if (!deposit) {
      return res.status(404).json({ success: false, error: 'Deposit not found' });
    }

    if (action === 'approve') {
      // Add tokens to user
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(deposit.user_id);
      const updateUser = db.prepare(`
        UPDATE users SET saldo_kredit = saldo_kredit + ? WHERE id = ?
      `);
      updateUser.run(deposit.token_amount, deposit.user_id);
      
      // Update deposit status
      const updateDeposit = db.prepare(`
        UPDATE deposits SET status = 'completed' WHERE id = ?
      `);
      updateDeposit.run(depositId);
      
      // Notify user
      await sendMessage(`${user.phone_number}@s.whatsapp.net`, `
✅ *Deposit Disetujui!*

💰 *Jumlah:* Rp ${deposit.jumlah.toLocaleString()}
🎯 *Token:* ${deposit.token_amount} token

Saldo token Anda telah bertambah.
Terima kasih telah menggunakan NgeWebYuk! 🚀
      `);
    } else {
      // Reject deposit
      const updateDeposit = db.prepare(`
        UPDATE deposits SET status = 'rejected' WHERE id = ?
      `);
      updateDeposit.run(depositId);
      
      // Notify user
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(deposit.user_id);
      await sendMessage(`${user.phone_number}@s.whatsapp.net`, `
❌ *Deposit Ditolak*

ID: ${depositId}
Alasan: Bukti transfer tidak valid atau tidak sesuai.

Silakan kirim ulang bukti transfer yang valid.
      `);
    }

    res.json({ success: true, action, depositId });
  } catch (error) {
    console.error('Deposit approval error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

async function processWebhookMessage(sender, message, type) {
  // Process webhook message
  return {
    received: true,
    sender,
    message,
    type,
    timestamp: new Date().toISOString()
  };
}

async function forwardToGoogleSheets(data, sheetId) {
  // Forward data to Google Sheets
  return {
    success: true,
    sheetId,
    data,
    timestamp: new Date().toISOString()
  };
}

async function processPaymentWebhook(orderId, status, amount, paymentMethod) {
  // Process payment webhook
  return {
    orderId,
    status,
    amount,
    paymentMethod,
    processed: true,
    timestamp: new Date().toISOString()
  };
}

module.exports = router;

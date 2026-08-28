const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const { requireAdmin, generateToken } = require('../middleware/auth');
const { apiRotator } = require('../middleware/apiRotator');
const path = require('path');
const fs = require('fs');

// Admin login page
router.get('/login', (req, res) => {
  res.render('admin/login', { error: null });
});

// Admin login handler
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.render('admin/login', { error: 'Phone and password required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE phone_number = ?').get(phone);
    
    if (!user) {
      return res.render('admin/login', { error: 'Invalid phone number' });
    }

    // Check if admin
    if (user.phone_number !== process.env.ADMIN_PHONE) {
      return res.render('admin/login', { error: 'Access denied' });
    }

    // Generate token
    const token = generateToken(user.id, user.phone_number);
    
    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('admin/login', { error: 'Login failed' });
  }
});

// Admin logout
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/admin/login');
});

// Admin dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    
    // Get statistics
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const projectCount = db.prepare('SELECT COUNT(*) as count FROM web_projects').get().count;
    const depositCount = db.prepare('SELECT COUNT(*) as count FROM deposits WHERE status = "completed"').get().count;
    const totalRevenue = db.prepare('SELECT SUM(jumlah) as total FROM deposits WHERE status = "completed"').get().total || 0;
    
    const apiKeys = apiRotator.getAllApiKeys();
    const pricing = db.prepare('SELECT * FROM pricing_settings LIMIT 1').get();
    
    res.render('admin/dashboard', {
      userCount,
      projectCount,
      depositCount,
      totalRevenue,
      apiKeys,
      pricing,
      adminPhone: process.env.ADMIN_PHONE,
      botPhone: process.env.BOT_PHONE
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// API Keys management
router.get('/api-keys', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const apiKeys = apiRotator.getAllApiKeys();
    
    res.json({ success: true, data: apiKeys });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api-keys/update', requireAdmin, async (req, res) => {
  try {
    const { id, apiKey, status } = req.body;
    
    if (!id) {
      return res.status(400).json({ success: false, error: 'API key ID required' });
    }

    apiRotator.updateApiKey(id, apiKey, status);
    
    res.json({ success: true, message: 'API key updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/api-keys/add', requireAdmin, async (req, res) => {
  try {
    const { providerName, apiKey, category } = req.body;
    
    if (!providerName || !apiKey || !category) {
      return res.status(400).json({ success: false, error: 'All fields required' });
    }

    apiRotator.addApiKey(providerName, apiKey, category);
    
    res.json({ success: true, message: 'API key added' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/api-keys/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid ID' });
    }

    apiRotator.deleteApiKey(id);
    
    res.json({ success: true, message: 'API key deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Settings management
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM pricing_settings LIMIT 1').get();
    
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/settings/update', requireAdmin, async (req, res) => {
  try {
    const {
      flat_command_cost,
      free_trial_daily_tokens,
      trial_duration_days,
      token_rate_idr,
      bot_wa_number,
      admin_wa_number,
      cloudflare_api_token,
      unsplash_access_key
    } = req.body;

    const db = getDb();
    const update = db.prepare(`
      UPDATE pricing_settings SET
        flat_command_cost = ?,
        free_trial_daily_tokens = ?,
        trial_duration_days = ?,
        token_rate_idr = ?,
        bot_wa_number = ?,
        admin_wa_number = ?,
        cloudflare_api_token = ?,
        unsplash_access_key = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `);
    
    update.run(
      flat_command_cost,
      free_trial_daily_tokens,
      trial_duration_days,
      token_rate_idr,
      bot_wa_number,
      admin_wa_number,
      cloudflare_api_token,
      unsplash_access_key
    );
    
    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Backup database
router.get('/backup', requireAdmin, async (req, res) => {
  try {
    const dbPath = process.env.DATABASE_PATH || './database/database.sqlite';
    const backupPath = `./database/backup_${Date.now()}.sqlite`;
    
    fs.copyFileSync(dbPath, backupPath);
    
    res.download(backupPath, 'database_backup.sqlite', (err) => {
      if (err) {
        console.error('Backup download error:', err);
      }
      // Clean up backup file after download
      fs.unlinkSync(backupPath);
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reseller dashboard
router.get('/reseller', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const resellers = db.prepare('SELECT * FROM users WHERE is_reseller = 1').all();
    
    res.json({ success: true, data: resellers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Users list
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Projects list
router.get('/projects', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const projects = db.prepare(`
      SELECT p.*, u.phone_number as user_phone 
      FROM web_projects p 
      JOIN users u ON p.user_id = u.id 
      ORDER BY p.created_at DESC
    `).all();
    
    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Transactions list
router.get('/transactions', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const transactions = db.prepare(`
      SELECT t.*, u.phone_number as user_phone 
      FROM transactions t 
      JOIN users u ON t.user_id = u.id 
      ORDER BY t.created_at DESC
      LIMIT 100
    `).all();
    
    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deposits list
router.get('/deposits', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const deposits = db.prepare(`
      SELECT d.*, u.phone_number as user_phone 
      FROM deposits d 
      JOIN users u ON d.user_id = u.id 
      ORDER BY d.created_at DESC
      LIMIT 100
    `).all();
    
    res.json({ success: true, data: deposits });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Vouchers management
router.get('/vouchers', requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    const vouchers = db.prepare('SELECT * FROM vouchers').all();
    
    res.json({ success: true, data: vouchers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/vouchers/create', requireAdmin, async (req, res) => {
  try {
    const { code, tokenAmount, maxUses } = req.body;
    
    if (!code || !tokenAmount) {
      return res.status(400).json({ success: false, error: 'Code and token amount required' });
    }

    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO vouchers (code, token_amount, max_uses)
      VALUES (?, ?, ?)
    `);
    insert.run(code, tokenAmount, maxUses || 1);
    
    res.json({ success: true, message: 'Voucher created' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/vouchers/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid ID' });
    }

    const db = getDb();
    const del = db.prepare('DELETE FROM vouchers WHERE id = ?');
    del.run(id);
    
    res.json({ success: true, message: 'Voucher deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'ngewebyuk_super_secret_jwt_key_2024_production';

function generateToken(userId, phoneNumber) {
  return jwt.sign(
    { userId, phoneNumber },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  req.user = decoded;
  next();
}

async function requireAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  
  if (!token) {
    return res.redirect('/admin/login');
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.redirect('/admin/login');
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
  
  if (!user || user.phone_number !== process.env.ADMIN_PHONE) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }

  req.user = user;
  next();
}

async function getUserByPhone(phoneNumber) {
  const db = getDb();
  let user = db.prepare('SELECT * FROM users WHERE phone_number = ?').get(phoneNumber);
  
  if (!user) {
    // Create new user
    const insert = db.prepare(`
      INSERT INTO users (phone_number, saldo_kredit, daily_free_token, trial_start_date)
      VALUES (?, ?, ?, ?)
    `);
    const result = insert.run(phoneNumber, 0, 700, new Date().toISOString());
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  }
  
  return user;
}

async function deductTokens(userId, amount) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  
  if (!user) {
    throw new Error('User not found');
  }

  // Check daily free token
  const now = new Date();
  const lastReset = user.last_token_reset ? new Date(user.last_token_reset) : null;
  
  if (!lastReset || (now - lastReset) > 24 * 60 * 60 * 1000) {
    // Reset daily tokens
    const update = db.prepare(`
      UPDATE users SET daily_free_token = ?, last_token_reset = ? WHERE id = ?
    `);
    update.run(700, now.toISOString(), userId);
    user.daily_free_token = 700;
  }

  // Check if user has enough tokens
  const totalTokens = user.saldo_kredit + user.daily_free_token;
  if (totalTokens < amount) {
    throw new Error('Insufficient tokens');
  }

  // Deduct from daily free token first
  let remainingAmount = amount;
  let dailyDeduction = Math.min(user.daily_free_token, remainingAmount);
  let creditDeduction = remainingAmount - dailyDeduction;

  const update = db.prepare(`
    UPDATE users SET daily_free_token = daily_free_token - ?, saldo_kredit = saldo_kredit - ? WHERE id = ?
  `);
  update.run(dailyDeduction, creditDeduction, userId);

  // Log transaction
  const log = db.prepare(`
    INSERT INTO transactions (user_id, type, amount, description)
    VALUES (?, ?, ?, ?)
  `);
  log.run(userId, 'debit', amount, 'AI command usage');

  return true;
}

async function addTokens(userId, amount, description) {
  const db = getDb();
  const update = db.prepare(`
    UPDATE users SET saldo_kredit = saldo_kredit + ? WHERE id = ?
  `);
  update.run(amount, userId);

  const log = db.prepare(`
    INSERT INTO transactions (user_id, type, amount, description)
    VALUES (?, ?, ?, ?)
  `);
  log.run(userId, 'credit', amount, description);

  return true;
}

module.exports = {
  generateToken,
  verifyToken,
  authenticate,
  requireAdmin,
  getUserByPhone,
  deductTokens,
  addTokens
};

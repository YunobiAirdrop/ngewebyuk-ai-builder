require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// Import routes
const webhookRoutes = require('./routes/webhook');
const previewRoutes = require('./routes/preview');
const adminRoutes = require('./routes/admin');

// Routes
app.use('/webhook', webhookRoutes);
app.use('/preview', previewRoutes);
app.use('/admin', adminRoutes);

// Health check
app.get('/ping', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'NgeWebYuk AI Builder',
    version: '1.0.0',
    status: 'running'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Ensure required directories exist
const directories = ['uploads', 'uploads/proof', 'database', 'public', 'views/admin'];
directories.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Initialize database
const { initDatabase } = require('./config/database');
initDatabase();

// Initialize WhatsApp bot
const { startBot } = require('./services/waAdapter');

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 NgeWebYuk AI Builder running on port ${PORT}`);
  console.log(`📱 Admin Panel: http://localhost:${PORT}/admin/login`);
  console.log(`🤖 WhatsApp Bot: ${process.env.BOT_PHONE}`);
  console.log(`👤 Admin Phone: ${process.env.ADMIN_PHONE}`);
  
  // Start WhatsApp bot after server is ready
  setTimeout(() => {
    startBot();
  }, 2000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;

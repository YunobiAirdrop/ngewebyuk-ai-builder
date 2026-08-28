const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

// Store QR data in memory
let qrData = null;
let qrTimestamp = null;
let isConnected = false;

// Function to set QR data from waAdapter
function setQRData(qr) {
  qrData = qr;
  qrTimestamp = new Date().toISOString();
  isConnected = false;
  console.log('✅ QR Code data saved for admin panel');
}

// Function to set connection status
function setConnected(status) {
  isConnected = status;
  if (status) {
    qrData = null;
  }
}

// Check if user is admin (simple check)
function isAdmin(req) {
  // In production, use proper auth
  return true;
}

// Get QR Code for admin panel
router.get('/get-qr', async (req, res) => {
  try {
    // Simple admin check - in production use proper auth
    if (!isAdmin(req)) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (isConnected) {
      return res.json({ 
        success: true, 
        connected: true,
        message: 'WhatsApp bot is already connected'
      });
    }

    if (!qrData) {
      return res.json({ 
        success: false, 
        connected: false,
        message: 'QR Code not available yet. Please wait...',
        qrImage: null
      });
    }

    const qrImage = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    res.json({ 
      success: true, 
      connected: false,
      qrImage: qrImage,
      timestamp: qrTimestamp,
      message: 'Scan QR Code with WhatsApp to connect'
    });
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get connection status
router.get('/status', async (req, res) => {
  res.json({
    success: true,
    connected: isConnected,
    qrAvailable: !!qrData,
    botNumber: process.env.BOT_PHONE || '089514953909'
  });
});

// Force disconnect
router.post('/disconnect', async (req, res) => {
  try {
    isConnected = false;
    qrData = null;
    res.json({ success: true, message: 'Bot disconnected. Restart to reconnect.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = { router, setQRData, setConnected };

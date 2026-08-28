const express = require('express');
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
    await sendWAMessage(sender, `✅ Website Selesai! Live Preview: ${process.env.BASE_URL}/preview/${previewId}`);
  }
  res.status(200).json({ status: 'success' });
});

module.exports = router;
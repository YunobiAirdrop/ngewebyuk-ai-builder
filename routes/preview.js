const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/preview/:siteId', (req, res) => {
  db.get('SELECT * FROM web_projects WHERE preview_id = ?', [req.params.siteId], (err, project) => {
    if (err || !project) return res.status(404).render('error', { message: 'Halaman web tidak ditemukan.' });
    res.send(project.html_code);
  });
});

module.exports = router;
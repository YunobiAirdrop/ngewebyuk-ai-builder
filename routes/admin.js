const express = require('express');
const router = express.Router();

router.get('/login', (req, res) => res.render('admin/login', { error: null }));
router.get('/dashboard', (req, res) => res.render('admin/dashboard'));

module.exports = router;
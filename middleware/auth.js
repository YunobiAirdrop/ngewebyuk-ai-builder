const jwt = require('jsonwebtoken');

function authenticateAdminJWT(req, res, next) {
  const token = req.cookies?.adminToken || req.headers['authorization']?.split(' ')[1];
  if (!token) return res.redirect('/admin/login');

  jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
    if (err) return res.redirect('/admin/login');
    req.user = user;
    next();
  });
}

module.exports = { authenticateAdminJWT };
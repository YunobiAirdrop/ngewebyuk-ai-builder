const db = require('../config/database');

function getActiveApiKey(categoryFunction) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM api_keys WHERE category_function = ? AND status = 'active' ORDER BY usage_count ASC LIMIT 1",
      [categoryFunction],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve({ provider_name: 'Fallback Engine', api_key: 'DEFAULT' });
        db.run('UPDATE api_keys SET usage_count = usage_count + 1 WHERE id = ?', [row.id]);
        resolve(row);
      }
    );
  });
}

module.exports = { getActiveApiKey };
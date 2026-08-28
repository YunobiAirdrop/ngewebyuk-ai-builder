const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../database.sqlite');
const schemaPath = path.resolve(__dirname, '../database/schema.sql');

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  if (fs.existsSync(schemaPath)) {
    const sql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(sql, (err) => {
      if (err) console.error('[Database Schema Error]:', err.message);
    });
  }
});

module.exports = db;
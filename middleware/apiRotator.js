const { getDb } = require('../config/database');

const API_CATEGORIES = {
  TEXT_CHAT: 'text_chat',
  WEB_BUILDER: 'web_builder',
  VISION: 'vision',
  IMAGE_GENERATOR: 'image_generator',
  VIDEO_GENERATOR: 'video_generator',
  VOICE_ENGINE: 'voice_engine',
  DOCUMENT_ANALYZER: 'document_analyzer',
  INFRA_DEPLOY: 'infra_deploy'
};

class ApiRotator {
  constructor() {
    this.cache = {};
    this.cacheTimeout = 300000; // 5 minutes
  }

  getActiveApiKeys(category) {
    const db = getDb();
    const keys = db.prepare(`
      SELECT * FROM api_keys 
      WHERE category_function = ? AND status = 1
      ORDER BY usage_count ASC
    `).all(category);
    return keys;
  }

  getActiveApiKey(category) {
    const now = Date.now();
    const cacheKey = `api_${category}`;
    
    // Check cache
    if (this.cache[cacheKey] && (now - this.cache[cacheKey].timestamp) < this.cacheTimeout) {
      return this.cache[cacheKey].key;
    }

    const keys = this.getActiveApiKeys(category);
    
    if (keys.length === 0) {
      return null;
    }

    // Get the least used key
    const selectedKey = keys[0];
    
    // Update usage count
    const db = getDb();
    const update = db.prepare(`
      UPDATE api_keys SET usage_count = usage_count + 1 WHERE id = ?
    `);
    update.run(selectedKey.id);

    // Update cache
    this.cache[cacheKey] = {
      key: selectedKey,
      timestamp: now
    };

    return selectedKey;
  }

  async rotateOnError(category, failedKeyId) {
    const db = getDb();
    
    // Mark key as failed temporarily
    const update = db.prepare(`
      UPDATE api_keys SET status = 0 WHERE id = ?
    `);
    update.run(failedKeyId);

    // Clear cache for this category
    const cacheKey = `api_${category}`;
    delete this.cache[cacheKey];

    // Get next available key
    return this.getActiveApiKey(category);
  }

  async resetFailedKey(keyId) {
    const db = getDb();
    const update = db.prepare(`
      UPDATE api_keys SET status = 1 WHERE id = ?
    `);
    update.run(keyId);
    
    // Clear all cache
    this.cache = {};
  }

  getAllApiKeys() {
    const db = getDb();
    return db.prepare('SELECT * FROM api_keys ORDER BY category_function, provider_name').all();
  }

  updateApiKey(id, apiKey, status) {
    const db = getDb();
    const update = db.prepare(`
      UPDATE api_keys SET api_key = ?, status = ? WHERE id = ?
    `);
    update.run(apiKey, status, id);
    
    // Clear all cache
    this.cache = {};
  }

  addApiKey(providerName, apiKey, category) {
    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO api_keys (provider_name, api_key, category_function, status)
      VALUES (?, ?, ?, ?)
    `);
    insert.run(providerName, apiKey, category, 1);
    
    // Clear all cache
    this.cache = {};
  }

  deleteApiKey(id) {
    const db = getDb();
    const del = db.prepare('DELETE FROM api_keys WHERE id = ?');
    del.run(id);
    
    // Clear all cache
    this.cache = {};
  }
}

// Singleton instance
const apiRotator = new ApiRotator();

// Middleware for API rotation
function getApiKey(category) {
  return apiRotator.getActiveApiKey(category);
}

async function handleApiError(category, keyId) {
  return await apiRotator.rotateOnError(category, keyId);
}

module.exports = {
  apiRotator,
  getApiKey,
  handleApiError,
  API_CATEGORIES
};

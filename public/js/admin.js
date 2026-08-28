// Utility functions
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast') || createToast();
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function createToast() {
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = 'toast';
  document.body.appendChild(toast);
  return toast;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Modal functions
function openModal(id) {
  document.getElementById(id).classList.add('show');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

// Fetch with error handling
async function fetchJson(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Fetch error:', error);
    showToast('Error: ' + error.message, 'error');
    throw error;
  }
}

// API Key management
async function loadApiKeys() {
  try {
    const data = await fetchJson('/admin/api-keys');
    if (data.success) {
      renderApiKeys(data.data);
    }
  } catch (error) {
    console.error('Failed to load API keys:', error);
  }
}

function renderApiKeys(keys) {
  const tbody = document.getElementById('apiKeysTable');
  if (!tbody) return;
  
  if (!keys || keys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No API keys configured</div></td></tr>`;
    return;
  }
  
  tbody.innerHTML = keys.map(key => `
    <tr>
      <td><strong>${escapeHtml(key.provider_name)}</strong></td>
      <td><span class="status-badge">${escapeHtml(key.category_function)}</span></td>
      <td><code style="font-size:12px;">${escapeHtml(key.api_key.substring(0, 8))}...</code></td>
      <td>
        <span class="status-badge ${key.status ? 'active' : 'inactive'}">
          ${key.status ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>${key.usage_count || 0}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="editApiKey(${key.id})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteApiKey(${key.id})">🗑️</button>
      </td>
    </tr>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Dashboard functions
async function refreshStats() {
  try {
    const response = await fetch('/admin/dashboard');
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const stats = {
      userCount: doc.querySelector('#userCount')?.textContent || '0',
      projectCount: doc.querySelector('#projectCount')?.textContent || '0',
      depositCount: doc.querySelector('#depositCount')?.textContent || '0',
      totalRevenue: doc.querySelector('#totalRevenue')?.textContent || 'Rp 0'
    };
    
    document.getElementById('userCount').textContent = stats.userCount;
    document.getElementById('projectCount').textContent = stats.projectCount;
    document.getElementById('depositCount').textContent = stats.depositCount;
    document.getElementById('totalRevenue').textContent = stats.totalRevenue;
    
    showToast('Data refreshed!', 'success');
  } catch (error) {
    console.error('Failed to refresh stats:', error);
    showToast('Error refreshing data', 'error');
  }
}

// Settings functions
async function loadSettings() {
  try {
    const data = await fetchJson('/admin/settings');
    if (data.success) {
      populateSettingsForm(data.data);
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

function populateSettingsForm(settings) {
  const form = document.getElementById('settingsForm');
  if (!form) return;
  
  const fields = {
    flat_command_cost: settings.flat_command_cost,
    free_trial_daily_tokens: settings.free_trial_daily_tokens,
    trial_duration_days: settings.trial_duration_days,
    token_rate_idr: settings.token_rate_idr,
    bot_wa_number: settings.bot_wa_number,
    admin_wa_number: settings.admin_wa_number,
    cloudflare_api_token: settings.cloudflare_api_token || '',
    unsplash_access_key: settings.unsplash_access_key || ''
  };
  
  Object.entries(fields).forEach(([name, value]) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (input) input.value = value;
  });
}

async function updateSettings(e) {
  e.preventDefault();
  const form = e.target;
  const data = {};
  new FormData(form).forEach((value, key) => {
    data[key] = value;
  });
  
  try {
    const result = await fetchJson('/admin/settings/update', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (result.success) {
      showToast('Settings updated!', 'success');
    } else {
      showToast('Error: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('Failed to update settings:', error);
  }
}

// Initialization
document.addEventListener('DOMContentLoaded', function() {
  // Load API keys
  loadApiKeys();
  
  // Setup refresh button
  const refreshBtn = document.querySelector('.refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshStats);
  }
  
  // Setup modal close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.remove('show');
      }
    });
  });
});

// Export for global use
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.loadApiKeys = loadApiKeys;
window.refreshStats = refreshStats;
window.loadSettings = loadSettings;
window.updateSettings = updateSettings;

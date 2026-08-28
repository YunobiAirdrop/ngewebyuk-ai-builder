const axios = require('axios');

async function sendWAMessage(targetPhone, messageText, buttons = []) {
  try {
    const gatewayUrl = process.env.WA_GATEWAY_URL;
    if (!gatewayUrl) return false;
    const response = await axios.post(
      gatewayUrl,
      { target: targetPhone, message: messageText, buttons },
      {
        headers: { 'Authorization': process.env.WA_GATEWAY_TOKEN, 'Content-Type': 'application/json' },
        timeout: 10000
      }
    );
    return response.data;
  } catch (error) {
    console.error('[WA Production API Error]:', error.message);
    return false;
  }
}

module.exports = { sendWAMessage };
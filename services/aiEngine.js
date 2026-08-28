const axios = require('axios');
const { getDb } = require('../config/database');
const { getApiKey, handleApiError, API_CATEGORIES } = require('../middleware/apiRotator');

async function generateWebsite(description, userId, existingProject = null) {
  try {
    // Get API key for web builder
    const apiKey = getApiKey(API_CATEGORIES.WEB_BUILDER);
    if (!apiKey) {
      throw new Error('No API key available for web builder');
    }

    // Determine if we're creating new or revising
    const isRevision = !!existingProject;
    
    // Build prompt
    let prompt = isRevision ? 
      `Revise the following website based on: ${description}\n\nCurrent HTML:\n${existingProject.html_code}` :
      `Create a complete, modern, responsive HTML website for: ${description}.
      Include:
      - Modern design with CSS
      - Interactive JavaScript
      - Responsive for mobile
      - Clean, professional layout
      - Tailwind CSS if applicable
      
      Return ONLY the complete HTML with embedded CSS and JavaScript.`;

    // Make API request
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a professional web developer. Generate complete, working HTML websites.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey.api_key}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const generatedHtml = response.data.choices[0].message.content;
    
    // Extract HTML, CSS, JS
    const htmlMatch = generatedHtml.match(/<!DOCTYPE html>[\s\S]*?<\/html>/i);
    const html = htmlMatch ? htmlMatch[0] : generatedHtml;

    // Extract CSS
    const cssMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
    const css = cssMatch ? cssMatch[1] : '';

    // Extract JS
    const jsMatch = html.match(/<script>([\s\S]*?)<\/script>/i);
    const js = jsMatch ? jsMatch[1] : '';

    // Add watermark for non-premium users
    const user = await getUserById(userId);
    if (!user.is_premium) {
      const watermarkHtml = `
        <div id="ngewebyuk-watermark" style="position:fixed;bottom:20px;right:20px;z-index:9999;background:#000;color:#fff;padding:8px 16px;border-radius:20px;font-size:12px;display:flex;align-items:center;gap:8px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.3);">
          <span>⚡</span>
          <span>Dibuat di bot NgeWebYuk</span>
          <button onclick="this.parentElement.style.display='none'" style="background:transparent;border:none;color:#fff;cursor:pointer;font-size:14px;">×</button>
        </div>
        <script>
          document.getElementById('ngewebyuk-watermark').addEventListener('click', function(e) {
            if (e.target.tagName !== 'BUTTON') {
              window.open('https://wa.me/6289514953909', '_blank');
            }
          });
        </script>
      `;
      
      // Insert watermark before closing body tag
      const finalHtml = html.replace(/<\/body>/, watermarkHtml + '\n</body>');
      
      return {
        success: true,
        html: finalHtml,
        css: css,
        js: js
      };
    }

    return {
      success: true,
      html: html,
      css: css,
      js: js
    };

  } catch (error) {
    console.error('AI Engine error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate website'
    };
  }
}

async function getUserById(userId) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

async function deployToVercel(project, token) {
  try {
    const { Vercel } = require('@vercel/sdk');
    
    // Create deployment
    const response = await axios.post(
      'https://api.vercel.com/v12/deployments',
      {
        name: project.project_name,
        files: [
          {
            file: 'index.html',
            data: Buffer.from(project.html_code).toString('base64')
          },
          {
            file: 'style.css',
            data: Buffer.from(project.css_code || '').toString('base64')
          },
          {
            file: 'script.js',
            data: Buffer.from(project.js_code || '').toString('base64')
          }
        ],
        projectSettings: {
          framework: 'vite',
          buildCommand: 'npm run build',
          outputDirectory: 'dist'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      url: response.data.url
    };
  } catch (error) {
    console.error('Vercel deploy error:', error);
    return {
      success: false,
      error: error.message || 'Failed to deploy to Vercel'
    };
  }
}

async function deployToNetlify(project, token) {
  try {
    const formData = new FormData();
    const files = [
      { name: 'index.html', content: project.html_code },
      { name: 'style.css', content: project.css_code || '' },
      { name: 'script.js', content: project.js_code || '' }
    ];

    for (const file of files) {
      const blob = new Blob([file.content], { type: 'text/html' });
      formData.append('files', blob, file.name);
    }

    const response = await axios.post(
      'https://api.netlify.com/api/v1/sites',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    return {
      success: true,
      url: response.data.url
    };
  } catch (error) {
    console.error('Netlify deploy error:', error);
    return {
      success: false,
      error: error.message || 'Failed to deploy to Netlify'
    };
  }
}

async function generateImage(prompt, style = 'photorealistic') {
  try {
    const apiKey = getApiKey(API_CATEGORIES.IMAGE_GENERATOR);
    if (!apiKey) {
      throw new Error('No API key available for image generation');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        style: style
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey.api_key}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: true,
      url: response.data.data[0].url
    };
  } catch (error) {
    console.error('Image generation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate image'
    };
  }
}

async function generateVoice(text, voice = 'alloy') {
  try {
    const apiKey = getApiKey(API_CATEGORIES.VOICE_ENGINE);
    if (!apiKey) {
      throw new Error('No API key available for voice generation');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1',
        input: text,
        voice: voice
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey.api_key}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    return {
      success: true,
      audio: Buffer.from(response.data)
    };
  } catch (error) {
    console.error('Voice generation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to generate voice'
    };
  }
}

async function analyzeDocument(fileBuffer, fileType) {
  try {
    const apiKey = getApiKey(API_CATEGORIES.DOCUMENT_ANALYZER);
    if (!apiKey) {
      throw new Error('No API key available for document analysis');
    }

    const formData = new FormData();
    formData.append('file', fileBuffer, `document.${fileType}`);
    formData.append('api_key', apiKey.api_key);

    const response = await axios.post(
      'https://api.unstructured.io/v0/general',
      formData,
      {
        headers: {
          ...formData.getHeaders()
        }
      }
    );

    return {
      success: true,
      content: response.data
    };
  } catch (error) {
    console.error('Document analysis error:', error);
    return {
      success: false,
      error: error.message || 'Failed to analyze document'
    };
  }
}

module.exports = {
  generateWebsite,
  deployToVercel,
  deployToNetlify,
  generateImage,
  generateVoice,
  analyzeDocument,
  getUserById
};

const express = require('express');
const router = express.Router();
const { getDb } = require('../config/database');
const JSZip = require('jszip');
const puppeteer = require('puppeteer');

// Preview live website
router.get('/:id', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).send('Invalid project ID');
    }

    const db = getDb();
    const project = db.prepare('SELECT * FROM web_projects WHERE id = ?').get(projectId);
    
    if (!project) {
      return res.status(404).send('Project not found');
    }

    // Check passcode
    if (project.passcode_protected && req.query.passcode !== project.passcode_protected) {
      return res.send(`
        <html>
          <head><title>Password Protected</title></head>
          <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;background:#f5f5f5;">
            <div style="background:white;padding:40px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1);text-align:center;">
              <h2>🔐 Password Required</h2>
              <p>This website is password protected.</p>
              <form method="GET">
                <input type="password" name="passcode" placeholder="Enter password" style="padding:10px;border:1px solid #ddd;border-radius:5px;width:200px;">
                <button type="submit" style="padding:10px 20px;background:#000;color:#fff;border:none;border-radius:5px;cursor:pointer;">Submit</button>
              </form>
            </div>
          </body>
        </html>
      `);
    }

    // Inject watermark for non-premium users
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(project.user_id);
    
    let html = project.html_code;
    if (!user.is_premium) {
      const watermark = `
        <div id="ngewebyuk-watermark" style="position:fixed;bottom:20px;right:20px;z-index:9999;background:#000;color:#fff;padding:8px 16px;border-radius:20px;font-size:12px;display:flex;align-items:center;gap:8px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.3);font-family:Arial,sans-serif;">
          <span>⚡</span>
          <span>Dibuat di bot NgeWebYuk</span>
          <button onclick="this.parentElement.style.display='none'" style="background:transparent;border:none;color:#fff;cursor:pointer;font-size:14px;font-family:Arial,sans-serif;">×</button>
        </div>
        <script>
          document.getElementById('ngewebyuk-watermark').addEventListener('click', function(e) {
            if (e.target.tagName !== 'BUTTON') {
              window.open('https://wa.me/6289514953909', '_blank');
            }
          });
        </script>
      `;
      
      html = html.replace(/<\/body>/, watermark + '\n</body>');
    }

    res.send(html);
  } catch (error) {
    console.error('Preview error:', error);
    res.status(500).send('Error loading preview');
  }
});

// Download website as ZIP
router.get('/download/:id', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const db = getDb();
    const project = db.prepare('SELECT * FROM web_projects WHERE id = ?').get(projectId);
    
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const zip = new JSZip();
    
    // Add files to zip
    zip.file('index.html', project.html_code || '');
    zip.file('style.css', project.css_code || '');
    zip.file('script.js', project.js_code || '');
    
    // Create zip buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${project.project_name}.zip"`);
    res.send(zipBuffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export as PDF
router.get('/export-pdf/:id', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const db = getDb();
    const project = db.prepare('SELECT * FROM web_projects WHERE id = ?').get(projectId);
    
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Launch puppeteer
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Set content
    await page.setContent(project.html_code || '');
    
    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' }
    });
    
    await browser.close();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${project.project_name}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export to WordPress format
router.get('/export-wp/:id', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ success: false, error: 'Invalid project ID' });
    }

    const db = getDb();
    const project = db.prepare('SELECT * FROM web_projects WHERE id = ?').get(projectId);
    
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Generate WordPress compatible HTML
    const wpHtml = `
      <!-- wp:html -->
      ${project.html_code}
      <!-- /wp:html -->
      <!-- wp:html -->
      <style>${project.css_code || ''}</style>
      <!-- /wp:html -->
      <!-- wp:html -->
      <script>${project.js_code || ''}</script>
      <!-- /wp:html -->
    `;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${project.project_name}-wordpress.html"`);
    res.send(wpHtml);
  } catch (error) {
    console.error('WordPress export error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

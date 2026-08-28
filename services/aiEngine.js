const { getActiveApiKey } = require('../middleware/apiRotator');

async function generateWebCode(prompt, userConfig = {}) {
  const activeKeyObj = await getActiveApiKey('WEB_BUILDER_CODE');
  const generatedHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${prompt}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-white min-h-screen flex flex-col justify-center items-center">
  <h1 class="text-3xl font-bold">${prompt}</h1>
  <p class="text-slate-400 mt-2">Dibuat otomatis oleh NgeWebYuk AI Generator Gateway.</p>
</body>
</html>`;
  return { html: generatedHtml, provider: activeKeyObj.provider_name };
}

module.exports = { generateWebCode };
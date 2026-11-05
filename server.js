'use strict';
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const compression = require('compression');

const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';
const PUBLIC = path.join(__dirname, 'public');
const CONFIG_PATH = path.join(__dirname, 'config', 'clinic.json');

const app = express();
app.disable('x-powered-by');
app.use(compression());

// Cabeçalhos de segurança básicos
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Dados da clínica: lidos do JSON a cada request em dev, em memória em produção
let cached;
function getClinic() {
  if (isProd && cached) return cached;
  cached = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  return cached;
}

app.get('/api/clinic', (req, res) => {
  res.setHeader('Cache-Control', isProd ? 'public, max-age=300' : 'no-store');
  res.json(getClinic());
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

// Frames: nome muda só quando o vídeo muda -> cache longo; manifest sempre revalida
app.use(
  express.static(PUBLIC, {
    extensions: ['html'],
    setHeaders(res, file) {
      if (/\/frames\/\d+\.webp$/.test(file)) {
        res.setHeader('Cache-Control', isProd ? 'public, max-age=86400' : 'no-cache');
      } else if (/\.(css|js|json|html)$/.test(file)) {
        res.setHeader('Cache-Control', isProd ? 'public, max-age=300, must-revalidate' : 'no-store');
      }
    },
  })
);

app.use((req, res) => res.status(404).sendFile(path.join(PUBLIC, 'index.html')));

app.listen(PORT, () => console.log(`Prospere Odonto rodando em http://localhost:${PORT}`));

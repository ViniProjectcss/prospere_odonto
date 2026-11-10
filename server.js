'use strict';
require('dotenv').config({ quiet: true });
const path = require('node:path');
const express = require('express');
const compression = require('compression');

const store = require('./server/db');
const auth = require('./server/auth');
const { buildDefaults } = require('./server/defaults');
const { adminRouter } = require('./server/admin-api');
const site = require('./server/site');
const leads = require('./server/leads');
const gallery = require('./server/gallery');

const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';
const PUBLIC = path.join(__dirname, 'public');

const app = express();
app.disable('x-powered-by');
// Atrás de proxy/HTTPS (nginx, etc.)? Defina TRUST_PROXY=1 no .env
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.use(compression());

// Cabeçalhos de segurança básicos
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ---------- Painel admin (/admin) ----------
app.use('/admin', (req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  );
  next();
});
app.use('/admin/api', adminRouter);

app.get('/healthz', (req, res) => res.json({ ok: true }));

// Página inicial: montada aqui com os textos do banco (precisa vir ANTES do express.static)
async function sendPage(req, res, status = 200) {
  try {
    res.status(status);
    res.setHeader('Cache-Control', isProd ? 'public, max-age=60' : 'no-store');
    res.type('html').send(await site.getHtml());
  } catch (e) {
    console.error('[site] erro ao montar a página:', e);
    res.status(500).type('text').send('Erro interno do servidor.');
  }
}
app.get(['/', '/index.html'], (req, res) => sendPage(req, res));

// Política de Privacidade (LGPD) e API pública do cartão de contato
app.get('/privacidade', async (req, res) => {
  try {
    res.setHeader('Cache-Control', isProd ? 'public, max-age=60' : 'no-store');
    res.type('html').send(await site.getPrivacyHtml());
  } catch (e) {
    console.error('[site] erro na política:', e);
    res.status(500).type('text').send('Erro interno do servidor.');
  }
});
app.use('/api/leads', leads.router(site.getContent));

// Galeria: arquivos enviados pelo painel (nome aleatório -> cache longo). Precisa vir ANTES do express.static.
app.use('/media/gallery', gallery.media(isProd));

// Frames: nome muda só quando o vídeo muda -> cache longo; manifest sempre revalida
app.use(
  express.static(PUBLIC, {
    extensions: ['html'],
    setHeaders(res, file) {
      if (/[\\/]admin[\\/]/.test(file)) return; // o painel nunca fica em cache
      if (/[\\/]frames[\\/]\d+\.webp$/.test(file)) {
        res.setHeader('Cache-Control', isProd ? 'public, max-age=86400' : 'no-cache');
      } else if (/\.(css|js|json|html)$/.test(file)) {
        res.setHeader('Cache-Control', isProd ? 'public, max-age=300, must-revalidate' : 'no-store');
      }
    },
  })
);

app.use((req, res) => sendPage(req, res, 404));

// Último recurso: nunca mostrar detalhes internos (caminhos, stack) para o visitante
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[erro]', err);
  res.status(500).type('text').send('Erro interno do servidor.');
});

app.listen(PORT, () => {
  console.log(`Prospere Odonto rodando em http://localhost:${PORT}`);

  const problem = auth.configProblem();
  if (problem) console.warn(`[admin] Login desativado. ${problem}`);

  // Conecta no banco SEM travar o site: se falhar, o site público continua no ar
  store
    .init(buildDefaults())
    .then(async () => {
      console.log(`[admin] Banco conectado (${store.state.database}). Painel em http://localhost:${PORT}/admin`);
      const r = leads.readiness(await site.getContent());
      console.log(r.ok ? '[leads] Cartão de contato: ATIVO' : `[leads] Cartão de contato: desligado.\n  - ${r.reasons.join('\n  - ')}`);
      await leads.purgeExpired().catch((e) => console.error('[leads] limpeza falhou:', e.code || e.message));
    })
    .catch((e) => console.error(`[admin] Banco indisponível: ${e.message}`));

  // LGPD: apaga contatos vencidos (retenção) a cada 6 horas
  setInterval(() => leads.purgeExpired().catch((e) => console.error('[leads] limpeza falhou:', e.code || e.message)), 6 * 60 * 60 * 1000).unref();
});

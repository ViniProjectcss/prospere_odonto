'use strict';
/**
 * Entrega as páginas públicas, já montadas com o conteúdo do banco.
 * - Em produção guarda a página pronta em memória por 60s (e limpa na hora que você salva no painel).
 * - Se o banco estiver fora do ar, o site continua no ar com o conteúdo padrão.
 */
const store = require('./db');
const leads = require('./leads');
const gallery = require('./gallery');
const { buildDefaults } = require('./defaults');
const { renderPage, merge } = require('./render');
const { renderPrivacy } = require('./privacy');

const isProd = process.env.NODE_ENV === 'production';
const TTL_MS = 60 * 1000;
const DEFAULTS = buildDefaults();
const cache = {}; // { home: {html, at}, privacy: {html, at} }

async function loadContent() {
  if (store.isReady()) {
    try {
      const cur = await store.getContent();
      if (cur) return cur.content;
    } catch (e) {
      console.error('[site] não consegui ler o conteúdo do banco, usando o padrão:', e.message);
    }
  }
  return DEFAULTS;
}

// conteúdo salvo + padrões (seções novas nunca faltam, mesmo em bancos antigos)
const mergeWithDefaults = (content) => merge(DEFAULTS, content);
async function getContent() { return mergeWithDefaults(await loadContent()); }

async function cached(key, build) {
  if (isProd && cache[key] && Date.now() - cache[key].at < TTL_MS) return cache[key].html;
  const html = await build();
  if (isProd) cache[key] = { html, at: Date.now() };
  return html;
}

const getHtml = () => cached('home', async () => {
  const c = await getContent();
  const ready = leads.readiness(c);
  return renderPage(c, DEFAULTS, { cacheTemplate: isProd, gallery: await gallery.listPublic(), lead: { enabled: ready.ok, siteKey: leads.turnstileSiteKey() } });
});

const getPrivacyHtml = () => cached('privacy', async () => renderPrivacy(await getContent(), { retentionDays: leads.retentionDays() }));

const invalidate = () => { for (const k of Object.keys(cache)) delete cache[k]; };

module.exports = { getHtml, getPrivacyHtml, getContent, mergeWithDefaults, invalidate, DEFAULTS };

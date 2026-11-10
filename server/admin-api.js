'use strict';
/**
 * API do painel (montada em /admin/api).
 *  POST /login            { user, password }
 *  POST /logout
 *  GET  /me
 *  GET  /status           estado do banco
 *  GET  /content          conteúdo atual
 *  PUT  /content          { content, note }   valida, salva e cria uma versão
 *  GET  /versions         histórico
 *  POST /versions/:id/restore
 */
const express = require('express');
const store = require('./db');
const auth = require('./auth');
const { validateContent } = require('./validate');
const { iconList } = require('./icons');
const site = require('./site');
const leads = require('./leads');
const gallery = require('./gallery');

const router = express.Router();

router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.use(express.json({ limit: '1mb' })); // dentro do roteador: erros de JSON caem no tratador abaixo
router.use(auth.originCheck);

// ---- sessão ----
router.post('/login', auth.login);
router.post('/logout', auth.logout);
router.get('/me', auth.requireAuth, (req, res) => res.json({ user: req.adminUser }));

// ---- tudo abaixo exige login + banco funcionando ----
const needDb = (req, res, next) =>
  store.isReady() ? next() : res.status(503).json({ error: store.state.error || 'Banco de dados indisponível.' });
const guard = [auth.requireAuth, needDb];

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// listas fixas que o painel usa nos formulários (fonte única: o código do servidor)
router.get('/meta', auth.requireAuth, (req, res) => res.json({ icons: iconList() }));

router.get('/status', auth.requireAuth, wrap(async (req, res) => {
  if (!store.isReady()) return res.json({ db: { ok: false, error: store.state.error } });
  const cur = await store.getContent();
  const versions = await store.listVersions(1000);
  res.json({ db: { ok: true, database: store.state.database }, updatedAt: cur?.updatedAt || null, versions: versions.length });
}));

router.get('/content', guard, wrap(async (req, res) => {
  const cur = await store.getContent();
  if (!cur) return res.status(404).json({ error: 'Conteúdo não encontrado.' });
  res.json({ content: site.mergeWithDefaults(cur.content), updatedAt: cur.updatedAt }); // bancos antigos ganham as seções novas
}));

router.put('/content', guard, wrap(async (req, res) => {
  const { content, note } = req.body || {};
  const result = validateContent(content);
  if (!result.ok) return res.status(422).json({ error: 'O conteúdo tem problemas e não foi salvo.', details: result.errors });
  const { versionId } = await store.saveContent(content, typeof note === 'string' ? note.trim() : '');
  site.invalidate(); // o site público já mostra a mudança
  const cur = await store.getContent();
  res.json({ ok: true, versionId, updatedAt: cur.updatedAt });
}));

router.get('/versions', guard, wrap(async (req, res) => {
  res.json({ versions: await store.listVersions(50) });
}));

router.post('/versions/:id/restore', guard, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Versão inválida.' });
  const v = await store.getVersion(id);
  if (!v) return res.status(404).json({ error: 'Versão não encontrada.' });
  const restored = site.mergeWithDefaults(v.content);
  const check = validateContent(restored);
  if (!check.ok) return res.status(422).json({ error: 'Essa versão antiga não é mais compatível.', details: check.errors });
  const { versionId } = await store.saveContent(restored, `Restaurada da versão #${id}`);
  site.invalidate();
  res.json({ ok: true, versionId });
}));

// ---- contatos recebidos (LGPD) ----
const leadId = (req) => { const n = Number(req.params.id); return Number.isInteger(n) && n > 0 ? n : null; };

async function leadsInfo() {
  const content = await site.getContent();
  return { ...leads.readiness(content), counts: await leads.counts(), retentionDays: leads.retentionDays() };
}

router.get('/leads/summary', guard, wrap(async (req, res) => res.json(await leadsInfo())));

router.get('/leads/export.csv', guard, wrap(async (req, res) => {
  const csv = await leads.exportCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="contatos.csv"');
  res.send(csv);
}));

router.post('/leads/erase', guard, wrap(async (req, res) => {
  const n = await leads.eraseByEmail(req.body && req.body.email);
  if (n < 0) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  res.json({ ok: true, deleted: n });
}));

router.get('/leads', guard, wrap(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const search = String(req.query.q || '').trim().slice(0, 100);
  const status = String(req.query.status || '');
  const pageSize = 30;
  const data = await leads.list({ page, pageSize, search, status });
  res.json({ ...data, page, pageSize, info: await leadsInfo() });
}));

router.get('/leads/:id/export', guard, wrap(async (req, res) => {
  const id = leadId(req);
  const lead = id && await leads.exportOne(id);
  if (!lead) return res.status(404).json({ error: 'Contato não encontrado.' });
  res.setHeader('Content-Disposition', `attachment; filename="contato-${id}.json"`);
  res.json(lead);
}));

router.patch('/leads/:id', guard, wrap(async (req, res) => {
  const id = leadId(req);
  const ok = id && await leads.setStatus(id, req.body && req.body.status);
  if (!ok) return res.status(400).json({ error: 'Não foi possível atualizar.' });
  res.json({ ok: true });
}));

router.delete('/leads/:id', guard, wrap(async (req, res) => {
  const id = leadId(req);
  if (!id || !(await leads.remove(id))) return res.status(404).json({ error: 'Contato não encontrado.' });
  res.json({ ok: true });
}));

// ---- galeria de pacientes (upload, legendas, ordem) ----
gallery.mount(router, guard, wrap, site.invalidate);

// ---- erros em JSON ----
router.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
router.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Conteúdo grande demais.' });
  console.error('[admin] erro:', err);
  res.status(500).json({ error: 'Erro interno. Veja o terminal do servidor.' });
});

module.exports = { adminRouter: router };

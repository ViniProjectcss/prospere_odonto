'use strict';
/**
 * Contatos do cartão flutuante (LGPD).
 *
 *  - Nome, e-mail e telefone são gravados CRIPTOGRAFADOS (AES-256-GCM). Chave: LEADS_ENCRYPTION_KEY (.env).
 *    Quem abrir o banco no DBeaver só vê texto embaralhado. FAÇA BACKUP DESSA CHAVE: sem ela os dados não abrem.
 *  - *_hash (HMAC) servem só para achar/apagar por e-mail ou telefone e evitar duplicados.
 *  - Guardamos a prova do consentimento: data/hora, texto exato aceito, versão da política e hash do IP.
 *  - Apagamento automático após LEADS_RETENTION_DAYS (padrão 365).
 *  - Anti-robô: Cloudflare Turnstile (verificado no servidor) + campo-isca + tempo mínimo + limite por IP.
 *  - Nada de dado pessoal vai para log nem para o audit_log.
 */
const crypto = require('node:crypto');
const express = require('express');
const store = require('./db');

const isProd = process.env.NODE_ENV === 'production';
const MIN_FILL_MS = 1500;               // abaixo disso é robô
const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // formulário aberto vale por 2h
const PLACEHOLDER = /\[EDITAR\]/i;
const STATUSES = ['new', 'contacted', 'archived'];

/* =============== configuração =============== */
let keys = null;
function loadKeys() {
  const hex = process.env.LEADS_ENCRYPTION_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) { keys = null; return; }
  const master = Buffer.from(hex, 'hex');
  const sub = (label) => Buffer.from(crypto.hkdfSync('sha256', master, Buffer.alloc(0), label, 32));
  keys = { enc: sub('leads-enc-v1'), mac: sub('leads-mac-v1'), form: sub('leads-form-v1') };
}
loadKeys();

function retentionDays() {
  const n = parseInt(process.env.LEADS_RETENTION_DAYS, 10);
  return Number.isFinite(n) ? Math.min(1825, Math.max(30, n)) : 365;
}

// Chaves do Cloudflare Turnstile. Sem chaves: em desenvolvimento usa as chaves de TESTE da Cloudflare
// (sempre aprovam); em produção o cartão fica desligado (nunca coleta sem anti-robô).
function turnstileKeys() {
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  const secret = process.env.TURNSTILE_SECRET;
  if (siteKey && secret) return { siteKey, secret, test: false };
  if (!isProd) return { siteKey: '1x00000000000000000000AA', secret: '1x0000000000000000000000000000000AA', test: true };
  return null;
}
const turnstileSiteKey = () => turnstileKeys()?.siteKey || '';

/**
 * O cartão só vai ao ar se tudo que a LGPD exige estiver no lugar.
 * Retorna { ok, reasons[] } — o painel mostra os motivos.
 */
function readiness(content) {
  const reasons = [];
  if (!store.isReady()) reasons.push('O banco de dados está indisponível.');
  if (!keys) reasons.push('Defina LEADS_ENCRYPTION_KEY no arquivo .env (64 caracteres hexadecimais) e reinicie o servidor.');
  if (!turnstileKeys()) reasons.push('Defina TURNSTILE_SITE_KEY e TURNSTILE_SECRET no .env (em produção são obrigatórios).');
  const p = (content && content.privacy) || {};
  const bad = (v) => !String(v || '').trim() || PLACEHOLDER.test(String(v));
  if (bad(p.controller && p.controller.legalName)) reasons.push('Em "Privacidade", informe a razão social da clínica.');
  if (bad(p.controller && p.controller.cnpj)) reasons.push('Em "Privacidade", informe o CNPJ.');
  if (bad(p.dpo && p.dpo.email)) reasons.push('Em "Privacidade", informe o e-mail do encarregado (DPO).');
  if (content && content.leadCard && content.leadCard.enabled === false) reasons.push('O cartão está desativado em "Cartão de contato".');
  return { ok: reasons.length === 0, reasons };
}

/* =============== criptografia =============== */
const b64 = (buf) => buf.toString('base64url');

function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', keys.enc, iv);
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return `v1.${b64(iv)}.${b64(c.getAuthTag())}.${b64(ct)}`;
}

function decrypt(blob) {
  try {
    const [v, iv, tag, ct] = String(blob).split('.');
    if (v !== 'v1') return null;
    const d = crypto.createDecipheriv('aes-256-gcm', keys.enc, Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

const mac = (label, value) => crypto.createHmac('sha256', keys.mac).update(`${label}:${value}`).digest('hex');

/* =============== validação =============== */
function cleanName(v) {
  const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  if (s.length < 2 || s.length > 100) return null;
  if (/[<>@]|https?:|www\./i.test(s) || /[\u0000-\u001f]/.test(s)) return null;
  return s;
}
function cleanEmail(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  if (s.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(s)) return null;
  return s;
}
// aceita (11) 99999-9999, +55 11 99999-9999 etc. Devolve só dígitos com 55 na frente.
function cleanPhone(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return null;
  if (Number(d.slice(0, 2)) < 11) return null;
  if (d.length === 11 && d[2] !== '9') return null;
  return '55' + d;
}

/* =============== token do formulário + limite de envios =============== */
const formSig = (ts) => crypto.createHmac('sha256', keys.form).update(ts).digest('base64url').slice(0, 32);
const makeFormToken = () => { const ts = Date.now().toString(36); return `${ts}.${formSig(ts)}`; };

function checkFormToken(t) {
  if (typeof t !== 'string' || !t.includes('.')) return 'token';
  const [ts, sig] = t.split('.');
  const good = formSig(ts);
  if (!sig || sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return 'token';
  const age = Date.now() - parseInt(ts, 36);
  if (!(age >= 0) || age > TOKEN_TTL_MS) return 'expired';
  if (age < MIN_FILL_MS) return 'too_fast';
  return null;
}

function makeLimiter(max, windowMs) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, arr] of hits) { const keep = arr.filter((t) => now - t < windowMs); keep.length ? hits.set(ip, keep) : hits.delete(ip); }
  }, 10 * 60 * 1000).unref();
  return (ip) => {
    const now = Date.now();
    const arr = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { hits.set(ip, arr); return false; }
    arr.push(now); hits.set(ip, arr);
    return true;
  };
}
const submitLimit = makeLimiter(5, 60 * 60 * 1000);  // 5 envios por hora por IP
const tokenLimit = makeLimiter(40, 60 * 60 * 1000);

async function verifyCaptcha(token, ip) {
  const k = turnstileKeys();
  if (!k || typeof token !== 'string' || token.length < 10 || token.length > 2048) return false;
  const body = new URLSearchParams({ secret: k.secret, response: token });
  if (ip) body.set('remoteip', ip);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body, signal: ctrl.signal });
    const j = await r.json();
    return j.success === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/* =============== gravar =============== */
async function saveLead({ name, email, phone, ip, content }) {
  const pool = store.getPool();
  const emailHash = mac('email', email);

  // mesmo e-mail nas últimas 24h: não duplica (e responde "ok" do mesmo jeito)
  const [dup] = await pool.query('SELECT id FROM leads WHERE email_hash = ? AND consent_at > (NOW() - INTERVAL 1 DAY) LIMIT 1', [emailHash]);
  if (dup.length) return;

  const lc = content.leadCard;
  const consentText = String(lc.consentText).replace('{politica}', lc.policyLinkLabel).slice(0, 1000);
  await pool.query(
    `INSERT INTO leads (name_enc, email_enc, phone_enc, email_hash, phone_hash, ip_hash, consent_text, policy_version, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
    [encrypt(name), encrypt(email), encrypt(phone), emailHash, mac('phone', phone), mac('ip', ip || ''), consentText, String(content.privacy.version).slice(0, 40), retentionDays()]
  );
}

/* =============== API pública (/api/leads) =============== */
function router(getContent) {
  const r = express.Router();
  r.use(express.json({ limit: '4kb' }));
  r.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  // só aceita chamadas vindas do próprio site
  r.use((req, res, next) => {
    if (req.method === 'POST') {
      const origin = req.headers.origin;
      let host = null;
      try { host = origin ? new URL(origin).host : null; } catch { /* origem inválida */ }
      if (!host || host !== req.headers.host) return res.status(403).json({ error: 'origin' });
    } else {
      const site = req.headers['sec-fetch-site'];
      if (site && site !== 'same-origin' && site !== 'none') return res.status(403).json({ error: 'origin' });
    }
    next();
  });

  // chamado quando a pessoa ABRE o formulário (começa a contar o tempo mínimo)
  r.get('/token', async (req, res) => {
    try {
      if (!readiness(await getContent()).ok) return res.status(503).json({ error: 'unavailable' });
      if (!tokenLimit(req.ip || 'x')) return res.status(429).json({ error: 'rate' });
      res.json({ token: makeFormToken() });
    } catch { res.status(500).json({ error: 'server' }); }
  });

  r.post('/', async (req, res) => {
    try {
      const content = await getContent();
      if (!readiness(content).ok) return res.status(503).json({ error: 'unavailable' });
      if (!submitLimit(req.ip || 'x')) return res.status(429).json({ error: 'rate' });

      const b = req.body || {};
      if (typeof b.website === 'string' && b.website.trim() !== '') return res.json({ ok: true }); // campo-isca preenchido: finge sucesso

      const tk = checkFormToken(b.token);
      if (tk) return res.status(400).json({ error: tk });

      const fields = {};
      const name = cleanName(b.name); if (!name) fields.name = true;
      const email = cleanEmail(b.email); if (!email) fields.email = true;
      const phone = cleanPhone(b.phone); if (!phone) fields.phone = true;
      if (b.consent !== true) fields.consent = true; // consentimento explícito, nunca pré-marcado
      if (Object.keys(fields).length) return res.status(422).json({ error: 'invalid', fields });

      if (!(await verifyCaptcha(b.captcha, req.ip))) return res.status(403).json({ error: 'captcha' });

      await saveLead({ name, email, phone, ip: req.ip, content });
      res.json({ ok: true });
    } catch (e) {
      console.error('[leads] erro ao salvar:', e.code || e.message); // nunca loga dado pessoal
      res.status(500).json({ error: 'server' });
    }
  });

  r.use((req, res) => res.status(404).json({ error: 'not_found' }));
  r.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
    res.status(err.type === 'entity.parse.failed' || err.type === 'entity.too.large' ? 400 : 500).json({ error: 'bad_request' });
  });
  return r;
}

/* =============== uso interno do painel =============== */
const q = (sql, args) => store.getPool().query(sql, args);

async function audit(action, leadId, detail) {
  try { await q('INSERT INTO audit_log (action, lead_id, detail) VALUES (?, ?, ?)', [action, leadId || null, detail ? String(detail).slice(0, 255) : null]); }
  catch (e) { console.error('[leads] audit falhou:', e.code || e.message); }
}

const toLead = (r) => ({
  id: r.id,
  name: decrypt(r.name_enc),
  email: decrypt(r.email_enc),
  phone: decrypt(r.phone_enc),
  status: r.status,
  consentAt: r.consent_at,
  expiresAt: r.expires_at,
  policyVersion: r.policy_version,
  consentText: r.consent_text,
});

async function counts() {
  const [rows] = await q('SELECT status, COUNT(*) AS n FROM leads GROUP BY status');
  const out = { new: 0, contacted: 0, archived: 0 };
  rows.forEach((r) => { out[r.status] = Number(r.n); });
  return out;
}

async function list({ page = 1, pageSize = 30, search = '', status = '' }) {
  const where = STATUSES.includes(status) ? 'WHERE status = ?' : '';
  const args = where ? [status] : [];
  const offset = (Math.max(1, page) - 1) * pageSize;

  if (search) { // nome está criptografado: busca em memória (até 5000 mais recentes)
    const [rows] = await q(`SELECT * FROM leads ${where} ORDER BY id DESC LIMIT 5000`, args);
    const needle = search.toLowerCase();
    const digits = search.replace(/\D/g, '');
    const all = rows.map(toLead).filter((l) =>
      (l.name || '').toLowerCase().includes(needle) || (l.email || '').includes(needle) || (digits.length >= 4 && (l.phone || '').includes(digits)));
    return { leads: all.slice(offset, offset + pageSize), total: all.length };
  }
  const [[{ n }]] = await q(`SELECT COUNT(*) AS n FROM leads ${where}`, args);
  const [rows] = await q(`SELECT * FROM leads ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...args, pageSize, offset]);
  return { leads: rows.map(toLead), total: Number(n) };
}

async function getOne(id) {
  const [rows] = await q('SELECT * FROM leads WHERE id = ?', [id]);
  return rows.length ? toLead(rows[0]) : null;
}

async function setStatus(id, status) {
  if (!STATUSES.includes(status)) return false;
  const [r] = await q('UPDATE leads SET status = ? WHERE id = ?', [status, id]);
  if (r.affectedRows) await audit('status', id, status);
  return r.affectedRows > 0;
}

async function remove(id) {
  const [r] = await q('DELETE FROM leads WHERE id = ?', [id]);
  if (r.affectedRows) await audit('delete', id, 'exclusão manual');
  return r.affectedRows > 0;
}

// pedido do titular: apaga TUDO ligado a um e-mail
async function eraseByEmail(email) {
  const e = cleanEmail(email);
  if (!e) return -1;
  const [r] = await q('DELETE FROM leads WHERE email_hash = ?', [mac('email', e)]);
  await audit('erase_email', null, `${r.affectedRows} registro(s) apagado(s) a pedido do titular`);
  return r.affectedRows;
}

async function purgeExpired() {
  if (!store.isReady()) return 0;
  const [r] = await q('DELETE FROM leads WHERE expires_at < NOW()');
  if (r.affectedRows) await audit('purge', null, `${r.affectedRows} registro(s) vencido(s) apagado(s) automaticamente`);
  return r.affectedRows;
}

// CSV seguro para Excel: BOM, aspas e proteção contra "injeção de fórmula"
const csvCell = (v) => {
  let s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};
async function exportCsv() {
  const [rows] = await q('SELECT * FROM leads ORDER BY id DESC');
  const head = ['id', 'data_consentimento', 'nome', 'email', 'telefone', 'status', 'versao_politica', 'texto_aceito', 'apagar_em'];
  const lines = [head.join(',')];
  rows.map(toLead).forEach((l) => lines.push([l.id, l.consentAt, l.name, l.email, l.phone, l.status, l.policyVersion, l.consentText, l.expiresAt].map(csvCell).join(',')));
  await audit('export_csv', null, `${rows.length} registro(s)`);
  return '\ufeff' + lines.join('\r\n');
}

async function exportOne(id) {
  const l = await getOne(id);
  if (l) await audit('export_one', id, 'portabilidade/acesso');
  return l;
}

module.exports = {
  router, readiness, retentionDays, turnstileSiteKey, purgeExpired,
  counts, list, getOne, setStatus, remove, eraseByEmail, exportCsv, exportOne, audit,
  _test: { encrypt, decrypt, cleanName, cleanEmail, cleanPhone, makeFormToken, checkFormToken, csvCell, mac, loadKeys },
};

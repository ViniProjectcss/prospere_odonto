'use strict';
/**
 * Autenticação do painel (1 usuário, definido no .env).
 *  - ADMIN_USER / ADMIN_PASSWORD: credenciais
 *  - SESSION_SECRET: chave para assinar o cookie de sessão (mín. 32 caracteres)
 *
 * Sessão = cookie assinado (HMAC), HttpOnly + SameSite=Strict. Sem estado no servidor.
 * Trocar a senha ou o SESSION_SECRET no .env derruba todas as sessões abertas.
 */
const crypto = require('node:crypto');

const COOKIE = 'prospere_admin';
const SESSION_MS = 8 * 60 * 60 * 1000; // 8 horas
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 minutos


/* ---------- configuração ---------- */
function configProblem() {
  const missing = ['ADMIN_USER', 'ADMIN_PASSWORD', 'SESSION_SECRET'].filter((k) => !process.env[k]);
  if (missing.length) return `Faltam no .env: ${missing.join(', ')}`;
  if (process.env.SESSION_SECRET.length < 32) return 'SESSION_SECRET precisa ter pelo menos 32 caracteres.';
  return null;
}

/* ---------- utilidades ---------- */
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));
const key = () => `${process.env.SESSION_SECRET}:${process.env.ADMIN_PASSWORD}`;
const sign = (v) => crypto.createHmac('sha256', key()).update(v).digest('base64url');

function makeToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_MS, n: crypto.randomBytes(8).toString('hex') })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  const good = sign(payload);
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch {
    return false;
  }
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function setCookie(req, res, value, maxAgeMs) {
  const parts = [`${COOKIE}=${encodeURIComponent(value)}`, 'Path=/admin', 'HttpOnly', 'SameSite=Strict', `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (req.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

/* ---------- limite de tentativas (por IP, em memória) ---------- */
const fails = new Map(); // ip -> { n, first, lockedUntil }
function lockedFor(ip) {
  const f = fails.get(ip);
  if (!f) return 0;
  if (f.lockedUntil && f.lockedUntil > Date.now()) return Math.ceil((f.lockedUntil - Date.now()) / 1000);
  if (Date.now() - f.first > LOCK_MS) fails.delete(ip);
  return 0;
}
function registerFail(ip) {
  const f = fails.get(ip) || { n: 0, first: Date.now(), lockedUntil: 0 };
  f.n += 1;
  if (f.n >= MAX_FAILS) f.lockedUntil = Date.now() + LOCK_MS;
  fails.set(ip, f);
}
setInterval(() => { for (const [ip, f] of fails) if (Date.now() - f.first > LOCK_MS && !(f.lockedUntil > Date.now())) fails.delete(ip); }, 10 * 60 * 1000).unref();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- middlewares / handlers ---------- */

// Bloqueia requisições de escrita vindas de OUTRO site (proteção CSRF extra)
function originCheck(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origin = req.headers.origin;
  if (origin) {
    let host;
    try { host = new URL(origin).host; } catch { host = null; }
    if (host !== req.headers.host) return res.status(403).json({ error: 'Origem não permitida.' });
  }
  next();
}

function requireAuth(req, res, next) {
  if (configProblem()) return res.status(503).json({ error: `Painel não configurado. ${configProblem()}` });
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!verifyToken(token)) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  req.adminUser = process.env.ADMIN_USER;
  next();
}

async function login(req, res) {
  const problem = configProblem();
  if (problem) return res.status(503).json({ error: `Painel não configurado. ${problem}` });

  const ip = req.ip || 'desconhecido';
  const locked = lockedFor(ip);
  if (locked) {
    res.setHeader('Retry-After', String(locked));
    return res.status(429).json({ error: `Muitas tentativas. Tente de novo em ${Math.ceil(locked / 60)} min.` });
  }

  const { user, password } = req.body || {};
  if (typeof user !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'Informe usuário e senha.' });

  // avalia os dois sempre, para não revelar qual estava errado
  const okUser = safeEqual(user, process.env.ADMIN_USER);
  const okPass = safeEqual(password, process.env.ADMIN_PASSWORD);
  if (!(okUser && okPass)) {
    registerFail(ip);
    await wait(400);
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  fails.delete(ip);
  setCookie(req, res, makeToken(), SESSION_MS);
  res.json({ ok: true });
}

function logout(req, res) {
  setCookie(req, res, '', 0);
  res.json({ ok: true });
}

module.exports = { configProblem, requireAuth, login, logout, originCheck };

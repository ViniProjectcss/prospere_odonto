'use strict';
/**
 * Camada de banco (MySQL / MariaDB). TODO o acesso ao banco passa por aqui.
 * Config lida do .env: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
 *
 * Tabelas (criadas sozinhas na primeira vez):
 *  - site_content     -> 1 linha (id = 1) com o conteúdo atual do site (JSON em texto)
 *  - content_versions -> 1 linha por "salvar", para poder voltar atrás
 *  - leads            -> pessoas que pediram contato (nome/e-mail/telefone CRIPTOGRAFADOS)
 *  - audit_log        -> registro de ações sobre dados pessoais (sem dados pessoais dentro)
 *  - gallery_items    -> fotos/GIFs/vídeos da galeria de pacientes (arquivos em uploads/gallery)
 */
const mysql = require('mysql2/promise');

const KEEP_VERSIONS = 100; // quantas versões guardar
let pool = null;
const state = { ready: false, error: null, database: null };

function readConfig() {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  const missing = ['DB_HOST', 'DB_NAME', 'DB_USER'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Faltam no .env: ${missing.join(', ')}`);
  if (!/^[A-Za-z0-9_]+$/.test(DB_NAME)) throw new Error('DB_NAME deve ter só letras, números e "_".');
  return { host: DB_HOST, port: Number(DB_PORT) || 3306, user: DB_USER, password: DB_PASSWORD || '', database: DB_NAME };
}

const poolOptions = (cfg) => ({ ...cfg, waitForConnections: true, connectionLimit: 5, charset: 'utf8mb4' });

function friendly(e) {
  const cfg = { host: process.env.DB_HOST, port: process.env.DB_PORT || 3306 };
  switch (e.code) {
    case 'ECONNREFUSED': return `Não consegui conectar ao MySQL em ${cfg.host}:${cfg.port}. O servidor do banco está ligado? Confira DB_HOST e DB_PORT no .env.`;
    case 'ENOTFOUND': return `O endereço do banco não existe (${cfg.host}). Confira DB_HOST no .env.`;
    case 'ER_ACCESS_DENIED_ERROR': return 'Usuário ou senha do banco incorretos. Confira DB_USER e DB_PASSWORD no .env.';
    case 'ER_DBACCESS_DENIED_ERROR': return 'O usuário do banco não tem permissão nesse banco de dados.';
    case 'ER_BAD_DB_ERROR': return 'O banco de dados não existe e não consegui criá-lo. Crie no DBeaver e tente de novo.';
    default: return e.message || String(e);
  }
}

async function init(defaults) {
  state.ready = false;
  state.error = null;
  try {
    const cfg = readConfig();
    state.database = cfg.database;
    pool = mysql.createPool(poolOptions(cfg));
    try {
      await pool.query('SELECT 1');
    } catch (e) {
      if (e.code !== 'ER_BAD_DB_ERROR') throw e;
      // o banco ainda não existe: tenta criar
      await pool.end();
      const { database, ...server } = cfg;
      const conn = await mysql.createConnection(server);
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await conn.end();
      pool = mysql.createPool(poolOptions(cfg));
      await pool.query('SELECT 1');
    }
    await migrate();
    await seed(defaults);
    state.ready = true;
  } catch (e) {
    state.error = friendly(e);
    throw new Error(state.error);
  }
}

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_content (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      content LONGTEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS content_versions (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      content LONGTEXT NOT NULL,
      note VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  // Contatos do cartão flutuante. Dados pessoais SEMPRE criptografados (server/leads.js).
  // *_hash servem só para achar/apagar por e-mail ou telefone (pedido do titular) e evitar duplicados.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name_enc VARCHAR(1024) NOT NULL,
      email_enc VARCHAR(1024) NOT NULL,
      phone_enc VARCHAR(1024) NOT NULL,
      email_hash CHAR(64) NOT NULL,
      phone_hash CHAR(64) NOT NULL,
      ip_hash CHAR(64) NULL,
      status ENUM('new','contacted','archived') NOT NULL DEFAULT 'new',
      consent_text VARCHAR(1000) NOT NULL,
      policy_version VARCHAR(40) NOT NULL,
      consent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      KEY idx_leads_email (email_hash),
      KEY idx_leads_phone (phone_hash),
      KEY idx_leads_expires (expires_at),
      KEY idx_leads_consent (consent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      action VARCHAR(40) NOT NULL,
      lead_id INT UNSIGNED NULL,
      detail VARCHAR(255) NULL,
      KEY idx_audit_at (at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  // Galeria de pacientes. consent_at = quando o painel confirmou a autorização de uso de imagem.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gallery_items (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      kind ENUM('image','video') NOT NULL,
      file VARCHAR(80) NOT NULL,
      poster VARCHAR(80) NULL,
      caption VARCHAR(140) NOT NULL DEFAULT '',
      visible TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      consent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_gallery_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

async function seed(defaults) {
  const [rows] = await pool.query('SELECT id FROM site_content WHERE id = 1');
  if (rows.length) return;
  const json = JSON.stringify(defaults);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('INSERT INTO site_content (id, content) VALUES (1, ?)', [json]);
    await conn.query('INSERT INTO content_versions (content, note) VALUES (?, ?)', [json, 'Versão inicial']);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

const isReady = () => state.ready;
const getPool = () => pool;

async function getContent() {
  const [rows] = await pool.query('SELECT content, updated_at FROM site_content WHERE id = 1');
  if (!rows.length) return null;
  return { content: JSON.parse(rows[0].content), updatedAt: rows[0].updated_at };
}

async function saveContent(content, note) {
  const json = JSON.stringify(content);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE site_content SET content = ? WHERE id = 1', [json]);
    const [r] = await conn.query('INSERT INTO content_versions (content, note) VALUES (?, ?)', [json, (note || '').slice(0, 255) || null]);
    // mantém só as últimas KEEP_VERSIONS versões
    await conn.query(
      'DELETE FROM content_versions WHERE id <= (SELECT id FROM (SELECT id FROM content_versions ORDER BY id DESC LIMIT 1 OFFSET ?) t)',
      [KEEP_VERSIONS]
    );
    await conn.commit();
    return { versionId: r.insertId };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function listVersions(limit = 50) {
  const [rows] = await pool.query(
    'SELECT id, note, created_at AS createdAt, CHAR_LENGTH(content) AS size FROM content_versions ORDER BY id DESC LIMIT ?',
    [limit]
  );
  return rows;
}

async function getVersion(id) {
  const [rows] = await pool.query('SELECT id, content, note, created_at AS createdAt FROM content_versions WHERE id = ?', [id]);
  if (!rows.length) return null;
  return { ...rows[0], content: JSON.parse(rows[0].content) };
}

/* ---------- galeria ---------- */
const GALLERY_COLS = 'id, kind, file, poster, caption, visible, sort_order AS sortOrder, consent_at AS consentAt';

async function galleryList({ visibleOnly = false } = {}) {
  const [rows] = await pool.query(`SELECT ${GALLERY_COLS} FROM gallery_items ${visibleOnly ? 'WHERE visible = 1' : ''} ORDER BY sort_order ASC, id ASC`);
  return rows;
}

async function galleryGet(id) {
  const [rows] = await pool.query(`SELECT ${GALLERY_COLS} FROM gallery_items WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function galleryCount() {
  const [[r]] = await pool.query('SELECT COUNT(*) AS n FROM gallery_items');
  return r.n;
}

async function galleryAdd({ kind, file, poster = null, caption = '' }) {
  const [[m]] = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM gallery_items');
  const [r] = await pool.query('INSERT INTO gallery_items (kind, file, poster, caption, sort_order) VALUES (?, ?, ?, ?, ?)', [kind, file, poster, caption, m.n]);
  return galleryGet(r.insertId);
}

async function galleryUpdate(id, { caption, visible }) {
  const sets = [];
  const vals = [];
  if (typeof caption === 'string') { sets.push('caption = ?'); vals.push(caption.slice(0, 140)); }
  if (typeof visible === 'boolean') { sets.push('visible = ?'); vals.push(visible ? 1 : 0); }
  if (!sets.length) return false;
  const [r] = await pool.query(`UPDATE gallery_items SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
  return r.affectedRows > 0;
}

async function galleryReorder(ids) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < ids.length; i++) await conn.query('UPDATE gallery_items SET sort_order = ? WHERE id = ?', [i + 1, ids[i]]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function galleryDelete(id) {
  const [r] = await pool.query('DELETE FROM gallery_items WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

module.exports = {
  init, isReady, getPool, state, getContent, saveContent, listVersions, getVersion,
  galleryList, galleryGet, galleryCount, galleryAdd, galleryUpdate, galleryReorder, galleryDelete,
};

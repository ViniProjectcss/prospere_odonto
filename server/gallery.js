'use strict';
/**
 * Galeria de pacientes: upload, conversão e entrega dos arquivos.
 *  - Foto (JPG/PNG/WebP) -> WebP até 1200 px, já na orientação certa (sharp).
 *  - GIF e vídeo -> MP4 SEM SOM, até 720 px e 15 s (ffmpeg), com capa em WebP.
 *  - Arquivos em uploads/gallery (ou UPLOADS_DIR no .env). Nomes aleatórios -> cache longo.
 *  - Todo envio exige a confirmação de autorização de uso de imagem (fica registrada em consent_at).
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const store = require('./db');

const run = promisify(execFile);
const ROOT = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(__dirname, '..', 'uploads');
const DIR = path.join(ROOT, 'gallery');
const TMP = path.join(ROOT, '_tmp');
const MAX_MB = 80;       // tamanho máximo de cada arquivo enviado
const MAX_FILES = 10;    // arquivos por envio
const MAX_ITEMS = 60;    // total na galeria
const MAX_SECONDS = 15;  // duração máxima dos vídeos/GIFs

fs.mkdirSync(DIR, { recursive: true });
fs.rmSync(TMP, { recursive: true, force: true }); // sobras de envios interrompidos
fs.mkdirSync(TMP, { recursive: true });

const IMG = /\.(jpe?g|png|webp)$/i;
const VID = /\.(gif|mp4|m4v|mov|webm)$/i;
const rid = () => crypto.randomBytes(9).toString('hex');
const userError = (msg) => Object.assign(new Error(msg), { userMessage: msg });

const upload = multer({
  storage: multer.diskStorage({ destination: TMP, filename: (req, file, cb) => cb(null, rid()) }),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: MAX_FILES },
});

async function ffmpeg(args) {
  try {
    await run('ffmpeg', ['-y', '-nostdin', '-v', 'error', ...args], { timeout: 180000 });
  } catch (e) {
    if (e.code === 'ENOENT') throw userError('O ffmpeg não está instalado no servidor (necessário para GIFs e vídeos).');
    throw e;
  }
}

// converte um arquivo enviado e devolve { kind, file, poster }
async function convert(tmpPath, originalName) {
  const name = rid();
  if (IMG.test(originalName)) {
    const file = `${name}.webp`;
    await sharp(tmpPath)
      .rotate() // respeita a orientação da câmera (foto de celular não fica deitada)
      .resize({ width: 1200, height: 1500, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(DIR, file));
    return { kind: 'image', file, poster: null };
  }
  if (VID.test(originalName)) {
    const file = `${name}.mp4`;
    const poster = `${name}.webp`;
    const out = path.join(DIR, file);
    const cover = path.join(DIR, poster);
    await ffmpeg([
      '-i', tmpPath, '-t', String(MAX_SECONDS), '-an',
      '-vf', "scale='trunc(min(720,iw)/2)*2':-2,fps=30,format=yuv420p",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-movflags', '+faststart', out,
    ]);
    const frame = (ss) => ffmpeg([...ss, '-i', out, '-frames:v', '1', '-vf', "scale='min(720,iw)':-2", '-c:v', 'libwebp', '-quality', '80', cover]);
    await frame(['-ss', '0.5']).catch(() => {});
    if (!fs.existsSync(cover)) await frame([]); // vídeo mais curto que 0,5 s: usa o primeiro quadro
    return { kind: 'video', file, poster };
  }
  throw userError('Formato não aceito. Use JPG, PNG, WebP, GIF, MP4, MOV ou WebM.');
}

const url = (f) => `/media/gallery/${f}`;
const pub = (r) => ({
  id: r.id, kind: r.kind, url: url(r.file), poster: r.poster ? url(r.poster) : null,
  caption: r.caption || '', visible: !!r.visible, consentAt: r.consentAt,
});
const rmFiles = (r) => Promise.all([r.file, r.poster].filter(Boolean).map((f) => fs.promises.rm(path.join(DIR, f), { force: true })));

// itens visíveis para o site público (nunca derruba a página se o banco falhar)
async function listPublic() {
  if (!store.isReady()) return [];
  try { return (await store.galleryList({ visibleOnly: true })).map(pub); } catch (e) {
    console.error('[gallery] não consegui ler a galeria:', e.message);
    return [];
  }
}

// arquivos enviados: nome aleatório -> cache longo
const media = (isProd) => express.static(DIR, {
  index: false, dotfiles: 'ignore', maxAge: isProd ? '30d' : 0, immutable: !!isProd,
  setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff'); },
});

// rotas do painel (montadas em /admin/api)
function mount(router, guard, wrap, onChange) {
  const idOf = (req) => { const n = Number(req.params.id); return Number.isInteger(n) && n > 0 ? n : null; };

  router.get('/gallery', guard, wrap(async (req, res) => {
    res.json({ items: (await store.galleryList()).map(pub), max: MAX_ITEMS, maxSeconds: MAX_SECONDS, maxMb: MAX_MB });
  }));

  const receive = (req, res, next) => upload.array('files', MAX_FILES)(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === 'LIMIT_FILE_SIZE' ? `Arquivo grande demais (máx. ${MAX_MB} MB cada).`
      : /LIMIT_FILE_COUNT|LIMIT_UNEXPECTED_FILE/.test(err.code) ? `Envie no máximo ${MAX_FILES} arquivos por vez.`
        : 'Falha no envio.';
    res.status(400).json({ error: msg });
  });

  router.post('/gallery', guard, receive, wrap(async (req, res) => {
    const files = req.files || [];
    try {
      if (req.body.consent !== '1') return res.status(400).json({ error: 'Confirme que você tem autorização de uso de imagem dos pacientes.' });
      if (!files.length) return res.status(400).json({ error: 'Escolha pelo menos um arquivo.' });
      if ((await store.galleryCount()) + files.length > MAX_ITEMS) return res.status(400).json({ error: `A galeria aceita até ${MAX_ITEMS} itens. Exclua alguns antes de enviar mais.` });

      const added = [];
      const failed = [];
      for (const f of files) { // um por vez: conversão de vídeo é pesada
        try {
          const r = await convert(f.path, f.originalname);
          added.push(pub(await store.galleryAdd(r)));
        } catch (e) {
          failed.push({ name: f.originalname, error: e.userMessage || 'Não consegui converter este arquivo (está corrompido?).' });
          if (!e.userMessage) console.error('[gallery]', f.originalname, e.message);
        }
      }
      if (added.length) onChange();
      res.json({ ok: true, added, failed });
    } finally {
      await Promise.all(files.map((f) => fs.promises.rm(f.path, { force: true })));
    }
  }));

  router.put('/gallery/order', guard, wrap(async (req, res) => {
    const ids = req.body && req.body.ids;
    if (!Array.isArray(ids) || ids.length > MAX_ITEMS * 2 || !ids.every((n) => Number.isInteger(n) && n > 0)) return res.status(400).json({ error: 'Ordem inválida.' });
    await store.galleryReorder(ids);
    onChange();
    res.json({ ok: true });
  }));

  router.patch('/gallery/:id', guard, wrap(async (req, res) => {
    const id = idOf(req);
    const { caption, visible } = req.body || {};
    const ok = id && await store.galleryUpdate(id, { caption: typeof caption === 'string' ? caption.trim() : undefined, visible: typeof visible === 'boolean' ? visible : undefined });
    if (!ok) return res.status(400).json({ error: 'Não foi possível atualizar.' });
    onChange();
    res.json({ ok: true });
  }));

  router.delete('/gallery/:id', guard, wrap(async (req, res) => {
    const id = idOf(req);
    const row = id && await store.galleryGet(id);
    if (!row) return res.status(404).json({ error: 'Item não encontrado.' });
    await store.galleryDelete(id);
    await rmFiles(row);
    onChange();
    res.json({ ok: true });
  }));
}

module.exports = { mount, media, listPublic, convert, DIR };

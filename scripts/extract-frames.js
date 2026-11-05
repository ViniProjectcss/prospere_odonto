#!/usr/bin/env node
/**
 * Converte o vídeo em uma sequência de frames WebP + manifest.json.
 *
 * Uso:
 *   npm run frames                          -> usa video/clinica.mp4
 *   npm run frames -- --input video/novo.mp4 --width 1920 --fps 24 --quality 72
 *
 * Quando trocar o vídeo para alta qualidade, é só rodar de novo.
 * O front lê o manifest e se adapta sozinho (nº de frames, proporção).
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const root = path.resolve(__dirname, '..');
const input = path.resolve(root, args.input || 'video/clinica.mp4');
const width = parseInt(args.width || '1600', 10);
const fps = parseInt(args.fps || '24', 10);
const quality = parseInt(args.quality || '70', 10);
const outDir = path.join(root, 'public', 'frames');

if (!fs.existsSync(input)) {
  console.error(`Vídeo não encontrado: ${input}`);
  process.exit(1);
}

const run = (cmd, a) => {
  const r = spawnSync(cmd, a, { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(r.stderr || `Falha ao executar ${cmd}`);
    process.exit(r.status || 1);
  }
  return r.stdout.trim();
};

// limpa frames antigos
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) {
  if (/\.(webp|json|jpg)$/.test(f)) fs.rmSync(path.join(outDir, f));
}

console.log(`> Extraindo frames de ${path.relative(root, input)} (largura ${width}px, ${fps}fps, q${quality})`);
run('ffmpeg', [
  '-v', 'error', '-y', '-i', input,
  '-vf', `fps=${fps},scale=${width}:-2:flags=lanczos`,
  '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '4',
  path.join(outDir, '%04d.webp'),
]);

const frames = fs.readdirSync(outDir).filter((f) => f.endsWith('.webp')).length;
const probe = run('ffprobe', [
  '-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path.join(outDir, '0001.webp'),
]).split(',').map(Number);

// poster leve para o primeiro paint
run('ffmpeg', ['-v', 'error', '-y', '-i', path.join(outDir, '0001.webp'),
  '-vf', 'scale=800:-2', '-q:v', '4', path.join(outDir, 'poster.jpg')]);

const bytes = fs.readdirSync(outDir)
  .filter((f) => f.endsWith('.webp'))
  .reduce((s, f) => s + fs.statSync(path.join(outDir, f)).size, 0);

const manifest = {
  frames,
  width: probe[0],
  height: probe[1],
  pattern: '/frames/{n}.webp',
  digits: 4,
  fps,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`> ${frames} frames | ${probe[0]}x${probe[1]} | ${(bytes / 1048576).toFixed(1)} MB total`);

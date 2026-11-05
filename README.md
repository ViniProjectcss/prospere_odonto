# Prospere Odonto — site com vídeo controlado pelo scroll

HTML + CSS + JS (módulos ES, sem framework) e servidor Node.js/Express.

## Rodar

```bash
npm install
npm run dev        # http://localhost:3000 (sem cache)
npm start          # modo produção (cache + dados em memória)
```

## Trocar o vídeo (alta qualidade)

1. Coloque o arquivo em `video/` (ex.: `video/clinica-hq.mp4`).
2. Rode:
   ```bash
   npm run frames -- --input video/clinica-hq.mp4 --width 1920 --fps 24 --quality 72
   ```
3. Pronto. O front lê `public/frames/manifest.json` e se adapta (nº de frames e proporção).

Requer `ffmpeg` instalado. Dicas: `--width 1600` equilibra peso/nitidez; sobe para 1920 se o
site for hospedado com CDN. Menos `--fps` = menos frames = carrega mais rápido (scroll menos suave).

## Editar textos da clínica

Tudo em `config/clinic.json` (endereço, horários, WhatsApp, tratamentos, diferenciais).
Campos `[EDITAR]` são placeholders. O número do WhatsApp vai no formato `5511999999999`.

Os 4 textos que aparecem durante o vídeo ficam em `public/index.html` (`.chapter`);
`data-from`/`data-to` definem em que ponto do scroll (0 a 1) cada um aparece.

## Estrutura

```
server.js                 Express: estáticos, /api/clinic, cache, headers
config/clinic.json        conteúdo da clínica
scripts/extract-frames.js vídeo -> frames WebP + manifest
public/js/frames.js       carregamento progressivo dos frames
public/js/scrub.js        scroll -> frame no canvas, capítulos, HUD
public/js/main.js         boot, render do conteúdo, reveals
```

## Como funciona (resumo)

- O vídeo vira sequência de frames desenhada num `<canvas>`; o progresso do scroll escolhe o frame.
- Carregamento progressivo (1 a cada 8 frames → 4 → 2 → todos): o site abre rápido e fica mais suave conforme carrega.
- Suavização por lerp, redesenho só quando o frame muda, loop pausado fora da viewport.
- Celulares/dispositivos fracos usam metade dos frames.
- `prefers-reduced-motion` respeitado.

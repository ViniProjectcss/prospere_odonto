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


# Prospere Odonto — site com vídeo controlado pelo scroll + painel admin

HTML + CSS + JS (módulos ES, sem framework), servidor Node.js/Express e banco MySQL/MariaDB.

## Rodar

```bash
npm install
# 1) crie o banco vazio (DBeaver):  CREATE DATABASE prospere_odonto CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
# 2) copie .env.example para .env e preencha (banco, usuário/senha do painel, SESSION_SECRET)
npm run dev        # http://localhost:3000        (painel: http://localhost:3000/admin)
```

Na primeira vez o servidor cria as tabelas sozinho e grava o conteúdo inicial do site.
Se o banco estiver fora do ar, o site público continua funcionando (com o conteúdo padrão); só o painel fica indisponível.

## Painel admin (/admin)

Edita **todos os textos** do site e os **cartões** que aparecem sobre o vídeo.
**Não** edita o vídeo, os frames nem as pausas (isso fica no código: `server/scenes.js`).

- Login e senha ficam no `.env` (`ADMIN_USER`, `ADMIN_PASSWORD`). Nunca suba o `.env` para o GitHub.
- Nos títulos, `*palavra*` vira destaque em itálico dourado.
- Cada "Salvar" guarda uma versão (últimas 100). Em **Histórico** dá para restaurar qualquer uma.
  A versão #1 é o conteúdo original — restaurar ela volta o site ao padrão.
- Cartões do vídeo: você escolhe a etapa (1 a 4) e o lado. Cartões de lados diferentes na mesma etapa aparecem juntos;
  do mesmo lado, um depois do outro. O sistema calcula os tempos sozinho.

## Cartão flutuante de contato + LGPD

Pílula discreta que acompanha o scroll da esquerda para a direita e abre um formulário (nome, e-mail, telefone,
anti-robô e aceite da Política de Privacidade). Só aparece se **tudo** estiver pronto: `LEADS_ENCRYPTION_KEY` no `.env`,
Turnstile (em produção) e, no painel > **Privacidade (LGPD)**, razão social, CNPJ e e-mail do encarregado.

- Nome, e-mail e telefone ficam **criptografados** no banco (AES-256-GCM). **Guarde uma cópia da chave.**
- Guardamos a prova do consentimento: data/hora, texto aceito, versão da política e hash do IP.
- Apagamento automático após `LEADS_RETENTION_DAYS` (padrão 365). O número aparece na política sozinho.
- Painel > **Contatos recebidos**: buscar, mudar situação, exportar (CSV/JSON), excluir, e "excluir tudo deste e-mail"
  (pedido do titular). Exportações e exclusões ficam no `audit_log` (sem dados pessoais).
- Página pública `/privacidade`, gerada a partir do que o sistema faz. É um texto-base: **revise com um advogado**.
- Em produção use HTTPS (a política afirma isso) e `TRUST_PROXY` se houver proxy.

## Vídeo / frames (travado)

1. Coloque o arquivo em `video/` (ex.: `video/clinica-hq.mp4`).
2. `npm run frames -- --input video/clinica-hq.mp4 --width 1920 --fps 24 --quality 72`
3. O front lê `public/frames/manifest.json` e se adapta. Se mudar o nº de frames, confira `PAUSES` e `SCENES` em `server/scenes.js`.

## Estrutura

```
server.js                  Express: estáticos, página montada com o banco, painel, headers
.env / .env.example        segredos (banco e painel)  — .env NUNCA vai para o Git
config/clinic.json         usado só na 1ª vez, para popular o banco
server/db.js               MySQL: conexão, tabelas, conteúdo e versões
server/auth.js             login do painel (sessão em cookie assinado, limite de tentativas)
server/admin-api.js        rotas /admin/api
server/validate.js         valida o conteúdo antes de salvar (bloqueia link perigoso etc.)
server/defaults.js         conteúdo inicial
server/scenes.js           PAUSAS e etapas do vídeo (travadas)
server/icons.js            ícones dos cartões
server/render.js           monta o HTML com os textos (tudo escapado)
server/template.html       molde da página (antigo public/index.html)
server/site.js             entrega a página (cache de 60s em produção)
server/leads.js            contatos: criptografia, anti-robô, API pública, exportar/excluir, retenção
server/privacy.js          página /privacidade (Política de Privacidade)
public/admin/              painel: index.html, admin.css, admin.js, schema.js (campos), form.js (formulários)
public/js/frames.js        carregamento progressivo dos frames
public/js/scrub.js         scroll -> frame no canvas, pausas, capítulos
public/js/hero-info.js     cartões sobre o vídeo
public/js/smile-scan.js    seção do scan 3D
public/js/lead-card.js     cartão flutuante de contato
public/css/lead.css        estilo do cartão (e link do rodapé)
public/css/legal.css       estilo da página de privacidade
public/js/main.js          boot, reveals
```

## Como funciona (resumo)

- O vídeo vira sequência de frames desenhada num `<canvas>`; o progresso do scroll escolhe o frame.
- Pausas: em alguns frames o vídeo "segura" enquanto o scroll continua e os cartões passam.
- Carregamento progressivo (1 a cada 8 frames → 4 → 2 → todos).
- Celulares/dispositivos fracos usam metade dos frames. `prefers-reduced-motion` respeitado.

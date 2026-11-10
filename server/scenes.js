'use strict';
/**
 * ETAPAS DO VÍDEO — TRAVADAS NO CÓDIGO (o painel não altera nada daqui).
 *
 * PAUSES: em qual frame o vídeo para e por quanto do scroll total (0.2 = 20%).
 * SCENES: janela de scroll (0 a 1) de cada capítulo/etapa.
 *
 * ATENÇÃO: se mudar PAUSES (ou a altura do .scrub no CSS), ajuste SCENES para
 * os capítulos e cartões continuarem sincronizados com as pausas.
 * Com as pausas atuais (frames 110 e 245, hold 0.2) o scroll parado fica em
 * 0.170–0.370 e 0.578–0.778.
 */
const fs = require('node:fs');
const path = require('node:path');

const PAUSES = [
  { frame: 110, hold: 0.2 }, // etapa 2 — Acolhimento
  { frame: 245, hold: 0.2 }, // etapa 3 — Ambiente
];

const SCENES = [
  { from: 0, to: 0.14 },
  { from: 0.14, to: 0.4 },
  { from: 0.5, to: 0.8 },
  { from: 0.82, to: 1 },
];

const LEAD_X = { left: 0, center: 0.5, right: 1 };

// converte "etapa → posição" no caminho { p, x } que o lead-card.js espera.
// Em cada etapa ele fica parado no miolo e desliza nas bordas, entre uma etapa e a seguinte.
function leadPathForClient(positions = []) {
  const pts = [];
  SCENES.forEach((s, i) => {
    const x = LEAD_X[positions[i] && positions[i].side] ?? 1;
    const len = s.to - s.from;
    const a = i === 0 ? 0.03 : s.from + len * 0.15;
    const b = i === SCENES.length - 1 ? 1 : s.to - len * 0.15;
    pts.push({ p: r(a), x }, { p: r(b), x });
  });
  return pts;
}

// último índice de frame (nº de frames - 1), lido do manifest gerado pelo extract-frames
function lastFrame() {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'frames', 'manifest.json'), 'utf8'));
    return Math.max(1, Number(m.frames) - 1);
  } catch {
    return 389;
  }
}

const r = (n) => Math.round(n * 10000) / 10000;

// pausas no formato que o scrub.js espera: { at: 0..1, hold }
function pausesForClient() {
  const last = lastFrame();
  return PAUSES.map((p) => ({ at: r(p.frame / last), hold: p.hold }));
}

/**
 * Distribui os cartões no tempo, sem o painel precisar saber de números:
 *  - cartões de LADOS diferentes na mesma etapa aparecem juntos;
 *  - cartões do MESMO lado na mesma etapa aparecem um depois do outro;
 *  - stack = true no 2º lado da etapa (no celular fica abaixo do 1º, sem sobrepor).
 */
function cardSlots(cards) {
  const out = [];
  for (let scene = 1; scene <= 4; scene++) {
    const inScene = cards.filter((c) => c.scene === scene);
    const sides = [];
    inScene.forEach((c) => { if (!sides.includes(c.side)) sides.push(c.side); });
    const { from, to } = SCENES[scene - 1];
    sides.forEach((side, sideIdx) => {
      const group = inScene.filter((c) => c.side === side);
      const len = (to - from) / group.length;
      group.forEach((card, i) => {
        out.push({
          card,
          from: r(from + len * i),
          to: r(from + len * (i + 1)),
          first: scene === 1 && i === 0,                      // já visível no topo da página
          last: scene === 4 && i === group.length - 1,        // permanece até o fim
          stack: sideIdx === 1,
        });
      });
    });
  }
  return out;
}

module.exports = { PAUSES, SCENES, leadPathForClient, pausesForClient, cardSlots };

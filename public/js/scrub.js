/**
 * Scrub: liga o progresso do scroll à sequência de frames num <canvas>
 * e controla os capítulos de texto + HUD.
 *
 * - Suavização por lerp (a imagem "persegue" o scroll => sensação de inércia)
 * - Só redesenha quando o frame muda
 * - Canvas com DPR limitado para não pesar em telas 3x
 */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Enquadramento em telas verticais (celular): o vídeo é horizontal, então só cabe uma faixa dele.
 * Aqui dizemos onde está o assunto em cada ponto do vídeo: [nº do quadro, posição horizontal 0..1].
 * 0 = borda esquerda, 0.5 = centro, 1 = borda direita. Entre um ponto e outro a câmera desliza suave.
 * Em telas horizontais (computador) isso não muda nada. Se trocar o vídeo, ajuste estes números.
 */
const FOCUS_LAST = 389; // último quadro (nº de quadros - 1) do vídeo atual
const FOCUS = [
  [0, 0.5],    // porta fechada
  [60, 0.5],   // porta abrindo, neon ao fundo
  [110, 0.45], // parede verde com o neon (pausa 1)
  [140, 0.43], // aproximando do neon
  [170, 0.58], // corredor: TV, parede verde e sala de atendimento
  [200, 0.62],
  [245, 0.66], // sala de atendimento: dentista e cadeira (pausa 2)
  [310, 0.66],
  [370, 0.6],  // mãos da dentista no paciente
  [389, 0.58],
].map(([f, x]) => [f / FOCUS_LAST, x]);

function focusAt(p) {
  if (p <= FOCUS[0][0]) return FOCUS[0][1];
  for (let i = 1; i < FOCUS.length; i++) {
    if (p <= FOCUS[i][0]) {
      const k = (p - FOCUS[i - 1][0]) / ((FOCUS[i][0] - FOCUS[i - 1][0]) || 1);
      return FOCUS[i - 1][1] + (FOCUS[i][1] - FOCUS[i - 1][1]) * smooth(clamp(k));
    }
  }
  return FOCUS[FOCUS.length - 1][1];
}

export class Scrub {
  constructor({ section, canvas, sequence, chapters, progressEl, countEl, hintEl, ease = 0.12, pauses = [] }) {
    this.section = section;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.seq = sequence;
    this.chapters = chapters.map((el) => ({
      el,
      from: parseFloat(el.dataset.from),
      to: parseFloat(el.dataset.to),
    }));
    this.progressEl = progressEl;
    this.countEl = countEl;
    this.hintEl = hintEl;
    this.ease = ease;

    this.target = 0;   // progresso real do scroll (0..1)
    this.current = 0;  // progresso suavizado
    this.lastDrawn = -1;
    this.lastChapter = -1;
    this.running = false;

    this.resize = this.resize.bind(this);
    this.onScroll = this.onScroll.bind(this);
    this.tick = this.tick.bind(this);
    this.sticky = section.querySelector('.scrub__sticky');

    const sorted = [...pauses].sort((a, b) => a.at - b.at);
  const totalHold = sorted.reduce((s, p) => s + p.hold, 0);
  this.videoLen = 1 - totalHold;
  let before = 0;
  this.holds = sorted.map((p) => {
    const start = p.at * this.videoLen + before;
    before += p.hold;
    return { v: p.at, start, end: start + p.hold, hold: p.hold };
  });
  console.table(this.holds); // temporário: mostra em que scroll cada pausa começa e termina
}



  

  init() {
    this.resize();
    this.onScroll();
    this.current = this.target;
    addEventListener('resize', this.resize, { passive: true });
    addEventListener('scroll', this.onScroll, { passive: true });
    this.start();
    // pausa o loop fora da viewport
    new IntersectionObserver(([e]) => (e.isIntersecting ? this.start() : this.stop()), { rootMargin: '200px' })
      .observe(this.section);
  }

  start() { if (!this.running) { this.running = true; requestAnimationFrame(this.tick); } }
  stop() { this.running = false; }

  resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(this.canvas.clientWidth * dpr);
  const h = Math.round(this.canvas.clientHeight * dpr);
  this.total = Math.max(1, this.section.offsetHeight - this.sticky.offsetHeight);
  if (w === this.canvas.width && h === this.canvas.height) return; // só a barra do navegador mexeu
  this.canvas.width = w;
  this.canvas.height = h;
  this.lastDrawn = -1; // força redesenho
  this.sectionTop = null;
}

onScroll() {
  const rect = this.section.getBoundingClientRect();
  this.target = clamp(-rect.top / this.total);
}

  draw(local) {
    const img = this.seq.nearest(local);
    if (!img) return;
    const cw = this.canvas.width, ch = this.canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    // "cover": preenche a tela sem distorcer
    const s = Math.max(cw / iw, ch / ih);
    const dw = iw * s, dh = ih * s;
    // sobra imagem dos lados (tela vertical)? centraliza no assunto em vez de no meio do quadro
    const fx = focusAt(local / Math.max(1, this.seq.count - 1));
    const dx = clamp(cw / 2 - fx * dw, cw - dw, 0);
    this.ctx.drawImage(img, dx, (ch - dh) / 2, dw, dh);
  }

  videoProgress(p) {
  let removed = 0;
  for (const h of this.holds) {
    if (p < h.start) break;
    if (p < h.end) return h.v;   // dentro da pausa: frame congelado
    removed += h.hold;
  }
  return clamp((p - removed) / this.videoLen);
}

  updateChapters(p) {
    let active = 0;
    this.chapters.forEach((c, i) => {
      const span = c.to - c.from;
      const t = (p - c.from) / span;
      let o = 0;
      const first = i === 0;                       // já visível no topo da página
      const last = i === this.chapters.length - 1; // permanece até o fim do vídeo
      if (t < 1 || last) {
        const fadeIn = first ? 1 : smooth(clamp(t / 0.22));
        const fadeOut = last ? 1 : 1 - smooth(clamp((t - 0.78) / 0.22));
        o = (t > 0 || first) ? Math.min(fadeIn, fadeOut) : 0;
      }
      if (p >= c.from) active = i;
      const inT = first ? 1 : fadeInOnly(t);
      const y = (1 - inT) * 28 - (!last && t > 0.78 ? (t - 0.78) * 60 : 0);
      c.el.style.opacity = o.toFixed(3);
      c.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
    });
    if (active !== this.lastChapter) {
      this.lastChapter = active;
      this.countEl.textContent = String(active + 1).padStart(2, '0');
    }
  }

  tick() {
    if (!this.running) return;
    const diff = this.target - this.current;
    this.current = Math.abs(diff) < 0.00005 ? this.target : this.current + diff * this.ease;

    const local = Math.round(this.videoProgress(this.current) * (this.seq.count - 1));
    window.__frame = local; 
    if (local !== this.lastDrawn || this.seq.loaded !== this._loadedAtDraw) {
      this.draw(local);
      this.lastDrawn = local;
      this._loadedAtDraw = this.seq.loaded;
    }
    this.progressEl.style.transform = `scaleX(${this.current.toFixed(4)})`;
    this.updateChapters(this.current);
    
    requestAnimationFrame(this.tick);
  }
}

function fadeInOnly(t) {
  return smooth(clamp(t / 0.22));
}

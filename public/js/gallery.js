/**
 * Carrossel da galeria de pacientes.
 *  - Anda sozinho, devagar e sem parar (loop infinito).
 *  - Pausa com o mouse em cima, ao arrastar, ou pelo botão "Pausar".
 *  - Arrasta com o mouse ou o dedo.
 *  - Vídeos/GIFs (mudos) só carregam e tocam quando aparecem na tela.
 *  - prefers-reduced-motion: começa pausado e os vídeos ficam só com a capa.
 */
(() => {
  const view = document.querySelector('[data-gallery]');
  if (!view) return;
  const track = view.querySelector('.gal__track');
  const toggle = document.querySelector('[data-gal-toggle]');
  const originals = [...track.children];
  if (!originals.length) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPEED = 38; // pixels por segundo
  let setW = 0, offset = 0, last = performance.now();
  let userPaused = reduce, hoverPaused = false, dragging = false, onScreen = false;

  const apply = () => { track.style.transform = `translate3d(${-offset}px,0,0)`; };
  const wrap = () => { if (setW > 0) offset = ((offset % setW) + setW) % setW; };

  // repete os itens o bastante para a faixa nunca acabar
  function build() {
    track.querySelectorAll('[data-clone]').forEach((n) => n.remove());
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    setW = originals.reduce((s, n) => s + n.getBoundingClientRect().width + gap, 0);
    if (setW <= 0) return;
    const extra = Math.ceil(view.clientWidth / setW) + 1;
    for (let i = 0; i < extra; i++) {
      originals.forEach((n) => {
        const c = n.cloneNode(true);
        c.dataset.clone = '';
        c.setAttribute('aria-hidden', 'true');
        track.append(c);
        watchVideos(c);
      });
    }
    wrap();
    apply();
  }

  // ---- animação ----
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    if (!onScreen || dragging || userPaused || hoverPaused) return;
    offset += SPEED * dt;
    wrap();
    apply();
  }

  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }, { rootMargin: '100px' }).observe(view);

  // ---- arrastar (mouse e dedo); a rolagem vertical da página continua normal ----
  let startX = 0, startOffset = 0;
  view.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startOffset = offset;
    view.classList.add('is-drag');
    try { view.setPointerCapture(e.pointerId); } catch { /* ignora */ }
  });
  view.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    offset = startOffset - (e.clientX - startX);
    wrap();
    apply();
  });
  const endDrag = () => { dragging = false; view.classList.remove('is-drag'); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => view.addEventListener(ev, endDrag));
  view.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hoverPaused = true; });
  view.addEventListener('pointerleave', () => { hoverPaused = false; });

  // ---- botão pausar / reproduzir ----
  function setPaused(p) {
    userPaused = p;
    if (!toggle) return;
    toggle.setAttribute('aria-pressed', String(p));
    toggle.textContent = p ? 'Reproduzir' : 'Pausar';
  }
  if (toggle) toggle.addEventListener('click', () => setPaused(!userPaused));
  setPaused(reduce);

  // ---- vídeos: só tocam quando aparecem ----
  const vio = reduce ? null : new IntersectionObserver((entries) => entries.forEach(({ target: v, isIntersecting }) => {
    if (isIntersecting) {
      if (!v.getAttribute('src')) v.src = v.dataset.src;
      v.play().catch(() => { /* o navegador pode bloquear; a capa continua aparecendo */ });
    } else {
      v.pause();
    }
  }), { rootMargin: '150px' });
  function watchVideos(root) { if (vio) root.querySelectorAll('video[data-src]').forEach((v) => vio.observe(v)); }
  originals.forEach(watchVideos);

  // ---- início e redimensionamento ----
  build();
  requestAnimationFrame(frame);
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 150); }, { passive: true });
})();

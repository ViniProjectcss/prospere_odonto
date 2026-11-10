import { FrameSequence } from './frames.js';
import { Scrub } from './scrub.js';

const $ = (s, r = document) => r.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Reveal ao entrar na tela ---------- */
function setupReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    io.observe(el);
  });
}

/* ---------- Nav sólida depois do vídeo começar ---------- */
function setupNav() {
  const nav = $('#nav');
  const on = () => nav.classList.toggle('is-solid', scrollY > 40);
  addEventListener('scroll', on, { passive: true }); on();
}

/* ---------- Boot ---------- */
async function boot() {
  // os textos já vêm prontos do servidor (banco de dados)
  const manifest = await fetch('/frames/manifest.json').then((r) => r.json());
  setupReveal();
  setupNav();

  // Dispositivos fracos: usa 1 a cada 2 frames (metade do peso e da memória)
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    navigator.connection?.saveData || innerWidth < 760;
  const stride = weak ? 2 : 1;

  const loaderBar = $('#loaderBar');
  const loaderPct = $('#loaderPct');
  const seq = new FrameSequence(manifest, {
    stride,
    onProgress: (p) => {
      // o loader considera só o primeiro passe (~1/8 dos frames)
      const shown = Math.min(1, p * 8);
      loaderBar.style.transform = `scaleX(${shown})`;
      loaderPct.textContent = `${Math.round(shown * 100)}%`;
    },
  });

  await seq.start({ concurrency: weak ? 4 : 8 });

  const scrub = new Scrub({
    section: $('#scrub'),
    canvas: $('#stage'),
    sequence: seq,
    chapters: [...document.querySelectorAll('.chapter')],
    progressEl: $('#progress'),
    countEl: $('#hudNow'),
    hintEl: $('#hint'),
    ease: reduceMotion ? 1 : 0.12,
    pauses: JSON.parse($('#scrub').dataset.pauses || '[]'), // vem do servidor (server/scenes.js)
  });
  scrub.init();

  document.body.classList.remove('is-loading');
  $('#loader').classList.add('is-done');
}

boot().catch((err) => {
  console.error(err);
  // se algo falhar, nunca deixa o visitante preso no loader
  document.body.classList.remove('is-loading');
  $('#loader')?.classList.add('is-done');
});

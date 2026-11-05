import { FrameSequence } from './frames.js';
import { Scrub } from './scrub.js';

const $ = (s, r = document) => r.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Conteúdo da clínica (vem de /api/clinic) ---------- */
function esc(s = '') {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderClinic(c) {
  $('#aboutTitle').textContent = c.about.title;
  $('#aboutText').textContent = c.about.text;
  $('#stats').innerHTML = c.stats.map((s) => `<div><dt>${esc(s.value)}</dt><dd>${esc(s.label)}</dd></div>`).join('');
  $('#services').innerHTML = c.services.map((s) => `<li class="reveal"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('');
  $('#diff').innerHTML = c.differentials
    .map((d, i) => `<article class="card reveal"><span class="card__n">0${i + 1}</span><h3>${esc(d.title)}</h3><p>${esc(d.text)}</p></article>`)
    .join('');
  $('#address').innerHTML = `${esc(c.address.line1)}<br>${esc(c.address.line2)}`;
  $('#hours').innerHTML = c.hours.map((h) => `<li><span>${esc(h.days)}</span><b>${esc(h.time)}</b></li>`).join('');

  const insta = $('#instaLink');
  insta.href = c.instagram.url;
  insta.textContent = `@${c.instagram.handle}`;

  const wa = `https://wa.me/${c.whatsapp.number}?text=${encodeURIComponent(c.whatsapp.message)}`;
  document.querySelectorAll('[data-whatsapp]').forEach((a) => {
    a.href = wa; a.target = '_blank'; a.rel = 'noopener noreferrer';
  });
  $('#year').textContent = new Date().getFullYear();
}

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
  const [clinic, manifest] = await Promise.all([
    fetch('/api/clinic').then((r) => r.json()),
    fetch('/frames/manifest.json').then((r) => r.json()),
  ]);
  renderClinic(clinic);
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
    pauses: [
  { at: 110 / 389, hold: 0.2 },   // 02 Acolhimento
  { at: 245 / 389, hold: 0.2 },   // 03 Ambiente
],
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

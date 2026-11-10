/* Cartões de informação do hero: seguem o mesmo progresso de scroll e a mesma lógica de fade dos capítulos. */
(() => {
  const sec = document.getElementById('scrub');
  if (!sec) return;
  const cards = [...sec.querySelectorAll('.info')].map((el) => ({ el, from: +el.dataset.from, to: +el.dataset.to, first: el.hasAttribute('data-first'), last: el.hasAttribute('data-last') }));
  const sticky = sec.querySelector('.scrub__sticky');
  if (!cards.length) return;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let target = 0, cur = 0, vis = true;

  const read = () => { const r = sec.getBoundingClientRect(); target = clamp(-r.top / Math.max(1, sec.offsetHeight - sticky.offsetHeight)); };
  addEventListener('scroll', read, { passive: true }); addEventListener('resize', read); read(); cur = target;
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; }, { rootMargin: '200px' }).observe(sec);

  function apply(p) {
    cards.forEach((c) => {
      const first = c.first, last = c.last, t = (p - c.from) / (c.to - c.from);
      let o = 0;
      if (t < 1 || last) {
        const fin = first ? 1 : smooth(clamp(t / .22)), fout = last ? 1 : 1 - smooth(clamp((t - .78) / .22));
        o = (t > 0 || first) ? Math.min(fin, fout) : 0;
      }
      const y = (1 - (first ? 1 : smooth(clamp(t / .22)))) * 28 - (!last && t > .78 ? (t - .78) * 60 : 0);
      c.el.style.opacity = o.toFixed(3);
      c.el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      c.el.style.pointerEvents = o > .6 ? 'auto' : 'none';
      c.el.setAttribute('aria-hidden', o < .3 ? 'true' : 'false');
    });
  }
  apply(cur);
  (function loop() {
    requestAnimationFrame(loop);
    if (!vis) return;
    cur = reduce ? target : cur + (target - cur) * .12;
    apply(cur);
  })();
})();
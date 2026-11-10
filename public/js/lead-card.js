/**
 * Cartão de contato.
 *  - Um botão fixo (CTA) no canto inferior direito aparece depois de um pouco de scroll.
 *  - Clique no CTA (ou em qualquer elemento com [data-lc-open]) abre o formulário numa gaveta lateral
 *    (desktop) ou numa folha na parte de baixo (celular).
 *  - Fecha com "×", clique no fundo escurecido ou Esc.
 *  - Anti-robô (Cloudflare Turnstile) só carrega quando a gaveta é aberta.
 *  - Depois do envio, mostra o agradecimento, fecha sozinho e o CTA some até fechar a aba (sessionStorage).
 */
(() => {
  'use strict';
  const root = document.getElementById('lc');
  if (!root) return; // o servidor não liberou o cartão
  document.body.classList.add('has-lc'); // o CSS usa isto para não repetir o botão "Agendar" no celular

  const $ = (id) => document.getElementById(id);
  const pill = $('lcPill');
  const panel = $('lcPanel'), closeBtn = $('lcClose');
  const form = $('lcForm'), formView = $('lcFormView'), done = $('lcDone');
  const submitBtn = $('lcSubmit'), status = $('lcStatus');
  const inputs = { name: $('lcName'), email: $('lcEmail'), phone: $('lcPhone') };
  const consent = $('lcConsent'), honeypot = $('lcWebsite'), captchaBox = $('lcCaptcha');
  const errBox = { name: $('lcNameErr'), email: $('lcEmailErr'), phone: $('lcPhoneErr'), consent: $('lcConsentErr'), captcha: $('lcCaptchaErr') };
  let msgs = {};
  try { msgs = JSON.parse(root.dataset.msgs || '{}'); } catch { /* usa vazio */ }
  const siteKey = root.dataset.sitekey;

  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* ignora */ } },
  };
  if (session.get('lc-hidden') === '1') { root.remove(); return; }

  /* ---------- gaveta: abrir / fechar ---------- */
  let open = false, finished = false, dead = false, lastTrigger = null;

  const backdrop = document.createElement('div');
  backdrop.className = 'lc__backdrop';
  backdrop.hidden = true;
  root.prepend(backdrop);

  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', (panel.querySelector('.lc__title')?.textContent || 'Agendar avaliação').trim());

  /* ---------- botão: ícone + texto claro + dica ---------- */
  // Textos do botão e da dica. Para trocar, edite aqui (ou envie data-label no #lc pelo servidor).
  const LABEL = root.dataset.label || 'Agendar avaliação';
  const TIP = {
    title: 'Agende sua avaliação',
    text: 'Deixe seu contato e retornamos para marcar o melhor horário.',
    chips: ['Leva 1 minuto', 'Sem compromisso'],
  };

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('class', 'lc__ic');
  icon.innerHTML = '<rect x="3.5" y="5" width="17" height="15" rx="3.5"/><path d="M8 3v4M16 3v4M3.5 10.5h17"/><path d="M9 15l2 2 4-4"/>';
  const label = document.createElement('span');
  label.textContent = LABEL;
  pill.replaceChildren(icon, label);

  const tip = document.createElement('div');
  tip.className = 'lc__tip';
  tip.setAttribute('aria-hidden', 'true'); // o botão já se explica por si só para leitores de tela
  const tipTitle = document.createElement('b'); tipTitle.textContent = TIP.title;
  const tipText = document.createElement('p'); tipText.textContent = TIP.text;
  const tipChips = document.createElement('ul');
  TIP.chips.forEach((c) => { const li = document.createElement('li'); li.textContent = c; tipChips.append(li); });
  tip.append(tipTitle, tipText, tipChips);
  pill.after(tip);

  // uma espiadinha da dica, uma vez por sessão, só em telas com mouse
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let peeked = session.get('lc-peeked') === '1';
  function peek() {
    if (peeked || !canHover || open || dead) return;
    peeked = true;
    session.set('lc-peeked', '1');
    setTimeout(() => {
      if (open || dead) return;
      tip.classList.add('is-peek');
      setTimeout(() => tip.classList.remove('is-peek'), 6000);
    }, 2200);
  }

  // o CTA aparece depois de um respiro de scroll (no topo vale o botão do cabeçalho)
  function syncVisibility() {
    if (dead) return;
    const show = open || scrollY > 80;
    root.classList.toggle('is-visible', show);
    if (show) peek();
  }

  function openPanel(trigger) {
    if (dead || open) return;
    open = true;
    lastTrigger = trigger || pill;
    backdrop.hidden = false;
    panel.hidden = false;
    root.classList.add('is-open', 'is-visible');
    tip.classList.remove('is-peek');
    // os itens do formulário sobem em sequência (o atraso vem de --i no CSS)
    [...panel.querySelectorAll('.lc__title, .lc__lead, .lc__field, .lc__consent, .lc__captcha, .lc__submit')]
      .forEach((el, i) => el.style.setProperty('--i', i));
    pill.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => { backdrop.classList.add('is-on'); panel.classList.add('is-open'); });
    setTimeout(() => (done.hidden ? inputs.name : done).focus({ preventScroll: true }), 150);
    prepare(); // carrega token e Turnstile só agora
  }

  function closePanel(returnFocus = true) {
    if (!open) return;
    open = false;
    root.classList.remove('is-open');
    backdrop.classList.remove('is-on');
    panel.classList.remove('is-open');
    pill.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!open) { panel.hidden = true; backdrop.hidden = true; } }, 360);
    if (finished) { removeCard(); return; }
    // o botão fixo leva um instante para reaparecer (visibility): devolve o foco quando a gaveta terminou de fechar
    if (returnFocus) setTimeout(() => {
      if (open || dead) return;
      (lastTrigger && lastTrigger.isConnected && !lastTrigger.hidden ? lastTrigger : pill).focus({ preventScroll: true });
    }, 400);
    syncVisibility();
  }

  function removeCard() {
    dead = true;
    session.set('lc-hidden', '1');
    root.classList.remove('is-visible', 'is-open');
    document.querySelectorAll('[data-lc-open]').forEach((el) => el.remove());
    setTimeout(() => root.remove(), 600);
  }

  pill.addEventListener('click', () => openPanel(pill));
  closeBtn.addEventListener('click', () => closePanel());
  backdrop.addEventListener('click', () => closePanel());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) closePanel(); });

  // cartão "Agendamento" do fim do vídeo: botão principal abre a gaveta, WhatsApp vira link secundário
document.querySelectorAll('.info__btn[data-whatsapp]').forEach((wa) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn btn--sm info__btn';
  b.dataset.lcOpen = '';
  b.textContent = 'Agendar avaliação';
  wa.before(b);
  wa.className = 'info__cta';
  wa.textContent = 'ou pelo WhatsApp →';
});

  // botões extras (ex.: seção #contato). Só aparecem se o cartão foi liberado pelo servidor
  document.querySelectorAll('[data-lc-open]').forEach((el) => {
    el.hidden = false;
    el.addEventListener('click', (e) => { e.preventDefault(); openPanel(el); });
  });

  // o fundo não rola enquanto a gaveta está aberta (o scroll do vídeo não "anda" por baixo)
  ['wheel', 'touchmove'].forEach((ev) =>
    backdrop.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));

  /* ---------- anti-robô (Cloudflare Turnstile) e token do formulário ---------- */
  let formToken = '', tokenAt = 0, widget = null, captchaToken = '', scriptPromise = null, prepared = false;

  async function fetchToken() {
    try {
      const r = await fetch('/api/leads/token', { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error('token');
      formToken = (await r.json()).token || '';
      tokenAt = Date.now();
    } catch { formToken = ''; }
  }

  function loadTurnstile() {
    if (window.turnstile) return Promise.resolve();
    if (!scriptPromise) {
      scriptPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.onload = resolve;
        s.onerror = () => { scriptPromise = null; reject(new Error('turnstile')); };
        document.head.append(s);
      });
    }
    return scriptPromise;
  }

  async function ensureCaptcha() {
    try { await loadTurnstile(); } catch { showErr('captcha', msgs.generic); return; }
    if (widget !== null || !window.turnstile) return;
    widget = window.turnstile.render(captchaBox, {
      sitekey: siteKey, theme: 'dark', size: 'flexible', language: 'pt-br',
      callback: (t) => { captchaToken = t; clearErr('captcha'); },
      'expired-callback': () => { captchaToken = ''; },
      'error-callback': () => { captchaToken = ''; },
    });
  }

  function resetCaptcha() {
    captchaToken = '';
    if (widget !== null && window.turnstile) { try { window.turnstile.reset(widget); } catch { /* ignora */ } }
  }

  // só quando a gaveta é aberta
  function prepare() {
    if (prepared) return;
    prepared = true;
    fetchToken();
    ensureCaptcha();
  }

  /* ---------- erros ---------- */
  const fieldOf = (k) => inputs[k] || (k === 'consent' ? consent : null);
  function showErr(k, text) {
    errBox[k].textContent = text || msgs.generic || '';
    errBox[k].hidden = false;
    const f = fieldOf(k); if (f) f.setAttribute('aria-invalid', 'true');
  }
  function clearErr(k) {
    errBox[k].hidden = true; errBox[k].textContent = '';
    const f = fieldOf(k); if (f) f.removeAttribute('aria-invalid');
  }
  function clearAll() { Object.keys(errBox).forEach(clearErr); status.hidden = true; status.textContent = ''; }
  function showStatus(text) { status.textContent = text; status.hidden = false; }

  Object.entries(inputs).forEach(([k, el]) => el.addEventListener('input', () => clearErr(k)));
  consent.addEventListener('change', () => clearErr('consent'));

  // máscara de telefone: (11) 99999-9999
  inputs.phone.addEventListener('input', () => {
    let d = inputs.phone.value.replace(/\D/g, '');
    if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
    d = d.slice(0, 11);
    let out = d;
    if (d.length > 2) {
      const cut = d.length > 10 ? 7 : 6;
      out = `(${d.slice(0, 2)}) ${d.slice(2, cut)}${d.length > cut ? '-' + d.slice(cut) : ''}`;
    }
    inputs.phone.value = out;
  });

  /* ---------- enviar ---------- */
  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    clearAll();

    const name = inputs.name.value.trim();
    const email = inputs.email.value.trim();
    const phoneDigits = inputs.phone.value.replace(/\D/g, '');
    const bad = [];
    if (name.length < 2) bad.push('name');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) bad.push('email');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) bad.push('phone');
    if (!consent.checked) bad.push('consent');
    if (!captchaToken) bad.push('captcha');
    if (bad.length) {
      bad.forEach((k) => showErr(k, msgs[k]));
      const first = fieldOf(bad.find((k) => k !== 'captcha'));
      if (first) first.focus();
      return;
    }

    busy = true;
    submitBtn.disabled = true;
    submitBtn.textContent = msgs.sending;
    try {
      if (!formToken || Date.now() - tokenAt > 90 * 60 * 1000) await fetchToken();
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name, email, phone: inputs.phone.value, consent: consent.checked,
          captcha: captchaToken, token: formToken, website: honeypot.value,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        Object.values(inputs).forEach((i) => { i.value = ''; }); // não deixa dado pessoal na tela
        consent.checked = false;
        finished = true;
        formView.hidden = true;
        done.hidden = false;
        done.focus({ preventScroll: true });
        setTimeout(() => closePanel(false), 7000); // fecha sozinho depois do agradecimento
        return;
      }
      if (res.status === 422 && data.fields) {
        Object.keys(data.fields).forEach((k) => showErr(k, msgs[k]));
        const first = fieldOf(Object.keys(data.fields)[0]); if (first) first.focus();
      } else if (res.status === 403 && data.error === 'captcha') {
        showErr('captcha', msgs.captcha);
      } else if (res.status === 429) {
        showStatus(msgs.rate);
      } else {
        if (['token', 'expired', 'too_fast'].includes(data.error)) await fetchToken();
        showStatus(msgs.generic);
      }
      resetCaptcha(); // o código do anti-robô vale uma vez só
    } catch {
      showStatus(msgs.generic);
      resetCaptcha();
    } finally {
      busy = false;
      submitBtn.disabled = false;
      submitBtn.textContent = msgs.submit;
    }
  });

  /* ---------- início ---------- */
  addEventListener('scroll', syncVisibility, { passive: true });
  syncVisibility();
})();
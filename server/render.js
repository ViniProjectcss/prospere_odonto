'use strict';
/**
 * Monta o HTML do site a partir do conteúdo do banco + server/template.html.
 *  - TODO texto passa por esc() (vira texto puro, nunca HTML) -> ninguém injeta código pelo painel.
 *  - Nos títulos, *palavra* vira destaque (<em>), depois de escapar.
 */
const fs = require('node:fs');
const path = require('node:path');
const { ICONS } = require('./icons');
const { SCENES, pausesForClient, cardSlots, leadPathForClient } = require('./scenes');

const TEMPLATE_PATH = path.join(__dirname, 'template.html');
let templateCache = null;
function getTemplate(useCache) {
  if (useCache && templateCache) return templateCache;
  templateCache = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return templateCache;
}

/* ---------- escapes ---------- */
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
const em = (s) => esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');            // título com destaque
const safeUrl = (u) => (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(String(u || '').trim()) ? String(u).trim() : '#');
const pad = (n) => String(n).padStart(2, '0');
const waUrl = (wa = {}) => `https://wa.me/${String(wa.number || '').replace(/\D/g, '')}?text=${encodeURIComponent(wa.message || '')}`;

/* ---------- mescla com os padrões (campo novo nunca quebra o site) ---------- */
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function merge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = isObj(base[k]) && isObj(over[k]) ? merge(base[k], over[k]) : over[k];
  return out;
}

/* ---------- blocos ---------- */
function chapters(list) {
  return list.map((c, i) => {
    const tag = i === 0 ? 'h1' : 'h2';
    return `<div class="chapter${i === 1 ? ' chapter--right' : ''}" data-from="${SCENES[i].from}" data-to="${SCENES[i].to}">
          <p class="chapter__eyebrow"><span>${pad(i + 1)}</span> ${esc(c.eyebrow)}</p>
          <${tag} class="chapter__title">${em(c.title)}</${tag}>
        </div>`;
  }).join('\n        ');
}

function cards(list, wa) {
  return cardSlots(list).map(({ card: k, from, to, first, last, stack }) => {
    const cls = ['info'];
    if (k.side === 'left') cls.push('info--left');
    if (stack) cls.push('info--s2');
    const icon = (ICONS[k.icon] || ICONS.star).svg;
    const parts = [
      `<div class="info__head"><span class="info__ic"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg></span>${esc(k.eyebrow)}</div>`,
      `<h3 class="info__title">${esc(k.title)}</h3>`,
    ];
    if (k.text && k.text.trim()) parts.push(`<p class="info__text">${esc(k.text)}</p>`);
    if (k.items && k.items.length) parts.push(`<ul class="info__list">${k.items.filter((t) => t.trim()).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`);
    if (k.cta && k.cta.label && k.cta.label.trim()) {
      parts.push(k.cta.type === 'whatsapp'
        ? `<a class="btn btn--sm info__btn" data-whatsapp href="${esc(wa)}" target="_blank" rel="noopener noreferrer">${esc(k.cta.label)}</a>`
        : `<a class="info__cta" href="${esc(safeUrl(k.cta.url))}" target="_blank" rel="noopener noreferrer">${esc(k.cta.label)} <i aria-hidden="true">→</i></a>`);
    }
    return `<aside class="${cls.join(' ')}" data-from="${from}" data-to="${to}"${first ? ' data-first' : ''}${last ? ' data-last' : ''} aria-label="${esc(k.title)}">
          ${parts.join('\n          ')}
        </aside>`;
  }).join('\n        ');
}

const labSteps = (steps) => steps.map((s, i) =>
  `<li class="lab__step${i === 0 ? ' is-on' : ''}"><span>${pad(i + 1)}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div></li>`).join('\n              ');

/* ---------- cartão flutuante de contato ---------- */
function leadCardHtml(c, siteKey) {
  const k = c.leadCard;
  const [before, after] = String(k.consentText).split('{politica}');
  const consent = `${esc(before)}<a href="/privacidade" target="_blank" rel="noopener">${esc(k.policyLinkLabel)}</a>${esc(after || '')}`;
  const msgs = { ...k.errors, sending: k.sending, submit: k.submit };
  const field = (id, name, label, type, ac, extra) =>
    `<div class="lc__field"><label for="${id}">${esc(label)}</label><input id="${id}" name="${name}" type="${type}" autocomplete="${ac}" ${extra} required aria-describedby="${id}Err"><p class="lc__err" id="${id}Err" hidden></p></div>`;
    return `<aside class="lc" id="lc" data-sitekey="${esc(siteKey)}" data-path="${esc(JSON.stringify(leadPathForClient(k.positions)))}" data-msgs="${esc(JSON.stringify(msgs))}" aria-label="${esc(k.pill)}">
    <div class="lc__dock" id="lcDock">
      <button type="button" class="lc__pill" id="lcPill" aria-expanded="false" aria-controls="lcPanel"><span class="lc__dot" aria-hidden="true"></span><span>${esc(k.pill)}</span></button>
      <button type="button" class="lc__x" id="lcDismiss" aria-label="${esc(k.dismiss)}" title="${esc(k.dismiss)}">×</button>
    </div>
    <section class="lc__panel" id="lcPanel" role="dialog" aria-modal="false" aria-labelledby="lcTitle" hidden>
      <button type="button" class="lc__close" id="lcClose" aria-label="${esc(k.close)}">×</button>
      <div id="lcFormView">
        <h2 class="lc__title" id="lcTitle">${esc(k.title)}</h2>
        <p class="lc__lead">${esc(k.lead)}</p>
        <form id="lcForm" novalidate>
          ${field('lcName', 'name', k.fields.name, 'text', 'name', 'maxlength="100"')}
          ${field('lcEmail', 'email', k.fields.email, 'email', 'email', 'maxlength="254" inputmode="email"')}
          ${field('lcPhone', 'phone', k.fields.phone, 'tel', 'tel', 'maxlength="16" inputmode="tel" placeholder="(11) 99999-9999"')}
          <div class="lc__hp" aria-hidden="true"><label>Website <input type="text" name="website" id="lcWebsite" tabindex="-1" autocomplete="off"></label></div>
          <div class="lc__consent">
            <input type="checkbox" id="lcConsent" required aria-describedby="lcConsentErr">
            <label for="lcConsent">${consent}</label>
          </div>
          <p class="lc__err" id="lcConsentErr" hidden></p>
          <div class="lc__captcha" id="lcCaptcha"></div>
          <p class="lc__err" id="lcCaptchaErr" hidden></p>
          <button type="submit" class="btn btn--sm lc__submit" id="lcSubmit">${esc(k.submit)}</button>
          <p class="lc__err lc__status" id="lcStatus" role="status" aria-live="polite" hidden></p>
        </form>
      </div>
      <div class="lc__done" id="lcDone" tabindex="-1" hidden>
        <h2 class="lc__title">${esc(k.success.title)}</h2>
        <p class="lc__lead">${esc(k.success.text)}</p>
      </div>
    </section>
  </aside>`;
}

/* ---------- página inteira ---------- */
function fill(template, vars) {
  return template.replace(/\{\{\{(\w+)\}\}\}|\{\{(\w+)\}\}/g, (m, raw, text) => {
    const k = raw || text;
    if (!(k in vars)) { console.warn(`[render] variável sem valor: ${k}`); return ''; }
    return raw ? vars[k] : esc(vars[k]);
  });
}

/* ---------- galeria de pacientes (carrossel) ---------- */
// Os textos vêm de differentials (eyebrow e title). Sem nenhuma mídia visível, a seção não aparece.
function gallerySection(d, items) {
  if (!items.length) return '';
  const label = (it) => esc(it.caption || 'Paciente da clínica');
  const mediaOf = (it) => (it.kind === 'video'
    ? `<video data-src="${esc(it.url)}" poster="${esc(it.poster)}" muted loop playsinline preload="none" disablepictureinpicture aria-label="${label(it)}"></video>`
    : `<img src="${esc(it.url)}" alt="${label(it)}" loading="lazy" decoding="async">`);
  const li = (it) => `<li class="gal__item"><figure class="gal__fig">${mediaOf(it)}${it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : ''}</figure></li>`;
  return `<section class="diff gallery section" id="pacientes" aria-labelledby="galTitle">
      <div class="wrap gal__head reveal">
        <div><p class="eyebrow">${esc(d.eyebrow)}</p><h2 class="h2" id="galTitle">${em(d.title)}</h2></div>
        <button class="gal__toggle" type="button" aria-pressed="false" data-gal-toggle>Pausar</button>
      </div>
      <div class="gal__viewport" data-gallery><ul class="gal__track">${items.map(li).join('')}</ul></div>
    </section>`;
}

function renderPage(content, defaults, { cacheTemplate = false, lead = {}, gallery = [] } = {}) {
  const c = merge(defaults, content);
  const wa = waUrl(c.contact.whatsapp);
  const year = new Date().getFullYear();
  const addr = c.contact.address;

  const vars = {
    seoTitle: c.site.seoTitle,
    seoDescription: c.site.seoDescription,
    siteName: c.site.name,
    logoHtml: em(c.site.logo),
    loaderText: c.loader.text,
    navLinks: c.nav.links.map((l) => `<a href="${esc(safeUrl(l.href))}">${esc(l.label)}</a>`).join('\n      '),
    navCta: c.nav.cta,
    waUrl: wa,
    pausesJson: JSON.stringify(pausesForClient()),
    chapters: chapters(c.hero.chapters),
    cards: cards(c.hero.cards, wa),
    heroHint: c.hero.hint,

    labPrecision: c.lab.precisionValue,
    labStatuses: JSON.stringify(c.lab.statuses),
    labEyebrow: c.lab.eyebrow,
    labTitle: em(c.lab.title),
    labLead: c.lab.lead,
    labSteps: labSteps(c.lab.steps),
    labImage: c.lab.imageDescription,
    labTagLeft: c.lab.tagLeft,
    labTagRight: c.lab.tagRight,
    labMetricTeeth: c.lab.metrics.teeth,
    labMetricPrecision: c.lab.metrics.precision,
    labMetricStatus: c.lab.metrics.status,
    labStatus0: c.lab.statuses[0],

    aboutEyebrow: c.about.eyebrow,
    aboutTitle: em(c.about.title),
    aboutText: c.about.text,
    stats: c.about.stats.map((s) => `<div><dt>${esc(s.value)}</dt><dd>${esc(s.label)}</dd></div>`).join(''),

    servicesEyebrow: c.services.eyebrow,
    servicesTitle: em(c.services.title),
    services: c.services.items.map((s) => `<li class="reveal"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join(''),

    diffEyebrow: c.differentials.eyebrow,
    diffTitle: em(c.differentials.title),
    diff: c.differentials.items.map((d, i) => `<article class="card reveal"><span class="card__n">${pad(i + 1)}</span><h3>${esc(d.title)}</h3><p>${esc(d.text)}</p></article>`).join(''),

    gallery: gallerySection(c.differentials, gallery),

    contactEyebrow: c.contact.eyebrow,
    contactTitle: em(c.contact.title),
    contactLead: c.contact.lead,
    contactButton: c.contact.button,
    addressTitle: c.contact.addressTitle,
    address: [addr.line1, addr.line2].filter((l) => l && l.trim()).map(esc).join('<br>'),
    hoursTitle: c.contact.hoursTitle,
    hours: c.contact.hours.map((h) => `<li><span>${esc(h.days)}</span><b>${esc(h.time)}</b></li>`).join(''),
    instaUrl: safeUrl(c.contact.instagram.url),
    instaText: `@${String(c.contact.instagram.handle || '').replace(/^@/, '')}`,

    footerText: String(c.footer.text).replace('{ano}', year),
    privacyLabel: c.footer.privacyLabel,
    leadCard: lead.enabled ? leadCardHtml(c, lead.siteKey) : '',
    backToTop: c.footer.backToTop,
  };

  return fill(getTemplate(cacheTemplate), vars);
}

module.exports = { renderPage, merge };

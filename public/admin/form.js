/**
 * Motor de formulários do painel.
 * Tudo é criado com createElement/textContent (nunca innerHTML): o que está salvo no banco
 * entra na tela sempre como TEXTO.
 *
 * ctx = { content, meta, touch() }   touch() avisa que algo mudou (marca "não salvo").
 */
import { CARD_FIELDS, newCard, SCENE_NOTES } from './schema.js';

/* ---------- utilidades ---------- */
export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  n.append(...kids.flat().filter((x) => x != null && x !== false));
  return n;
}

let seq = 0;
const uid = () => `f${++seq}`;

// "Seu sorriso *aqui*" -> Seu sorriso <em>aqui</em> (prévia do destaque)
export function renderEm(str) {
  const frag = document.createDocumentFragment();
  String(str || '').split(/(\*[^*]+\*)/g).forEach((part) => {
    if (/^\*[^*]+\*$/.test(part)) frag.append(el('em', { text: part.slice(1, -1) }));
    else if (part) frag.append(part);
  });
  return frag;
}

const tool = (symbol, label, onClick, disabled) =>
  el('button', { type: 'button', class: 'ibtn', title: label, 'aria-label': label, text: symbol, disabled, onclick: (e) => { e.stopPropagation(); onClick(); } });

function move(arr, i, d) {
  const j = i + d;
  if (j < 0 || j >= arr.length) return false;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return true;
}

const fieldWrap = (labelNode, control, f, ...extra) =>
  el('div', { class: 'field' }, labelNode, control, f.help ? el('p', { class: 'help', text: f.help }) : null, ...extra);

/* ---------- campos ---------- */
export function renderFields(container, obj, fields, ctx) {
  fields.forEach((f) => container.append(renderField(obj, f, ctx)));
}

function renderField(obj, f, ctx) {
  switch (f.type || 'text') {
    case 'group': return renderGroup(obj, f, ctx);
    case 'list': return renderList(obj, f, ctx);
    case 'strings': return renderStrings(obj, f, ctx);
    default: return renderInput(obj, f, ctx);
  }
}

function renderInput(obj, f, ctx) {
  const type = f.type || 'text';
  const id = uid();
  let control;

  if (type === 'checkbox') {
    const box = el('input', { id, type: 'checkbox' });
    box.checked = !!obj[f.key];
    box.addEventListener('change', () => { obj[f.key] = box.checked; ctx.touch(); });
    return el('div', { class: 'field' }, el('label', { for: id, class: 'check' }, box, el('span', { text: f.label })), f.help ? el('p', { class: 'help', text: f.help }) : null);
  }

  if (type === 'textarea') {
    control = el('textarea', { id, rows: f.rows || 3 });
  } else if (type === 'select') {
    control = el('select', { id });
    const opts = typeof f.options === 'function' ? f.options(ctx) : f.optionsFrom ? ctx.meta[f.optionsFrom] || [] : f.options;
    opts.forEach((o) => control.append(el('option', { value: String(o.value), text: o.label })));
  } else {
    control = el('input', { id, type: 'text', autocomplete: 'off', inputmode: type === 'phone' ? 'numeric' : null, placeholder: f.placeholder });
  }
  if (f.max && type !== 'select') control.setAttribute('maxlength', String(f.max));
  control.value = obj[f.key] == null ? '' : String(obj[f.key]);

  const preview = type === 'title' ? el('div', { class: 'preview' }) : null;
  const counter = f.max && (type === 'textarea' || f.counter) ? el('span', { class: 'counter' }) : null;
  const refresh = () => {
    if (preview) { preview.replaceChildren(el('span', { class: 'preview__label', text: 'Prévia: ' }), renderEm(control.value)); }
    if (counter) counter.textContent = `${control.value.length}/${f.max}`;
  };
  refresh();

  control.addEventListener(type === 'select' ? 'change' : 'input', () => {
    let v = control.value;
    if (type === 'phone') { v = v.replace(/\D/g, ''); control.value = v; }
    obj[f.key] = f.numeric ? Number(v) : v;
    refresh();
    ctx.touch();
    if (f.redraw && ctx.redraw) ctx.redraw();
  });

  const extraHelp = type === 'title' && !f.help ? { ...f, help: 'Dica: coloque *asteriscos* em volta de uma palavra para destacá-la em itálico dourado.' } : f;
  return fieldWrap(el('label', { for: id, text: f.label }), control, extraHelp, preview, counter);
}

function renderGroup(obj, f, ctx) {
  if (!obj[f.key] || typeof obj[f.key] !== 'object') obj[f.key] = {};
  const set = el('fieldset', { class: 'group' }, el('legend', { text: f.label }));
  if (f.help) set.append(el('p', { class: 'help', text: f.help }));
  renderFields(set, obj[f.key], f.fields, ctx);
  return set;
}

/* ---------- lista de textos ---------- */
function renderStrings(obj, f, ctx) {
  if (!Array.isArray(obj[f.key])) obj[f.key] = [];
  const arr = obj[f.key];
  const wrap = el('div', { class: 'field' }, el('span', { class: 'field__label', text: f.label }));
  if (f.help) wrap.append(el('p', { class: 'help', text: f.help }));
  const list = el('div', { class: 'strings' });
  wrap.append(list);

  const draw = () => {
    list.replaceChildren();
    arr.forEach((val, i) => {
      const input = el('input', { type: 'text', maxlength: f.itemMax || 200, 'aria-label': `${f.itemLabel || 'Item'} ${i + 1}`, autocomplete: 'off' });
      input.value = val;
      input.addEventListener('input', () => { arr[i] = input.value; ctx.touch(); });
      const row = el('div', { class: 'strings__row' }, input);
      if (!f.fixed) {
        row.append(
          tool('↑', 'Subir', () => { if (move(arr, i, -1)) { ctx.touch(); draw(); } }, i === 0),
          tool('↓', 'Descer', () => { if (move(arr, i, 1)) { ctx.touch(); draw(); } }, i === arr.length - 1),
          tool('✕', 'Remover', () => { arr.splice(i, 1); ctx.touch(); draw(); })
        );
      }
      list.append(row);
    });
    if (!f.fixed && arr.length < (f.max || 20)) {
      list.append(el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: `+ Adicionar ${(f.itemLabel || 'item').toLowerCase()}`, onclick: () => { arr.push(''); ctx.touch(); draw(); list.querySelector('.strings__row:last-of-type input')?.focus(); } }));
    }
  };
  draw();
  return wrap;
}

/* ---------- lista de itens com campos ---------- */
const OPEN = new WeakSet(); // lembra quais itens estão abertos

function renderList(obj, f, ctx) {
  if (!Array.isArray(obj[f.key])) obj[f.key] = [];
  const arr = obj[f.key];
  const wrap = el('div', { class: 'field' }, el('span', { class: 'field__label', text: f.label }));
  if (f.help) wrap.append(el('p', { class: 'help', text: f.help }));
  const list = el('div', { class: 'list' });
  wrap.append(list);

  const label = (it, i) => (f.summary && String(f.summary(it, i) || '').trim()) || `${f.itemLabel || 'Item'} ${i + 1}`;
  const inner = { ...ctx, redraw: () => draw() };

  function draw() {
    list.replaceChildren();
    arr.forEach((it, i) => {
      const title = el('span', { class: 'item__title', text: label(it, i) });
      const item = el('div', { class: 'item' + (OPEN.has(it) ? ' is-open' : '') });
      const toggle = el('button', { type: 'button', class: 'item__toggle', 'aria-expanded': OPEN.has(it) ? 'true' : 'false', onclick: () => {
        const on = item.classList.toggle('is-open');
        on ? OPEN.add(it) : OPEN.delete(it);
        toggle.setAttribute('aria-expanded', String(on));
      } }, el('span', { class: 'item__chev', 'aria-hidden': 'true', text: '▸' }), title);
      const head = el('div', { class: 'item__head' }, toggle);
      if (!f.fixed) {
        head.append(
          tool('↑', 'Subir', () => { if (move(arr, i, -1)) { ctx.touch(); draw(); } }, i === 0),
          tool('↓', 'Descer', () => { if (move(arr, i, 1)) { ctx.touch(); draw(); } }, i === arr.length - 1),
          tool('✕', 'Remover', () => {
            if (arr.length <= (f.min || 0)) return;
            if (!confirm('Remover este item?')) return;
            arr.splice(i, 1); ctx.touch(); draw();
          }, arr.length <= (f.min || 0))
        );
      }
      const body = el('div', { class: 'item__body' });
      renderFields(body, it, f.fields, inner);
      body.addEventListener('input', () => { title.textContent = label(it, i); });
      item.append(head, body);
      list.append(item);
    });
    if (!f.fixed && f.newItem && arr.length < (f.max || 20)) {
      list.append(el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: `+ Adicionar ${(f.itemLabel || 'item').toLowerCase()}`, onclick: () => {
        const it = f.newItem(); OPEN.add(it); arr.push(it); ctx.touch(); draw();
      } }));
    }
  }
  draw();
  return wrap;
}

/* ---------- editor dos cartões do vídeo (agrupado por etapa) ---------- */
const OPEN_CARDS = new WeakSet();

export function renderCards(ctx) {
  const root = el('div', { class: 'cards-editor' });
  const cards = ctx.content.hero.cards;
  const MAX = 24;

  function draw() {
    root.replaceChildren();
    const chapters = ctx.content.hero.chapters;
    for (let scene = 1; scene <= 4; scene++) {
      const inScene = cards.filter((c) => c.scene === scene);
      const sec = el('section', { class: 'scene' },
        el('h3', { text: `Etapa ${scene} · ${chapters[scene - 1]?.eyebrow || ''}` }),
        el('p', { class: 'muted', text: SCENE_NOTES[scene - 1] }));

      inScene.forEach((card, i) => sec.append(cardItem(card, i, inScene)));
      if (!inScene.length) sec.append(el('p', { class: 'empty', text: 'Nenhum cartão nesta etapa.' }));

      sec.append(el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '+ Adicionar cartão nesta etapa', disabled: cards.length >= MAX, onclick: () => {
        const c = newCard(scene); OPEN_CARDS.add(c); cards.push(c); ctx.touch(); draw();
      } }));
      root.append(sec);
    }
  }

  function cardItem(card, i, group) {
    const sideName = () => (card.side === 'left' ? 'esquerda' : 'direita');
    const title = el('span', { class: 'item__title', text: card.title || '(sem título)' });
    const side = el('span', { class: 'badge', text: sideName() });
    const item = el('div', { class: 'item' + (OPEN_CARDS.has(card) ? ' is-open' : '') });
    const toggle = el('button', { type: 'button', class: 'item__toggle', 'aria-expanded': OPEN_CARDS.has(card) ? 'true' : 'false', onclick: () => {
      const on = item.classList.toggle('is-open');
      on ? OPEN_CARDS.add(card) : OPEN_CARDS.delete(card);
      toggle.setAttribute('aria-expanded', String(on));
    } }, el('span', { class: 'item__chev', 'aria-hidden': 'true', text: '▸' }), title, side);

    const swap = (other) => {
      const a = cards.indexOf(card); const b = cards.indexOf(other);
      [cards[a], cards[b]] = [cards[b], cards[a]];
      ctx.touch(); draw();
    };
    const head = el('div', { class: 'item__head' }, toggle,
      tool('↑', 'Subir (aparece antes)', () => swap(group[i - 1]), i === 0),
      tool('↓', 'Descer (aparece depois)', () => swap(group[i + 1]), i === group.length - 1),
      tool('✕', 'Apagar cartão', () => {
        if (!confirm(`Apagar o cartão "${card.title}"?`)) return;
        cards.splice(cards.indexOf(card), 1); ctx.touch(); draw();
      }));

    const body = el('div', { class: 'item__body' });
    renderFields(body, card, CARD_FIELDS, { ...ctx, redraw: draw });
    body.addEventListener('input', () => { title.textContent = card.title || '(sem título)'; side.textContent = sideName(); });
    body.addEventListener('change', () => { side.textContent = sideName(); });
    item.append(head, body);
    return item;
  }

  draw();
  return root;
}

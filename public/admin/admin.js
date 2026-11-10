/**
 * Painel admin — casca: login, menu, salvar, histórico e editor avançado.
 * Os formulários são montados por form.js a partir do esquema em schema.js.
 * Tudo que vem do servidor entra na tela como TEXTO, nunca como HTML.
 */
import { SECTIONS } from './schema.js';
import { el, renderFields, renderCards } from './form.js';
import { renderGallery } from './gallery.js';
import { buildSide, setHeader, setupShell } from './shell.js';
import { renderHome } from './home.js';

const $ = (s) => document.querySelector(s);
const show = (n, on = true) => { n.hidden = !on; };

/* ---------- API ---------- */
async function api(method, url, body) {
  const res = await fetch('/admin/api' + url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Erro ${res.status}`);
    err.status = res.status;
    err.details = (data && data.details) || [];
    throw err;
  }
  return data;
}

const fmtDate = (d) => {
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

/* ---------- estado ---------- */
const state = { content: null, saved: '', meta: { icons: [] }, section: 'geral', leads: null };
const isDirty = () => !!state.content && JSON.stringify(state.content) !== state.saved;

function updateDirty() {
  const d = isDirty();
  show($('#dirty'), d);
  show($('#savebar'), d);
}
const touch = () => updateDirty();
const ctx = () => ({ content: state.content, meta: state.meta, touch });

addEventListener('beforeunload', (e) => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

/* ---------- avisos ---------- */
let noticeTimer;
function notice(text, kind = 'ok', details = []) {
  clearTimeout(noticeTimer);
  const box = $('#notice');
  box.replaceChildren();
  if (!text) return;
  box.append(el('p', { class: 'msg' + (kind === 'error' ? ' msg--error' : ''), text }));
  if (details.length) box.append(el('ul', { class: 'errors' }, details.map((d) => el('li', { text: d }))));
  if (kind === 'ok') noticeTimer = setTimeout(() => box.replaceChildren(), 5000);
  else scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- contatos (LGPD): resumo, selo e aviso ---------- */
async function loadLeadsInfo() {
  try { state.leads = await api('GET', '/leads/summary'); } catch (err) { state.leads = null; handleAuth(err); }
  updateBadge();
}

function updateBadge() {
  const b = document.querySelector('[data-badge]');
  if (!b) return;
  const n = state.leads ? state.leads.counts.new : 0;
  b.textContent = String(n);
  b.hidden = n === 0;
}

function fillBanner(box) {
  box.replaceChildren();
  const info = state.leads;
  if (!info) return;
  if (info.ok) box.append(el('p', { class: 'msg', text: 'O cartão de contato está ATIVO no site.' }));
  else box.append(el('div', { class: 'msg msg--warn' }, el('strong', { text: 'O cartão de contato ainda não aparece no site:' }), el('ul', {}, info.reasons.map((r) => el('li', { text: r })))));
}

function leadBanner() {
  const box = el('div', { id: 'leadBanner' });
  fillBanner(box);
  return box;
}

/* ---------- telas ---------- */
function showLogin() {
  show($('#viewApp'), false);
  show($('#viewLogin'), true);
  $('#loginPass').value = '';
  $('#loginUser').focus();
}

async function showApp() {
  show($('#viewLogin'), false);
  show($('#viewApp'), true);
  if (!state.content || !isDirty()) await loadContent(); // não perde o que estava sendo editado se a sessão caiu
  await loadLeadsInfo();
  buildSide(SECTIONS);
  updateBadge();
  render();
  updateDirty();
}

// true = era erro de sessão (já mostrou o login)
function handleAuth(err) {
  if (err.status === 401) { showLogin(); return true; }
  return false;
}

async function loadContent() {
  try {
    const [{ content }, meta] = await Promise.all([api('GET', '/content'), api('GET', '/meta')]);
    state.content = content;
    state.meta = meta;
    state.saved = JSON.stringify(content);
  } catch (err) {
    if (!handleAuth(err)) notice(err.message, 'error');
    throw err;
  }
}

/* ---------- login / logout ---------- */
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#loginBtn');
  const msg = $('#loginError');
  show(msg, false);
  btn.disabled = true;
  try {
    await api('POST', '/login', { user: $('#loginUser').value.trim(), password: $('#loginPass').value });
    await showApp();
  } catch (err) {
    if (err.status === 401 && state.content) { msg.textContent = 'Usuário ou senha incorretos.'; } else msg.textContent = err.message;
    show(msg, true);
  } finally {
    btn.disabled = false;
  }
});

$('#logoutBtn').addEventListener('click', async () => {
  if (isDirty() && !confirm('Você tem alterações não salvas. Sair mesmo assim?')) return;
  try { await api('POST', '/logout', {}); } catch { /* ignora */ }
  state.content = null; state.saved = '';
  showLogin();
});

/* ---------- roteamento ---------- */
function currentId() {
  const id = location.hash.slice(1);
  return SECTIONS.some((s) => s.id === id) ? id : SECTIONS[0].id;
}

addEventListener('hashchange', () => { if (state.content) render(); });

function render() {
  const id = currentId();
  state.section = id;
  const sec = SECTIONS.find((s) => s.id === id);
  document.querySelectorAll('.side__link').forEach((a) => a.toggleAttribute('aria-current', a.dataset.id === id));

  const panel = $('#panel');
  panel.replaceChildren();
  setHeader(sec);

  if (sec.warning) panel.append(el('p', { class: 'msg msg--warn', text: sec.warning }));
  if (sec.id === 'cartao' || sec.id === 'privacidade') panel.append(leadBanner());

  if (sec.custom === 'home') renderHome(panel);
  else if (sec.custom === 'cards') panel.append(renderCards(ctx()));
  else if (sec.custom === 'leads') renderLeads(panel);
  else if (sec.custom === 'versions') renderVersions(panel);
  else if (sec.custom === 'json') renderJson(panel);
  else {
    sec.blocks.forEach((b) => {
      const target = b.path.split('.').reduce((o, k) => o[k], state.content);
      const body = el('div', { class: 'card__fields' });
      renderFields(body, target, b.fields, ctx());
      panel.append(el('section', { class: 'card' }, el('h2', { text: b.title }), b.description ? el('p', { class: 'muted', text: b.description }) : null, body));
    });
  }
  if (sec.id === 'galeria') renderGallery(panel, { api, notice, handleAuth }); // mídias: salvas na hora
  scrollTo({ top: 0 });
}

/* ---------- salvar / descartar ---------- */
$('#saveBtn').addEventListener('click', async () => {
  const btn = $('#saveBtn');
  notice('');
  btn.disabled = true;
  try {
    await api('PUT', '/content', { content: state.content, note: $('#note').value });
    state.saved = JSON.stringify(state.content);
    $('#note').value = '';
    updateDirty();
    notice('Salvo! O site já está atualizado.');
    loadLeadsInfo().then(() => { const b = $('#leadBanner'); if (b) fillBanner(b); });
  } catch (err) {
    if (!handleAuth(err)) notice(err.message, 'error', err.details);
  } finally {
    btn.disabled = false;
  }
});

$('#discardBtn').addEventListener('click', async () => {
  if (!confirm('Descartar todas as alterações não salvas?')) return;
  try { await loadContent(); render(); updateDirty(); notice('Alterações descartadas.'); } catch { /* aviso já mostrado */ }
});

/* ---------- histórico ---------- */
async function renderVersions(panel) {
  const tbody = el('tbody');
  const card = el('section', { class: 'card' },
    el('div', { class: 'table-wrap' }, el('table', { class: 'table' },
      el('thead', {}, el('tr', {}, ['#', 'Data', 'Anotação', ''].map((h) => el('th', { text: h })))), tbody)));
  panel.append(card);

  try {
    const { versions } = await api('GET', '/versions');
    versions.forEach((v, i) => {
      const act = el('td');
      if (i !== 0) act.append(el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Restaurar', onclick: (e) => restore(v.id, e.currentTarget) }));
      tbody.append(el('tr', {},
        el('td', { 'data-label': 'Versão' }, `#${v.id}`, i === 0 ? el('span', { class: 'now', text: 'atual' }) : null),
        el('td', { 'data-label': 'Data', text: fmtDate(v.createdAt) }),
        el('td', { 'data-label': 'Anotação', text: v.note || '—' }),
        act));
    });
  } catch (err) {
    if (!handleAuth(err)) tbody.append(el('tr', {}, el('td', { colspan: '4', text: err.message })));
  }
}

async function restore(id, btn) {
  const extra = isDirty() ? ' As alterações não salvas serão perdidas.' : '';
  if (!confirm(`Restaurar a versão #${id}? O conteúdo atual será substituído (mas continua no histórico).${extra}`)) return;
  btn.disabled = true;
  try {
    await api('POST', `/versions/${id}/restore`, {});
    await loadContent();
    updateDirty();
    notice(`Versão #${id} restaurada. O site já está atualizado.`);
    render();
  } catch (err) {
    if (!handleAuth(err)) notice(err.message, 'error', err.details);
    btn.disabled = false;
  }
}

/* ---------- contatos recebidos ---------- */
const STATUS_LABEL = { new: 'Novo', contacted: 'Contatado', archived: 'Arquivado' };
const fmtPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p || '—';
};

function renderLeads(panel) {
  const f = { page: 1, q: '', status: '' };
  const retEl = el('p', { class: 'muted' });
  const countsEl = el('p', { class: 'muted' });
  const emailIn = el('input', { type: 'text', placeholder: 'email@exemplo.com', 'aria-label': 'E-mail de quem fez o pedido', autocomplete: 'off' });
  const eraseBtn = el('button', { type: 'button', class: 'btn btn--ghost btn--sm btn--danger', text: 'Excluir os dados deste e-mail', onclick: async () => {
    const email = emailIn.value.trim();
    if (!email) return emailIn.focus();
    if (!confirm(`Excluir DEFINITIVAMENTE todos os dados ligados a ${email}? Não dá para desfazer.`)) return;
    try {
      const r = await api('POST', '/leads/erase', { email });
      emailIn.value = '';
      notice(r.deleted ? `${r.deleted} registro(s) excluído(s).` : 'Nenhum registro encontrado para esse e-mail.');
      load();
    } catch (err) { if (!handleAuth(err)) notice(err.message, 'error'); }
  } });

  const infoCard = el('section', { class: 'card' },
    el('h2', { text: 'Privacidade e retenção' }), retEl, countsEl,
    el('div', { class: 'row' }, el('a', { class: 'btn btn--ghost btn--sm', href: '/admin/api/leads/export.csv', text: 'Exportar tudo (CSV)' })),
    el('h3', { class: 'sub', text: 'Pedido de um titular (LGPD)' }),
    el('p', { class: 'muted', text: 'Se alguém pedir para apagar os próprios dados, digite o e-mail da pessoa. Tudo ligado a esse e-mail é excluído.' }),
    el('div', { class: 'toolbar' }, emailIn, eraseBtn));
  const listCard = el('section', { class: 'card' });
  panel.append(leadBanner(), infoCard, listCard);

  async function load() {
    listCard.replaceChildren(el('p', { class: 'muted', text: 'Carregando…' }));
    try {
      const qs = new URLSearchParams({ page: String(f.page), q: f.q, status: f.status });
      const data = await api('GET', '/leads?' + qs);
      state.leads = data.info;
      updateBadge();
      const b = $('#leadBanner'); if (b) fillBanner(b);
      retEl.textContent = `Os contatos são apagados automaticamente ${data.info.retentionDays} dias depois do envio. Cada exportação ou exclusão fica registrada.`;
      const c = data.info.counts;
      countsEl.textContent = `${c.new} novo(s) · ${c.contacted} contatado(s) · ${c.archived} arquivado(s)`;
      draw(data);
    } catch (err) {
      if (!handleAuth(err)) listCard.replaceChildren(el('p', { class: 'msg msg--error', text: err.message }));
    }
  }

  function draw(data) {
    const search = el('input', { type: 'text', placeholder: 'Buscar por nome, e-mail ou telefone', value: f.q, 'aria-label': 'Buscar', autocomplete: 'off' });
    const statusSel = el('select', { 'aria-label': 'Filtrar por situação' },
      ...[['', 'Todos'], ['new', 'Novos'], ['contacted', 'Contatados'], ['archived', 'Arquivados']].map(([v, t]) => el('option', { value: v, text: t, selected: v === f.status })));
    const go = () => { f.q = search.value.trim(); f.status = statusSel.value; f.page = 1; load(); };
    search.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    statusSel.addEventListener('change', go);

    const tbody = el('tbody');
    data.leads.forEach((l) => tbody.append(row(l)));
    if (!data.leads.length) tbody.append(el('tr', {}, el('td', { colspan: '5', class: 'empty', text: 'Nenhum contato por aqui.' })));

    const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
    const prev = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '← Anterior', disabled: f.page <= 1, onclick: () => { f.page -= 1; load(); } });
    const next = el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Próxima →', disabled: f.page >= pages, onclick: () => { f.page += 1; load(); } });

    listCard.replaceChildren(
      el('div', { class: 'toolbar' }, search, statusSel, el('button', { type: 'button', class: 'btn btn--sm', text: 'Buscar', onclick: go })),
      el('div', { class: 'table-wrap' }, el('table', { class: 'table table--leads' },
        el('thead', {}, el('tr', {}, ['Recebido em', 'Nome', 'Contato', 'Situação', ''].map((h) => el('th', { text: h })))), tbody)),
      el('div', { class: 'row pager' }, prev, el('span', { class: 'muted', text: `Página ${f.page} de ${pages} · ${data.total} contato(s)` }), next));
  }

  function row(l) {
    const sel = el('select', { 'aria-label': 'Situação' },
      ...Object.entries(STATUS_LABEL).map(([v, t]) => el('option', { value: v, text: t, selected: v === l.status })));
    sel.addEventListener('change', async () => {
      try {
        await api('PATCH', `/leads/${l.id}`, { status: sel.value });
        l.status = sel.value;
        await loadLeadsInfo();
        notice('Situação atualizada.');
      } catch (err) { if (!handleAuth(err)) notice(err.message, 'error'); sel.value = l.status; }
    });
    const digits = String(l.phone || '').replace(/\D/g, '');
    const del = el('button', { type: 'button', class: 'btn btn--ghost btn--sm btn--danger', text: 'Excluir', onclick: async () => {
      if (!confirm(`Excluir definitivamente o contato de ${l.name || 'esta pessoa'}? Não dá para desfazer.`)) return;
      try { await api('DELETE', `/leads/${l.id}`); notice('Contato excluído.'); load(); } catch (err) { if (!handleAuth(err)) notice(err.message, 'error'); }
    } });
    return el('tr', {},
      el('td', { 'data-label': 'Recebido em', text: fmtDate(l.consentAt) }),
      el('td', { 'data-label': 'Nome' }, el('strong', { text: l.name || '[não foi possível ler]' }),
        el('div', { class: 'small', text: `Aceitou a política v${l.policyVersion} · será apagado em ${fmtDate(l.expiresAt)}` })),
      el('td', { 'data-label': 'Contato' }, el('div', { text: l.email || '—' }), el('div', { class: 'small', text: fmtPhone(l.phone) })),
      el('td', { 'data-label': 'Situação' }, sel),
      el('td', { class: 'actions' },
        digits ? el('a', { class: 'btn btn--ghost btn--sm', href: `https://wa.me/${digits}`, target: '_blank', rel: 'noopener noreferrer', text: 'WhatsApp' }) : null,
        el('a', { class: 'btn btn--ghost btn--sm', href: `/admin/api/leads/${l.id}/export`, text: 'Exportar' }),
        del));
  }

  load();
}

/* ---------- editor avançado (JSON) ---------- */
function renderJson(panel) {
  const area = el('textarea', { class: 'code', rows: '26', spellcheck: 'false', 'aria-label': 'Conteúdo do site em JSON' });
  area.value = JSON.stringify(state.content, null, 2);
  const apply = el('button', { type: 'button', class: 'btn', text: 'Aplicar ao painel', onclick: () => {
    try {
      state.content = JSON.parse(area.value);
    } catch (e) {
      return notice('O texto não é um JSON válido: ' + e.message, 'error');
    }
    touch();
    notice('Aplicado. Confira nas outras seções e clique em "Salvar alterações" para publicar.');
    render();
  } });
  panel.append(el('section', { class: 'card' },
    el('p', { class: 'msg msg--error', text: 'Cuidado: se o formato ficar inválido, o painel recusa na hora de salvar. Nada é publicado até você clicar em "Salvar alterações".' }),
    area, el('div', { class: 'row' }, apply)));
}

/* ---------- início ---------- */
setupShell();
(async () => {
  try {
    await api('GET', '/me');
    await showApp();
  } catch {
    showLogin();
  }
})();

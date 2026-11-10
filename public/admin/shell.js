/**
 * Casca do painel: menu lateral agrupado, cabeçalho, recolher/expandir e menu de perfil.
 */
import { el } from './form.js';
import { icon, fillIcons } from './icons.js';

const $ = (s) => document.querySelector(s);
const app = () => $('#viewApp');
const isDesktop = matchMedia('(min-width: 901px)');

const GROUPS = [
  { label: null, items: [['inicio', 'home']] },
  { label: 'Conteúdo do site', items: [
    ['geral', 'sliders'], ['sobre', 'building'], ['tratamentos', 'tooth'], ['galeria', 'image'],
    ['capitulos', 'type'], ['cartoes', 'layers'], ['lab', 'box'],
  ] },
  { label: 'Contatos', items: [['contato', 'message'], ['cartao', 'idcard'], ['contatos', 'inbox']] },
  { label: 'Sistema', items: [['privacidade', 'shield'], ['historico', 'clock'], ['avancado', 'code']] },
];

export function buildSide(sections) {
  const byId = new Map(sections.map((s) => [s.id, s]));
  $('#side').replaceChildren(...GROUPS.flatMap((g) => [
    ...(g.label ? [el('p', { class: 'side__group', text: g.label })] : []),
    ...g.items.filter(([id]) => byId.has(id)).map(([id, name]) => {
      const sec = byId.get(id);
      return el('a', { href: `#${id}`, class: 'side__link', 'data-id': id, title: sec.label },
        icon(name),
        el('span', { class: 'side__label', text: sec.label }),
        id === 'contatos' ? el('span', { class: 'count', 'data-badge': '1', hidden: true, text: '0' }) : null);
    }),
  ]));
}

export function setHeader(sec) {
  $('#pageTitle').textContent = sec.title;
  const desc = $('#pageDesc');
  desc.textContent = sec.description || '';
  desc.hidden = !sec.description;
}

const closeDrawer = () => app().classList.remove('is-drawer-open');

export function setupShell() {
  fillIcons();

  $('#menuBtn').addEventListener('click', () => {
    if (isDesktop.matches) app().classList.toggle('is-collapsed');
    else app().classList.toggle('is-drawer-open');
  });
  $('#scrim').addEventListener('click', closeDrawer);
  addEventListener('hashchange', closeDrawer);

  const btn = $('#profileBtn');
  const menu = $('#profileMenu');
  const setMenu = (open) => {
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); });
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) setMenu(false); });
}

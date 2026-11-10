/**
 * Página Início: capa de boas-vindas e atalhos para as áreas de edição.
 * Só navegação: não mostra indicadores, atividades nem dados fictícios.
 */
import { el } from './form.js';
import { icon } from './icons.js';

const HERO_IMAGE = {
  src: 'img/dra.jpg',
  alt: 'Foto da Dra.',
};

const AREAS = [
  {
    href: '#geral',
    title: 'Institucional',
    text: 'Geral, A clínica e informações da empresa.',
    icon: 'building',
    image: 'img/recepcao.png',
    alt: 'Recepção da clínica',
  },
  {
    href: '#galeria',
    title: 'Conteúdo visual',
    text: 'Galeria, vídeos, cartões e seção 3D.',
    icon: 'image',
    image: 'img/sorriso.jpg',
    alt: 'Close-up de um sorriso com dentes brancos',
  },
  {
    href: '#contatos',
    title: 'Relacionamento',
    text: 'Contatos recebidos, formulário e cartão de contato.',
    icon: 'message',
    image: 'img/contato.jpg',
    alt: 'Atendimento e contato com pacientes',
  },
];

function heroCard() {
  return el('section', { class: 'home-hero' },
    el('img', { class: 'home-hero__img', src: HERO_IMAGE.src, alt: HERO_IMAGE.alt, loading: 'eager' }),
    el('div', { class: 'home-hero__body' },
      el('span', { class: 'home-hero__pill', text: 'Bem-vindo(a)' }),
      el('h2', { text: 'Painel administrativo' }),
      el('p', { text: 'Atualize textos, fotos e contatos do site da Prospere Odonto sem precisar de ajuda técnica.' }),
      el('a', { class: 'btn', href: '#geral' }, 'Começar a editar', icon('chevron-right'))));
}

function areaCard(area) {
  return el('a', { class: 'home-card', href: area.href },
    el('div', { class: 'home-card__media' },
      el('img', { src: area.image, alt: area.alt, loading: 'lazy' })),
    el('div', { class: 'home-card__body' },
      el('span', { class: 'home-card__icon' }, icon(area.icon)),
      el('h3', { text: area.title }),
      el('p', { class: 'muted', text: area.text }),
      el('span', { class: 'home-card__go' }, 'Gerenciar', icon('chevron-right'))));
}

export function renderHome(panel) {
  panel.append(
    heroCard(),
    el('div', { class: 'home-heading' },
      el('h2', { text: 'Gerenciamento do site' }),
      el('p', { class: 'muted', text: 'Escolha uma área para editar.' })),
    el('div', { class: 'home-grid' }, ...AREAS.map(areaCard)));
}

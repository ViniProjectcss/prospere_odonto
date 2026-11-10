/**
 * Ícones do painel (traço fino, sem bibliotecas externas).
 * Os nomes são usados no menu, no cabeçalho e nos botões via data-icon.
 */
const NS = 'http://www.w3.org/2000/svg';

const PATHS = {
  home: ['M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'],
  sliders: ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  building: ['M4 22V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v18', 'M16 9h3a1 1 0 0 1 1 1v12', 'M2 22h20', 'M8 7h4', 'M8 11h4', 'M8 15h4'],
  tooth: ['M12 6.5c-1.2-1.3-3.3-2-4.9-1.1C5.4 6.3 5 8.6 5.4 11c.5 3 1 8.5 2.6 8.5 1.4 0 1.5-3.8 2.8-3.8s1.4 3.8 2.8 3.8c1.6 0 2.1-5.5 2.6-8.5.4-2.4 0-4.7-1.7-5.6-1.6-.9-3.7-.2-4.9 1.1z'],
  image: ['M3 3h18v18H3z', 'M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'M21 15l-5-5L5 21'],
  type: ['M4 7V4h16v3', 'M9 20h6', 'M12 4v16'],
  layers: ['M12 2 2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  box: ['M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z', 'M3.3 7 12 12l8.7-5', 'M12 22V12'],
  message: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  idcard: ['M3 5h18v14H3z', 'M8 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M4.5 17c.5-2 2-3 3.5-3s3 1 3.5 3', 'M14 9h4', 'M14 13h4'],
  inbox: ['M22 12h-6l-2 3h-4l-2-3H2', 'M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'],
  clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 6v6l4 2'],
  code: ['M16 18l6-6-6-6', 'M8 6l-6 6 6 6'],
  menu: ['M3 6h18', 'M3 12h18', 'M3 18h18'],
  chevron: ['M6 9l6 6 6-6'],
  'chevron-right': ['M9 18l6-6-6-6'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
};

export function icon(name) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const d of PATHS[name]) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

export function fillIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((node) => node.replaceChildren(icon(node.dataset.icon)));
}

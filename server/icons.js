'use strict';
/**
 * Ícones dos cartões do vídeo. Os desenhos ficam AQUI (no código), nunca no banco:
 * o painel só escolhe a chave. Assim ninguém consegue injetar SVG/HTML pelo painel.
 */
const ICONS = {
  instagram: { label: 'Instagram', svg: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".6"/>' },
  xray:      { label: 'Raio-X', svg: '<rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M8 9v6M12 7v10M16 10v4"/>' },
  shield:    { label: 'Escudo (confiança)', svg: '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>' },
  calendar:  { label: 'Calendário', svg: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>' },
  plus:      { label: 'Mais (tratamentos)', svg: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M12 8v8M8 12h8"/>' },
  card:      { label: 'Cartão (pagamento)', svg: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M3 10.5h18"/>' },
  clock:     { label: 'Relógio (horários)', svg: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>' },
  star:      { label: 'Estrela', svg: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z"/>' },
  heart:     { label: 'Coração', svg: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.6 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>' },
  phone:     { label: 'Telefone', svg: '<path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2z"/>' },
  pin:       { label: 'Localização', svg: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>' },
  tooth:     { label: 'Dente', svg: '<path d="M7.5 3.5c-2.3 0-3.8 1.7-3.8 4 0 1.9.8 3.2 1.2 5 .4 1.9.6 7 2.2 7 1.3 0 1.4-4.2 2.3-4.2h.2c.9 0 1 4.2 2.3 4.2 1.6 0 1.8-5.1 2.2-7 .4-1.8 1.2-3.1 1.2-5 0-2.3-1.5-4-3.8-4-1.5 0-2 .8-3.1.8s-1.7-.8-3.2-.8z" transform="translate(1.2 0)"/>' },
};

const ICON_KEYS = Object.keys(ICONS);
const iconList = () => ICON_KEYS.map((key) => ({ value: key, label: ICONS[key].label }));

module.exports = { ICONS, ICON_KEYS, iconList };

'use strict';
/**
 * Valida o conteúdo antes de salvar no banco.
 * Objetivo: o painel nunca conseguir quebrar o site nem gravar link perigoso.
 */

// Ícones disponíveis para os cartões do vídeo (os desenhos ficam em server/icons.js)
const { ICON_KEYS: ICONS } = require('./icons');

const SECTIONS = ['site', 'loader', 'nav', 'hero', 'lab', 'about', 'services', 'differentials', 'contact', 'footer', 'leadCard', 'privacy'];
const URL_KEYS = new Set(['href', 'url', 'mapsUrl']);
const OK_URL = /^(https?:\/\/|\/|#|mailto:|tel:)/i;
const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_TEXT = 4000;

function walk(node, where, errors) {
  if (typeof node === 'string') {
    if (node.length > MAX_TEXT) errors.push(`${where}: texto longo demais (máx. ${MAX_TEXT} caracteres)`);
    return;
  }
  if (node === null || typeof node === 'number' || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    if (node.length > 200) errors.push(`${where}: lista grande demais`);
    node.forEach((v, i) => walk(v, `${where}[${i}]`, errors));
    return;
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (BAD_KEYS.has(k)) { errors.push(`${where}: campo não permitido "${k}"`); continue; }
      if (URL_KEYS.has(k) && typeof v === 'string' && v.trim() !== '' && !OK_URL.test(v.trim())) {
        errors.push(`${where}.${k}: link inválido (use http://, https://, #, mailto: ou tel:)`);
      }
      walk(v, `${where}.${k}`, errors);
    }
    return;
  }
  errors.push(`${where}: tipo de valor inválido`);
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string';

function validateContent(c) {
  const errors = [];
  if (!isObj(c)) return { ok: false, errors: ['O conteúdo precisa ser um objeto JSON.'] };

  for (const s of SECTIONS) if (!isObj(c[s])) errors.push(`Falta a seção "${s}".`);
  if (errors.length) return { ok: false, errors };

  // hero: 4 capítulos fixos (ligados ao vídeo)
  const ch = c.hero.chapters;
  if (!Array.isArray(ch) || ch.length !== 4) errors.push('hero.chapters: precisa ter exatamente 4 capítulos.');
  else ch.forEach((x, i) => { if (!isObj(x) || !isStr(x.eyebrow) || !isStr(x.title)) errors.push(`hero.chapters[${i}]: precisa de eyebrow e title.`); });

  // hero: cartões
  const cards = c.hero.cards;
  if (!Array.isArray(cards)) errors.push('hero.cards: precisa ser uma lista.');
  else {
    if (cards.length > 24) errors.push('hero.cards: máximo de 24 cartões.');
    const ids = new Set();
    cards.forEach((k, i) => {
      const w = `hero.cards[${i}]`;
      if (!isObj(k)) { errors.push(`${w}: inválido.`); return; }
      if (!isStr(k.id) || !/^[a-z0-9-]{1,60}$/i.test(k.id)) errors.push(`${w}.id: use só letras, números e hífen.`);
      else if (ids.has(k.id)) errors.push(`${w}.id: repetido ("${k.id}").`);
      else ids.add(k.id);
      if (!Number.isInteger(k.scene) || k.scene < 1 || k.scene > 4) errors.push(`${w}.scene: precisa ser 1, 2, 3 ou 4.`);
      if (!['left', 'right'].includes(k.side)) errors.push(`${w}.side: precisa ser left ou right.`);
      if (!ICONS.includes(k.icon)) errors.push(`${w}.icon: ícone inexistente.`);
      if (!isStr(k.title) || !k.title.trim()) errors.push(`${w}.title: o cartão precisa de um título.`);
      if (!isStr(k.eyebrow)) errors.push(`${w}.eyebrow: inválido.`);
      if (!isStr(k.text)) errors.push(`${w}.text: inválido.`);
      if (!Array.isArray(k.items) || k.items.some((t) => !isStr(t))) errors.push(`${w}.items: precisa ser uma lista de textos.`);
      if (!isObj(k.cta) || !isStr(k.cta.label) || !['link', 'whatsapp'].includes(k.cta.type) || !isStr(k.cta.url)) {
        errors.push(`${w}.cta: precisa de label, type (link ou whatsapp) e url.`);
      } else if (k.cta.label.trim() && k.cta.type === 'link' && !k.cta.url.trim()) {
        errors.push(`${w}.cta: botão do tipo link precisa de uma url.`);
      }
    });
  }

  // lab
  if (!Array.isArray(c.lab.steps) || c.lab.steps.length !== 4) errors.push('lab.steps: precisa ter exatamente 4 passos.');
  if (!Array.isArray(c.lab.statuses) || c.lab.statuses.length !== 4) errors.push('lab.statuses: precisa ter exatamente 4 textos.');

  // listas editáveis
  const lists = [
    ['nav.links', c.nav.links, 1, 8],
    ['about.stats', c.about.stats, 0, 6],
    ['services.items', c.services.items, 1, 12],
    ['differentials.items', c.differentials.items, 0, 12], // não é mais exibida (a seção virou a galeria)
    ['contact.hours', c.contact.hours, 0, 10],
  ];
  for (const [name, arr, min, max] of lists) {
    if (!Array.isArray(arr)) errors.push(`${name}: precisa ser uma lista.`);
    else if (arr.length < min || arr.length > max) errors.push(`${name}: precisa ter entre ${min} e ${max} itens.`);
  }

  // contato
  const wa = c.contact.whatsapp;
  if (!isObj(wa) || !/^\d{10,15}$/.test(String(wa.number || ''))) errors.push('contact.whatsapp.number: só números, com DDI e DDD (ex.: 5511999999999).');
  if (!isObj(c.contact.address)) errors.push('contact.address: inválido.');
  if (!isObj(c.contact.instagram)) errors.push('contact.instagram: inválido.');

  // cartão de contato (LGPD)
  const lc = c.leadCard;
  if (typeof lc.enabled !== 'boolean') errors.push('leadCard.enabled: precisa ser ligado ou desligado.');
    if (!Array.isArray(lc.positions) || lc.positions.length !== 4 ||
      lc.positions.some((p) => !isObj(p) || !['left', 'center', 'right'].includes(p.side))) {
    errors.push('leadCard.positions: precisa ter as 4 etapas, cada uma com esquerda, centro ou direita.');
  }
  for (const k of ['pill', 'title', 'lead', 'consentText', 'policyLinkLabel', 'submit', 'sending', 'close', 'dismiss']) {
    if (!isStr(lc[k])) errors.push(`leadCard.${k}: inválido.`);
  }
  if (!isObj(lc.fields) || !['name', 'email', 'phone'].every((k) => isStr(lc.fields[k]))) errors.push('leadCard.fields: precisa de name, email e phone.');
  if (!isObj(lc.success) || !isStr(lc.success.title) || !isStr(lc.success.text)) errors.push('leadCard.success: precisa de title e text.');
  if (!isObj(lc.errors) || !['name', 'email', 'phone', 'consent', 'captcha', 'generic', 'rate'].every((k) => isStr(lc.errors[k]))) errors.push('leadCard.errors: faltam mensagens de erro.');
  if (isStr(lc.consentText) && !lc.consentText.includes('{politica}')) {
    errors.push('Cartão de contato: o texto do aceite precisa conter {politica} — é onde aparece o link da Política de Privacidade.');
  }
  const pv = c.privacy;
  if (!isStr(pv.version) || !pv.version.trim() || pv.version.length > 40) errors.push('privacy.version: informe a versão (ex.: 1.0).');
  if (!isStr(pv.updatedAt)) errors.push('privacy.updatedAt: inválido.');
  if (!isObj(pv.controller) || !['legalName', 'cnpj', 'address'].every((k) => isStr(pv.controller[k]))) errors.push('privacy.controller: faltam dados.');
  if (!isObj(pv.dpo) || !isStr(pv.dpo.name) || !isStr(pv.dpo.email)) errors.push('privacy.dpo: faltam dados.');
  if (!isStr(pv.processors) || !isStr(pv.extra)) errors.push('privacy.processors/extra: inválido.');

  walk(c, 'conteúdo', errors);
  return { ok: errors.length === 0, errors: errors.slice(0, 30) };
}

module.exports = { validateContent, ICONS };

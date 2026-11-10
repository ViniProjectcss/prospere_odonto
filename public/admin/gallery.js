/**
 * Aba "Galeria" do painel: enviar, legendar, ordenar (arrastando ou com as setas), ocultar e excluir.
 * As mídias são salvas na hora (não precisam do botão "Salvar"). Tudo do servidor entra como TEXTO.
 */
import { el } from './form.js';

export function renderGallery(panel, { api, notice, handleAuth }) {
  const fail = (err) => { if (!handleAuth(err)) notice(err.message, 'error'); };
  const grid = el('ul', { class: 'gal-grid' });
  const count = el('p', { class: 'muted' });
  let dragged = null;

  /* ---------- enviar ---------- */
  const file = el('input', { type: 'file', multiple: true, accept: 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm' });
  const consent = el('input', { type: 'checkbox' });
  const send = el('button', { class: 'btn', type: 'button', text: 'Enviar' });
  const status = el('p', { class: 'muted', hidden: true });
  const previews = el('ul', { class: 'gal-previews' });
  let previewUrls = [];

  function clearPreviews() {
    previewUrls.forEach((u) => URL.revokeObjectURL(u));
    previewUrls = [];
    previews.replaceChildren();
  }

  file.addEventListener('change', () => {
    clearPreviews();
    previews.replaceChildren(...[...file.files].map((f) => {
      if (!f.type.startsWith('image/')) return el('li', { class: 'gal-previews__item' }, el('span', { class: 'gal-badge', text: 'Vídeo' }), el('span', { class: 'small', text: f.name }));
      const url = URL.createObjectURL(f);
      previewUrls.push(url);
      return el('li', { class: 'gal-previews__item' }, el('img', { src: url, alt: f.name }));
    }));
  });

  send.addEventListener('click', async () => {
    if (!file.files.length) return notice('Escolha pelo menos um arquivo.', 'error');
    if (!consent.checked) return notice('Confirme a autorização de uso de imagem dos pacientes.', 'error');
    const fd = new FormData();
    [...file.files].forEach((f) => fd.append('files', f));
    fd.append('consent', '1');
    send.disabled = true;
    status.hidden = false;
    status.textContent = 'Enviando e otimizando… vídeos e GIFs podem levar alguns segundos.';
    try {
      const res = await fetch('/admin/api/gallery', { method: 'POST', body: fd, credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(data.error || `Erro ${res.status}`), { status: res.status });
      file.value = '';
      clearPreviews();
      consent.checked = false;
      if (data.failed.length) notice(`${data.added.length} enviado(s); ${data.failed.length} com problema:`, 'error', data.failed.map((f) => `${f.name}: ${f.error}`));
      else notice(`${data.added.length} arquivo(s) enviado(s). Já está no site.`);
      await load();
    } catch (err) { fail(err); } finally { send.disabled = false; status.hidden = true; }
  });

  const uploader = el('section', { class: 'card' },
    el('h2', { text: 'Enviar fotos, GIFs ou vídeos curtos' }),
    el('p', { class: 'muted', text: 'Fotos viram imagens leves. GIFs e vídeos viram vídeo sem som (até 15 segundos). Pode escolher vários arquivos de uma vez.' }),
    el('div', { class: 'field' }, file),
    previews,
    el('label', { class: 'gal-consent' }, consent,
      el('span', { text: 'Tenho autorização de uso de imagem de todos os pacientes que aparecem nestes arquivos.' })),
    el('div', { class: 'gal-send' }, send),
    status);

  /* ---------- lista ---------- */
  const ids = () => [...grid.children].map((t) => Number(t.dataset.id));

  async function saveOrder() {
    try { await api('PUT', '/gallery/order', { ids: ids() }); notice('Ordem salva.'); } catch (err) { fail(err); await load(); }
  }

  function tile(it) {
    const li = el('li', { class: 'gal-tile' + (it.visible ? '' : ' is-off'), 'data-id': it.id, draggable: 'true' });
    const cap = el('input', { type: 'text', maxlength: '140', placeholder: 'Legenda (opcional)', value: it.caption, 'aria-label': 'Legenda' });
    const vis = el('input', { type: 'checkbox' });
    vis.checked = it.visible;

    cap.addEventListener('change', async () => {
      try { await api('PATCH', `/gallery/${it.id}`, { caption: cap.value }); notice('Legenda salva.'); } catch (err) { fail(err); }
    });
    vis.addEventListener('change', async () => {
      li.classList.toggle('is-off', !vis.checked);
      try { await api('PATCH', `/gallery/${it.id}`, { visible: vis.checked }); notice(vis.checked ? 'Visível no site.' : 'Oculto do site.'); } catch (err) { fail(err); }
    });

    const move = (dir) => {
      const sib = dir < 0 ? li.previousElementSibling : li.nextElementSibling;
      if (!sib) return;
      dir < 0 ? grid.insertBefore(li, sib) : grid.insertBefore(sib, li);
      saveOrder();
    };
    const del = async () => {
      if (!confirm('Excluir esta mídia? O arquivo será apagado do servidor.')) return;
      try { await api('DELETE', `/gallery/${it.id}`); notice('Excluído.'); await load(); } catch (err) { fail(err); }
    };

    li.addEventListener('dragstart', (e) => { dragged = li; li.classList.add('is-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(it.id)); });
    li.addEventListener('dragover', (e) => {
      if (!dragged || dragged === li) return;
      e.preventDefault();
      const r = li.getBoundingClientRect();
      grid.insertBefore(dragged, e.clientX > r.left + r.width / 2 ? li.nextSibling : li);
    });
    li.addEventListener('dragend', () => { if (!dragged) return; li.classList.remove('is-dragging'); dragged = null; saveOrder(); });

    li.append(
      el('div', { class: 'gal-thumb' },
        el('img', { src: it.poster || it.url, alt: it.caption || 'Mídia da galeria', loading: 'lazy' }),
        it.kind === 'video' ? el('span', { class: 'gal-badge', text: 'Vídeo' }) : null),
      cap,
      el('label', { class: 'gal-vis' }, vis, el('span', { text: 'Visível no site' })),
      el('div', { class: 'gal-actions' },
        el('button', { class: 'btn btn--ghost btn--sm', type: 'button', 'aria-label': 'Mover para trás', text: '←', onclick: () => move(-1) }),
        el('button', { class: 'btn btn--ghost btn--sm', type: 'button', 'aria-label': 'Mover para frente', text: '→', onclick: () => move(1) }),
        el('button', { class: 'btn btn--ghost btn--sm btn--danger', type: 'button', text: 'Excluir', onclick: del })));
    return li;
  }

  async function load() {
    try {
      const data = await api('GET', '/gallery');
      grid.replaceChildren(...data.items.map(tile));
      count.textContent = data.items.length
        ? `${data.items.length} de ${data.max} itens. Arraste para reordenar (ou use as setas). Os textos da seção acima precisam do botão "Salvar"; as mídias são salvas na hora.`
        : 'Nenhuma mídia ainda. A seção só aparece no site quando houver pelo menos uma mídia visível.';
    } catch (err) { fail(err); }
  }

  panel.append(uploader, el('section', { class: 'card' }, el('h2', { text: 'Mídias da galeria' }), count, grid));
  load();
}

const adminPane = document.querySelector('#admin .dash');
const adminLinks = [...document.querySelectorAll('#admin aside a')];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const header = title => `<div class="admin-page-head"><div><small>KITSUNE CMS</small><h1>${title}</h1></div><button class="cms-btn danger" data-action="logout">Cerrar panel</button></div>`;
const table = (heads, rows) => `<div class="cms-table"><div class="cms-tr cms-th">${heads.map(esc).map(x => `<span>${x}</span>`).join('')}</div>${rows.join('')}</div>`;
let currentSection = 'Resumen';
async function show(section) {
  if (window.Kitsune.user?.role !== 'admin') return window.Kitsune.go('admin-access');
  currentSection = section;
  adminLinks.forEach(link => link.classList.toggle('on', link.textContent === section));
  adminPane.innerHTML = header(section) + '<p class="muted">Cargando...</p>';
  try {
    const api = window.Kitsune.api;
    if (section === 'Resumen') {
      const data = await api('/admin/summary');
      adminPane.innerHTML = header(section) + `<div class="stats"><div><b>${data.series}</b><span>Series</span></div><div><b>${data.episodes}</b><span>Episodios</span></div><div><b>${data.users}</b><span>Usuarios</span></div><div><b>${data.jobs}</b><span>Trabajos pendientes</span></div></div><div class="cms-card"><h2>Estado del sistema</h2><p>Los datos del catálogo y del panel se guardan en PostgreSQL. Los trabajos multimedia se registran en una cola para un futuro worker.</p></div>`;
    }
    if (section === 'Contenido') {
      const { items } = await api('/admin/series');
      adminPane.innerHTML = header(section) + `<form id="createSeries" class="cms-actions"><input name="title" required minlength="2" placeholder="Nombre de la nueva serie"><button class="cms-btn">＋ Crear serie</button></form>` + table(['Título','Estado','Acciones'], items.map(x => `<div class="cms-tr"><b>${esc(x.title)}</b><span>${esc(x.status)}</span><span><button class="mini" data-action="edit-series" data-id="${x.id}">Editar</button><button class="mini" data-action="${x.status==='published'?'hide':'publish'}" data-id="${x.id}">${x.status==='published'?'Ocultar':'Publicar'}</button><button class="mini danger" data-action="delete" data-id="${x.id}">Eliminar</button></span></div>`));
    }
    if (section === 'Episodios') {
      const [episodes, series] = await Promise.all([api('/admin/episodes'), api('/admin/series')]);
      adminPane.innerHTML = header(section) + `<form id="createSeason" class="cms-card"><h2>Crear temporada</h2><div class="cms-form"><select name="seriesId" required>${series.items.map(x => `<option value="${x.id}">${esc(x.title)}</option>`).join('')}</select><input name="number" type="number" min="1" required placeholder="Número" aria-label="Temporada"><input name="title" required placeholder="Título"><button class="cms-btn">Crear temporada</button></div></form><form id="createEpisode" class="cms-card"><h2>Crear episodio</h2><div class="cms-form"><select name="seriesId" required>${series.items.map(x => `<option value="${x.id}">${esc(x.title)}</option>`).join('')}</select><input name="seasonNumber" type="number" min="1" value="1" required aria-label="Temporada"><input name="episodeNumber" type="number" min="1" required placeholder="Episodio" aria-label="Episodio"><input name="title" required minlength="2" placeholder="Título"><button class="cms-btn">Crear</button></div></form><div class="cms-card"><p>Prototipo gratuito: sube solo un MP4 propio o autorizado de hasta 20 MB. El enlace de reproducción podrá compartirse.</p></div>` + table(['Episodio','Serie','Estado'], episodes.items.map(x => `<div class="cms-tr"><b>${esc(x.title)}</b><span>${esc(x.series_title)} · T${x.season_number} E${x.number}</span><span>${esc(x.status)} <input type="file" accept="video/mp4" aria-label="MP4 para ${esc(x.title)}" data-video-file="${x.id}"><button class="mini" data-action="upload-video" data-id="${x.id}" ${x.status==='published'?'disabled':''}>Subir video</button><button class="mini" data-action="${x.status==='published'?'unpublish-episode':'publish-episode'}" data-id="${x.id}">${x.status==='published'?'Despublicar':'Publicar'}</button><button class="mini" data-action="edit-episode" data-id="${x.id}">Editar</button><button class="mini danger" data-action="delete-episode" data-id="${x.id}">Eliminar</button></span></div>`));
    }
    if (section === 'Usuarios') {
      const { items } = await api('/admin/users');
      adminPane.innerHTML = header(section) + table(['Usuario','Rol','Estado'], items.map(x => `<div class="cms-tr"><b>${esc(x.email)}</b><select data-action="role" data-id="${x.id}"><option value="user" ${x.role==='user'?'selected':''}>Usuario</option><option value="developer" ${x.role==='developer'?'selected':''}>Programador</option>${x.role==='admin'?'<option value="admin" selected>Administrador anterior (cambiar rol)</option>':''}</select><span>${x.is_active?'Activo':'Bloqueado'} <button class="mini danger" data-action="active" data-id="${x.id}" data-value="${!x.is_active}">${x.is_active?'Bloquear':'Activar'}</button></span></div>`));
    }
    if (section === 'Procesamiento') {
      const { items } = await api('/admin/jobs');
      adminPane.innerHTML = header(section) + `<div class="cms-card"><p>Cloudinary prepara HLS y notifica cuando termina. Si un trabajo falla, vuelve a subir el MP4 desde Episodios. Los trabajos anteriores sin archivo no pueden procesarse.</p></div>` + table(['Serie / episodio','Estado','Acción'], items.map(x => `<div class="cms-tr"><b>${esc(x.series_title)} · ${esc(x.episode_title)}</b><span>${esc(x.status)}</span><span>${x.status==='failed'?'Vuelve a Episodios':'—'}</span></div>`));
    }
    if (section === 'Auditoría') {
      const { items } = await api('/admin/audit');
      adminPane.innerHTML = header(section) + table(['Acción','Entidad','Fecha'], items.map(x => `<div class="cms-tr"><b>${esc(x.action)}</b><span>${esc(x.entity)}</span><span>${new Date(x.created_at).toLocaleString('es-CO')}</span></div>`));
    }
  } catch (error) { adminPane.innerHTML = header(section) + `<p class="admin-error">${esc(error.message)}</p>`; }
}
window.KitsuneAdmin = { show };
adminLinks.forEach(link => link.addEventListener('click', event => { event.preventDefault(); show(link.textContent); }));
adminPane.addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form));
  try {
    if (form.id === 'createSeries') await window.Kitsune.api('/admin/series', { method:'POST', body:JSON.stringify(values) });
    if (form.id === 'createSeason') await window.Kitsune.api('/admin/seasons', { method:'POST', body:JSON.stringify(values) });
    if (form.id === 'createEpisode') await window.Kitsune.api('/admin/episodes', { method:'POST', body:JSON.stringify(values) });
    await show(currentSection);
    if (form.id === 'createSeries') window.Kitsune.reloadCatalog();
  } catch (error) { alert(error.message); }
});
adminPane.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const action = button.dataset.action, id = button.dataset.id;
  try {
    if (action === 'logout') { await window.Kitsune.api('/auth/logout', { method:'POST' }); await window.Kitsune.refreshSession(); window.Kitsune.go('catalogo'); return; }
    if (action === 'edit-series') {
      const { items } = await window.Kitsune.api('/admin/series');
      const item = items.find(series => series.id === id);
      const title = prompt('Título de la serie:', item?.title); if (title === null) return;
      const synopsis = prompt('Sinopsis:', item?.synopsis || ''); if (synopsis === null) return;
      const genres = prompt('Géneros separados por comas:', (item?.genres || []).join(', ')); if (genres === null) return;
      await window.Kitsune.api(`/admin/series/${id}`, { method:'PATCH', body:JSON.stringify({ title, synopsis, genres:genres.split(',').map(x => x.trim()).filter(Boolean) }) });
    }
    if (action === 'edit-episode') {
      const { items } = await window.Kitsune.api('/admin/episodes');
      const item = items.find(episode => episode.id === id);
      const title = prompt('Título del episodio:', item?.title); if (title === null) return;
      const number = prompt('Número del episodio:', item?.number); if (number === null) return;
      await window.Kitsune.api(`/admin/episodes/${id}`, { method:'PATCH', body:JSON.stringify({ title, number:Number(number) }) });
    }
    if (action === 'upload-video') {
      const file = [...adminPane.querySelectorAll('[data-video-file]')].find(input => input.dataset.videoFile === id)?.files?.[0];
      if (!file || file.type !== 'video/mp4' || file.size > 20 * 1024 * 1024) throw new Error('Selecciona un MP4 de hasta 20 MB');
      if (!confirm('Sube solo contenido propio o autorizado. En este prototipo gratuito, quien tenga el enlace podrá compartirlo. ¿Continuar?')) return;
      button.disabled = true; button.textContent = 'Subiendo...';
      const signed = await window.Kitsune.api(`/admin/episodes/${id}/video-upload`, { method:'POST' });
      const body = new FormData();
      body.append('file', file);
      body.append('api_key', signed.apiKey);
      body.append('signature', signed.signature);
      for (const [key, value] of Object.entries(signed.params)) body.append(key, value);
      const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/video/upload`, { method:'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Cloudinary rechazó el video');
      alert('Video recibido. Espera a que el estado cambie a listo antes de publicarlo.');
    }
    if (action === 'publish-episode' || action === 'unpublish-episode') await window.Kitsune.api(`/admin/episodes/${id}`, {
      method:'PATCH', body:JSON.stringify({ status: action === 'publish-episode' ? 'published' : 'draft' }) });
    if (action === 'delete-episode') {
      if (!confirm('¿Eliminar este episodio?')) return;
      await window.Kitsune.api(`/admin/episodes/${id}`, { method:'DELETE' });
    }
    if (action === 'delete' && !confirm('¿Eliminar esta serie y sus episodios?')) return;
    if (action === 'publish') await window.Kitsune.api(`/admin/series/${id}`, { method:'PATCH', body:JSON.stringify({ status:'published' }) });
    if (action === 'hide') await window.Kitsune.api(`/admin/series/${id}`, { method:'PATCH', body:JSON.stringify({ status:'hidden' }) });
    if (action === 'delete') await window.Kitsune.api(`/admin/series/${id}`, { method:'DELETE' });
    if (action === 'active') await window.Kitsune.api(`/admin/users/${id}`, { method:'PATCH', body:JSON.stringify({ isActive:button.dataset.value === 'true' }) });
    await show(currentSection);
    if (['publish','hide','delete','edit-series'].includes(action)) window.Kitsune.reloadCatalog();
  } catch (error) { alert(error.message); }
});
adminPane.addEventListener('change', async event => {
  if (event.target.dataset.action !== 'role') return;
  try { await window.Kitsune.api(`/admin/users/${event.target.dataset.id}`, { method:'PATCH', body:JSON.stringify({ role:event.target.value }) }); }
  catch (error) { alert(error.message); await show(currentSection); }
});

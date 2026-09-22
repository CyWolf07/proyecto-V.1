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
      adminPane.innerHTML = header(section) + `<form id="createSeries" class="cms-actions"><input name="title" required minlength="2" placeholder="Nombre de la nueva serie"><button class="cms-btn">＋ Crear serie</button></form>` + table(['Título','Estado','Acciones'], items.map(x => `<div class="cms-tr"><b>${esc(x.title)}</b><span>${esc(x.status)}</span><span><button class="mini" data-action="publish" data-id="${x.id}">Publicar</button><button class="mini danger" data-action="delete" data-id="${x.id}">Eliminar</button></span></div>`));
    }
    if (section === 'Episodios') {
      const [episodes, series] = await Promise.all([api('/admin/episodes'), api('/admin/series')]);
      adminPane.innerHTML = header(section) + `<form id="createEpisode" class="cms-card"><h2>Crear episodio</h2><div class="cms-form"><select name="seriesId" required>${series.items.map(x => `<option value="${x.id}">${esc(x.title)}</option>`).join('')}</select><input name="seasonNumber" type="number" min="1" value="1" required aria-label="Temporada"><input name="episodeNumber" type="number" min="1" required placeholder="Episodio" aria-label="Episodio"><input name="title" required minlength="2" placeholder="Título"><button class="cms-btn">Crear</button></div></form>` + table(['Episodio','Serie','Estado'], episodes.items.map(x => `<div class="cms-tr"><b>${esc(x.title)}</b><span>${esc(x.series_title)} · T${x.season_number} E${x.number}</span><span>${esc(x.status)}</span></div>`));
    }
    if (section === 'Usuarios') {
      const { items } = await api('/admin/users');
      adminPane.innerHTML = header(section) + table(['Usuario','Rol','Estado'], items.map(x => `<div class="cms-tr"><b>${esc(x.email)}</b><select data-action="role" data-id="${x.id}"><option value="user" ${x.role==='user'?'selected':''}>Usuario</option><option value="developer" ${x.role==='developer'?'selected':''}>Programador</option><option value="admin" ${x.role==='admin'?'selected':''}>Administrador</option></select><span>${x.is_active?'Activo':'Bloqueado'} <button class="mini danger" data-action="active" data-id="${x.id}" data-value="${!x.is_active}">${x.is_active?'Bloquear':'Activar'}</button></span></div>`));
    }
    if (section === 'Procesamiento') {
      const { items } = await api('/admin/jobs');
      adminPane.innerHTML = header(section) + `<div class="cms-card"><p>Los trabajos en cola requieren un worker de FFmpeg para generar HLS. El panel no marca videos como completados automáticamente.</p></div>` + table(['Serie / episodio','Estado','Acción'], items.map(x => `<div class="cms-tr"><b>${esc(x.series_title)} · ${esc(x.episode_title)}</b><span>${esc(x.status)}</span><span><button class="mini" data-action="retry" data-id="${x.id}" ${x.status==='failed'?'':'disabled'}>Reintentar</button></span></div>`));
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
    if (action === 'delete' && !confirm('¿Eliminar esta serie y sus episodios?')) return;
    if (action === 'publish') await window.Kitsune.api(`/admin/series/${id}`, { method:'PATCH', body:JSON.stringify({ status:'published' }) });
    if (action === 'delete') await window.Kitsune.api(`/admin/series/${id}`, { method:'DELETE' });
    if (action === 'active') await window.Kitsune.api(`/admin/users/${id}`, { method:'PATCH', body:JSON.stringify({ isActive:button.dataset.value === 'true' }) });
    if (action === 'retry') await window.Kitsune.api(`/admin/jobs/${id}/retry`, { method:'POST' });
    await show(currentSection);
    if (action === 'publish' || action === 'delete') window.Kitsune.reloadCatalog();
  } catch (error) { alert(error.message); }
});
adminPane.addEventListener('change', async event => {
  if (event.target.dataset.action !== 'role') return;
  try { await window.Kitsune.api(`/admin/users/${event.target.dataset.id}`, { method:'PATCH', body:JSON.stringify({ role:event.target.value }) }); }
  catch (error) { alert(error.message); await show(currentSection); }
});

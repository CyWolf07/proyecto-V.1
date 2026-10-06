const pages = [...document.querySelectorAll('.page')];
const loginButton = document.querySelector('#loginButton');
const sessionBox = document.querySelector('#session');
const cards = document.querySelector('#cards');
const stage = document.querySelector('#stage');
const video = document.createElement('video');
video.id = 'animeVideo';
video.controls = true;
video.playsInline = true;
video.hidden = true;
stage.appendChild(video);
let currentUser = null;
let series = [];
let favorites = [];
let history = [];
let selectedSeries = null;
let trailerTimer;
let hlsPlayer = null;
let currentEpisodeId = null;
let lastProgressSave = 0;

async function api(path, options = {}) {
  const response = await fetch(`/api/v1${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body.error || 'No se pudo completar la solicitud');
    error.field = body.field;
    throw error;
  }
  return body;
}
function renderSession() {
  loginButton.hidden = !!currentUser;
  sessionBox.hidden = !currentUser;
  document.querySelector('#favoriteButton').hidden = !currentUser?.id;
  if (currentUser) {
    const name = currentUser.name || currentUser.email?.split('@')[0] || 'Administrador';
    document.querySelector('#sessionName').textContent = name;
    document.querySelector('#sessionAvatar').textContent = name.charAt(0).toUpperCase();
  }
}
async function refreshSession() {
  try { currentUser = (await api('/auth/me')).user; }
  catch { currentUser = null; }
  renderSession();
  await refreshLibrary();
  if (series.length) await loadHome();
}
async function refreshLibrary() {
  if (!currentUser?.id) { favorites = []; history = []; renderLibrary(); return; }
  try {
    const [favoriteData, historyData] = await Promise.all([api('/me/favorites'), api('/me/history')]);
    favorites = favoriteData.items;
    history = historyData.items;
  } catch { favorites = []; history = []; }
  renderLibrary();
}
function renderLibrary() {
  const favoriteCards = document.querySelector('#favoriteCards');
  const historyList = document.querySelector('#historyList');
  favoriteCards.replaceChildren();
  historyList.replaceChildren();
  if (!currentUser?.id) {
    favoriteCards.textContent = 'Inicia sesión para guardar tus series favoritas.';
    historyList.textContent = 'Inicia sesión para consultar tu historial.';
    return;
  }
  if (!favorites.length) favoriteCards.textContent = 'Aún no tienes series en tu lista.';
  for (const item of favorites) {
    const card = document.createElement('article');
    const image = document.createElement('img'); image.src = item.poster_path || '/assets/hero-astral-edge.png'; image.alt = `Portada de ${item.title}`; image.loading = 'lazy';
    const title = document.createElement('h3'); title.textContent = item.title;
    card.append(image, title);
    card.tabIndex = 0; card.setAttribute('role', 'button');
    card.addEventListener('click', () => openSeries(item));
    card.addEventListener('keydown', event => { if (event.key === 'Enter') openSeries(item); });
    favoriteCards.append(card);
  }
  if (!history.length) historyList.textContent = 'Aún no hay episodios vistos.';
  for (const item of history) {
    const row = document.createElement('article');
    const button = document.createElement('button'); button.textContent = `${item.series_title} · T${item.season_number} E${item.episode_number}: ${item.episode_title}`;
    button.addEventListener('click', () => openSeries({ ...item, id: item.series_id, title: item.series_title }));
    const progress = document.createElement('p'); progress.textContent = `Guardado en ${Math.floor(item.position_seconds / 60)}:${String(item.position_seconds % 60).padStart(2, '0')}`;
    row.append(button, progress); historyList.append(row);
  }
}
function go(id) {
  if (id === 'admin' && currentUser?.role !== 'admin') id = 'admin-access';
  if (id !== 'player') { video.pause(); void saveProgress(); }
  pages.forEach(page => page.classList.toggle('on', page.id === id));
  document.querySelectorAll('nav button').forEach(button => button.classList.toggle('on', button.dataset.page === (id === 'admin-access' ? 'admin' : id)));
  if (id === 'admin') window.KitsuneAdmin?.show('Resumen');
  window.scrollTo(0, 0);
}
window.Kitsune = { api, go, refreshSession, reloadCatalog: loadCatalog, get user() { return currentUser; } };
function clearAuthError(form) {
  form.querySelectorAll('input').forEach(input => input.removeAttribute('aria-invalid'));
  form.querySelector('[role="alert"]').textContent = '';
}
function showAuthError(form, cause) {
  clearAuthError(form);
  const input = ['email', 'password', 'totp'].includes(cause.field) ? form.querySelector(`[name="${cause.field}"]`) : null;
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
  form.querySelector('[role="alert"]').textContent = input
    ? cause.field === 'email' ? 'Revisa el correo ingresado.' : cause.field === 'totp' ? cause.message : 'Revisa la contraseña ingresada.'
    : cause.message;
}
document.querySelectorAll('#loginForm,#registerForm,#adminLogin').forEach(form => {
  form.addEventListener('input', event => { if (event.target.matches('input')) clearAuthError(form); });
});
document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => go(button.dataset.page)));
document.querySelectorAll('[data-form]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-form],.form').forEach(item => item.classList.remove('on'));
  button.classList.add('on');
  document.querySelector(`#${button.dataset.form}`).classList.add('on');
}));
for (const form of document.querySelectorAll('#loginForm,#registerForm')) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearAuthError(form);
    const data = Object.fromEntries(new FormData(form));
    try {
      await api(form.id === 'loginForm' ? '/auth/login' : '/auth/register', { method: 'POST', body: JSON.stringify(data) });
      form.reset();
      await refreshSession();
      go('catalogo');
    } catch (cause) { showAuthError(form, cause); }
  });
}
document.querySelector('#adminLogin').addEventListener('submit', async event => {
  event.preventDefault();
  clearAuthError(event.target);
  try {
    await api('/auth/admin/login', { method: 'POST', body: JSON.stringify({ email: document.querySelector('#adminEmail').value, password: document.querySelector('#adminPassword').value, totp: document.querySelector('#adminTotp').value }) });
    event.target.reset();
    await refreshSession();
    go('admin');
  } catch (cause) { showAuthError(event.target, cause); }
});
document.querySelector('#logoutButton').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); } finally { currentUser = null; renderSession(); await refreshLibrary(); go('catalogo'); }
});
function drawCatalog() {
  const term = document.querySelector('#search').value.trim().toLocaleLowerCase();
  const genre = document.querySelector('.filters .on')?.textContent;
  const filtered = series.filter(item => (!term || `${item.title} ${item.genres.join(' ')}`.toLocaleLowerCase().includes(term)) && (genre === 'Todos' || item.genres.includes(genre)));
  cards.replaceChildren();
  if (!filtered.length) { const empty = document.createElement('p'); empty.textContent = 'No encontramos series con esos filtros.'; cards.appendChild(empty); }
  for (const item of filtered) {
    const card = document.createElement('article');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Abrir ${item.title}`);
    const cover = document.createElement('div'); cover.className = 'cover series-cover';
    const image = document.createElement('img'); image.src = item.poster_path || '/assets/hero-astral-edge.png'; image.alt = `Portada de ${item.title}`; image.loading = 'lazy'; cover.appendChild(image);
    const tag = document.createElement('span'); tag.textContent = item.trailer_path || item.slug === 'astral-edge' ? '▶ VER TRÁILER' : 'TRÁILER PRÓXIMAMENTE'; cover.appendChild(tag);
    const title = document.createElement('h3'); title.textContent = item.title;
    const genres = document.createElement('p'); genres.textContent = item.genres.join(' · ');
    card.append(cover, title, genres);
    card.addEventListener('click', () => openSeries(item));
    card.addEventListener('keydown', event => { if (event.key === 'Enter') openSeries(item); });
    cards.appendChild(card);
  }
}
async function loadCatalog() {
  try { series = (await api('/series?limit=48')).items; drawCatalog(); await loadHome(); }
  catch { cards.textContent = 'El catálogo no está disponible. Comprueba la conexión con la base de datos.'; }
}
async function loadHome() {
  const container = document.querySelector('#homeSections');
  try {
    const home = await api('/home');
    container.replaceChildren();
    for (const [key, title] of [['continueWatching','Continuar viendo'],['latest','Últimos episodios'],['popular','Populares'],['recommended','Recomendados']]) {
      if (!home[key]?.length) continue;
      const section = document.createElement('section');
      const heading = document.createElement('h2'); heading.textContent = title;
      const list = document.createElement('div'); list.className = 'home-row';
      for (const item of home[key]) {
        const button = document.createElement('button'); button.type = 'button';
        const image = document.createElement('img'); image.src = item.poster_path || '/assets/hero-astral-edge.png'; image.alt = ''; image.loading = 'lazy';
        const label = document.createElement('span'); label.textContent = item.episode_title ? `${item.title} · ${item.episode_title}` : item.title;
        button.append(image, label);
        button.addEventListener('click', () => openSeries(item)); list.append(button);
      }
      section.append(heading, list); container.append(section);
    }
  } catch { container.textContent = 'No se pudieron cargar las recomendaciones.'; }
}
document.querySelector('#search').addEventListener('input', drawCatalog);
document.querySelectorAll('.filters button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.filters button').forEach(item => item.classList.remove('on'));
  button.classList.add('on'); drawCatalog();
}));
function openSeries(item) {
  void saveProgress();
  selectedSeries = item;
  currentEpisodeId = null;
  hlsPlayer?.destroy(); hlsPlayer = null;
  go('player');
  const info = document.querySelector('.episode-info article');
  info.querySelector('h1').textContent = item.title;
  info.querySelector('p').textContent = item.synopsis || `Tráiler y novedades de ${item.title}.`;
  document.querySelector('#favoriteButton').textContent = favorites.some(favorite => favorite.id === item.id) ? 'Quitar de mi lista' : 'Agregar a mi lista';
  const episodeList = document.querySelector('#episodeList');
  episodeList.textContent = 'Cargando temporadas...';
  api(`/series/${encodeURIComponent(item.slug)}`).then(detail => {
    if (selectedSeries?.slug !== detail.slug) return;
    info.querySelector('p').textContent = detail.synopsis || `Tráiler y novedades de ${detail.title}.`;
    episodeList.replaceChildren();
    let seasonNumber = null;
    let count = 0;
    for (const episode of detail.seasons) {
      if (!episode.episode_id) continue;
      if (seasonNumber !== episode.number) {
        seasonNumber = episode.number;
        const heading = document.createElement('h3'); heading.textContent = `Temporada ${seasonNumber}`; episodeList.append(heading);
      }
      const row = document.createElement('button'); row.type = 'button'; row.className = 'episode-row';
      const label = document.createElement('small'); label.textContent = `Episodio ${episode.episode_number}`;
      const title = document.createElement('strong'); title.textContent = episode.episode_title;
      row.addEventListener('click', () => playEpisode(episode.episode_id));
      row.append(label, title); episodeList.append(row); count++;
    }
    if (!count) episodeList.textContent = 'Los capítulos aparecerán cuando estén publicados.';
  }).catch(() => { episodeList.textContent = 'No se pudieron cargar los episodios.'; });
  const animation = stage.querySelectorAll('.frame,.shade,.movie-title,.quote,.controls');
  clearInterval(trailerTimer);
  stage.classList.remove('playing');
  if (item.trailer_path) {
    animation.forEach(el => el.hidden = true);
    video.hidden = false;
    video.poster = item.poster_path || '';
    video.src = item.trailer_path;
    video.play().catch(() => {});
  } else {
    video.pause(); video.hidden = true;
    animation.forEach(el => el.hidden = false);
    stage.querySelector('.frame').style.backgroundImage = `url("${item.poster_path || '/assets/hero-astral-edge.png'}")`;
    if (item.slug === 'astral-edge') document.querySelector('#play').click();
  }
}
async function playEpisode(episodeId) {
  try {
    const [{ url }, progress] = await Promise.all([
      api(`/episodes/${episodeId}/playback`),
      currentUser?.id ? api(`/me/progress/${episodeId}`) : Promise.resolve({ positionSeconds: 0 }),
    ]);
    hlsPlayer?.destroy(); hlsPlayer = null;
    currentEpisodeId = episodeId;
    video.pause(); video.removeAttribute('src'); video.load();
    stage.querySelectorAll('.frame,.shade,.movie-title,.quote,.controls').forEach(el => { el.hidden = true; });
    video.hidden = false;
    video.addEventListener('loadedmetadata', () => {
      if (currentEpisodeId === episodeId && progress.positionSeconds > 0) video.currentTime = progress.positionSeconds;
    }, { once: true });
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url; await video.play();
    }
    else if (window.Hls?.isSupported()) {
      hlsPlayer = new window.Hls();
      hlsPlayer.on(window.Hls.Events.MANIFEST_PARSED, () => { void video.play().catch(() => {}); });
      hlsPlayer.loadSource(url); hlsPlayer.attachMedia(video);
    } else throw new Error('Este navegador no admite reproducción HLS');
  } catch (error) { alert(error.message); }
}
async function saveProgress() {
  if (!currentEpisodeId || !currentUser?.id || !Number.isFinite(video.currentTime)) return;
  try { await api(`/me/progress/${currentEpisodeId}`, { method:'PUT',
    body:JSON.stringify({ positionSeconds: Math.floor(video.currentTime) }) }); }
  catch { /* El avance volverá a intentarse en el próximo evento. */ }
}
video.addEventListener('timeupdate', () => {
  if (currentEpisodeId && Date.now() - lastProgressSave > 10_000) {
    lastProgressSave = Date.now(); void saveProgress();
  }
});
video.addEventListener('pause', () => { void saveProgress(); });
video.addEventListener('ended', () => { void saveProgress(); void refreshLibrary(); });
document.querySelector('#favoriteButton').addEventListener('click', async () => {
  if (!selectedSeries || !currentUser?.id) return;
  const saved = favorites.some(item => item.id === selectedSeries.id);
  try {
    await api(`/me/favorites/${selectedSeries.id}`, { method: saved ? 'DELETE' : 'PUT' });
    await refreshLibrary();
    document.querySelector('#favoriteButton').textContent = saved ? 'Agregar a mi lista' : 'Quitar de mi lista';
  } catch (error) { alert(error.message); }
});
document.querySelector('#play').addEventListener('click', () => {
  if (selectedSeries?.slug !== 'astral-edge') return;
  clearInterval(trailerTimer);
  stage.classList.remove('playing'); void stage.offsetWidth; stage.classList.add('playing');
  const start = Date.now();
  trailerTimer = setInterval(() => {
    const elapsed = Math.min(14, Math.floor((Date.now() - start) / 1000));
    document.querySelector('#time').textContent = `00:${String(elapsed).padStart(2, '0')} / 00:14`;
    if (elapsed === 14) { clearInterval(trailerTimer); stage.classList.remove('playing'); }
  }, 250);
});
document.querySelector('#full').addEventListener('click', () => stage.requestFullscreen?.());
document.querySelector('[data-page="player"]').addEventListener('click', () => { if (!selectedSeries) openSeries(series[0] || { title: 'Astral Edge', slug: 'astral-edge', synopsis: '', poster_path: '/assets/hero-astral-edge.png' }); });
refreshSession().then(loadCatalog);

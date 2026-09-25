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
let selectedSeries = null;
let trailerTimer;

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
}
function go(id) {
  if (id === 'admin' && currentUser?.role !== 'admin') id = 'admin-access';
  if (id !== 'player') video.pause();
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
  const input = ['email', 'password'].includes(cause.field) ? form.querySelector(`[name="${cause.field}"]`) : null;
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
  form.querySelector('[role="alert"]').textContent = input
    ? cause.field === 'email' ? 'Revisa el correo ingresado.' : 'Revisa la contraseña ingresada.'
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
    await api('/auth/admin/login', { method: 'POST', body: JSON.stringify({ email: document.querySelector('#adminEmail').value, password: document.querySelector('#adminPassword').value }) });
    event.target.reset();
    await refreshSession();
    go('admin');
  } catch (cause) { showAuthError(event.target, cause); }
});
document.querySelector('#logoutButton').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); } finally { currentUser = null; renderSession(); go('catalogo'); }
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
  try { series = (await api('/series?limit=48')).items; drawCatalog(); }
  catch { cards.textContent = 'El catálogo no está disponible. Comprueba la conexión con la base de datos.'; }
}
document.querySelector('#search').addEventListener('input', drawCatalog);
document.querySelectorAll('.filters button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.filters button').forEach(item => item.classList.remove('on'));
  button.classList.add('on'); drawCatalog();
}));
function openSeries(item) {
  selectedSeries = item;
  go('player');
  const info = document.querySelector('.episode-info article');
  info.querySelector('h1').textContent = item.title;
  info.querySelector('p').textContent = item.synopsis || `Tráiler y novedades de ${item.title}.`;
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

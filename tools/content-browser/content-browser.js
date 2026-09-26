/*
 * Content Browser — a real Document Authoring (DA) app.
 *
 * Live inside DA it uses the DA SDK (auth + context) and the DA Admin List API to browse
 * the actual content of an org/repo. Opened standalone (e.g. the GitHub Pages preview) it
 * can't reach an authenticated DA session, so it falls back to sample data and shows a
 * "preview mode" banner. Same file, both worlds.
 *
 * Reference: https://docs.da.live/developers  ·  List API: https://docs.da.live/developers/api/list
 */

const ASSET_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'mp4', 'pdf', 'ico']);
const LOCALE_CODES = new Set(['en', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pt', 'zh', 'nl', 'sv', 'da', 'no', 'fi', 'pl', 'ru', 'ar', 'he', 'tr', 'cs', 'hi']);
const FILTERS = [['all', 'All'], ['page', 'Pages'], ['fragment', 'Fragments'], ['config', 'Config'], ['locale', 'Locales'], ['asset', 'Assets'], ['folder', 'Folders']];
const catItem = { page: 'Page', fragment: 'Fragment', config: 'Config', locale: 'Locale', asset: 'Asset' };
const catCont = { page: 'Pages', fragment: 'Fragments', config: 'Config', locale: 'Locale', asset: 'Assets' };

let daFetch = null;
let ctx = { org: 'blofft1', repo: 'wknd-advanced' }; // preview default; real DA context overrides
let adminOrigin = 'https://admin.da.live';
let live = false;

let folderRel = '';   // current folder, repo-relative, no leading slash
let items = [];       // normalized rows for the current folder
let filter = 'all';
let search = '';

const root = document.getElementById('cb-root');

/* ---------- DA SDK bootstrap (with standalone fallback) ---------- */
async function getSdk(timeoutMs = 1800){
  try {
    const mod = await import('https://da.live/nx/utils/sdk.js');
    return await Promise.race([mod.default, new Promise((r) => setTimeout(() => r(null), timeoutMs))]);
  } catch { return null; }
}
function urlOrgRepo(){
  const p = new URLSearchParams(location.search);
  const org = p.get('org'); const repo = p.get('repo');
  return org && repo ? { org, repo } : null;
}

/* ---------- DA Admin List API ---------- */
async function fetchList(rel){
  const suffix = String(rel || '').replace(/^\/+/, '');
  const base = `${adminOrigin}/list/${encodeURIComponent(ctx.org)}/${encodeURIComponent(ctx.repo)}`;
  const url = suffix ? `${base}/${suffix}` : base;
  const out = [];
  let token = null;
  do {
    const headers = { Accept: 'application/json' };
    if(token) headers['da-continuation-token'] = token;
    const res = await daFetch(url, { headers }); // eslint-disable-line no-await-in-loop
    if(res.status === 404) return [];
    if(!res.ok) throw new Error('List API HTTP ' + res.status);
    const chunk = await res.json(); // eslint-disable-line no-await-in-loop
    out.push(...(Array.isArray(chunk) ? chunk : []));
    token = res.headers.get('da-continuation-token');
  } while(token);
  return out;
}

function classify(it){
  if(!it.ext){
    const nm = (it.name || '').toLowerCase();
    let category = null;
    if(LOCALE_CODES.has(nm)) category = 'locale';
    else if(nm === 'fragments') category = 'fragment';
    else if(nm === 'config' || nm === '.da') category = 'config';
    return { kind: 'container', category };
  }
  const ext = it.ext.toLowerCase();
  if(ASSET_EXTS.has(ext)) return { kind: 'item', category: 'asset' };
  if(ext === 'json') return { kind: 'item', category: 'config' };
  if((it.path || '').toLowerCase().includes('/fragments/')) return { kind: 'item', category: 'fragment' };
  return { kind: 'item', category: 'page' };
}

function normalize(list){
  return list.map((it) => {
    const c = classify(it);
    return {
      displayName: it.name,
      name: it.ext ? `${it.name}.${it.ext}` : it.name,
      ext: it.ext || '',
      kind: c.kind,
      category: c.category,
      path: it.path || '',
      modified: it.lastModified ? new Date(it.lastModified * (it.lastModified < 1e12 ? 1000 : 1)).toLocaleDateString() : '—',
    };
  }).sort((a, b) => {
    if((a.kind === 'container') !== (b.kind === 'container')) return a.kind === 'container' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });
}

function canvasUrl(path, ext){
  const clean = ext === 'html' ? path.replace(/\.html$/i, '') : path;
  return `https://da.live/canvas#${clean}`; // List API path already includes /{org}/{repo}
}

/* ---------- Sample data (preview mode only) ---------- */
const sampleRoot = [
  { name: 'about-us', ext: 'html', path: '/blofft1/wknd-advanced/about-us', lastModified: 1721433600 },
  { name: 'articles', ext: '', path: '/blofft1/wknd-advanced/articles' },
  { name: 'en', ext: '', path: '/blofft1/wknd-advanced/en' },
  { name: 'de', ext: '', path: '/blofft1/wknd-advanced/de' },
  { name: 'events', ext: 'html', path: '/blofft1/wknd-advanced/events', lastModified: 1721433600 },
  { name: 'fragments', ext: '', path: '/blofft1/wknd-advanced/fragments' },
  { name: 'config', ext: '', path: '/blofft1/wknd-advanced/config' },
  { name: 'icons', ext: '', path: '/blofft1/wknd-advanced/icons' },
  { name: 'index', ext: 'html', path: '/blofft1/wknd-advanced/index', lastModified: 1721433600 },
  { name: 'search', ext: 'svg', path: '/blofft1/wknd-advanced/icons/search.svg', lastModified: 1721433600 },
];
const sampleChildren = {
  articles: [
    { name: 'trips-worth-taking', ext: 'html', path: '/blofft1/wknd-advanced/articles/trips-worth-taking', lastModified: 1721433600 },
    { name: 'weekend-escapes', ext: 'html', path: '/blofft1/wknd-advanced/articles/weekend-escapes', lastModified: 1721347200 },
    { name: '2026', ext: '', path: '/blofft1/wknd-advanced/articles/2026' },
  ],
  fragments: [
    { name: 'related-articles', ext: 'html', path: '/blofft1/wknd-advanced/fragments/related-articles', lastModified: 1721433600 },
    { name: 'hero-banner', ext: 'html', path: '/blofft1/wknd-advanced/fragments/hero-banner', lastModified: 1721001600 },
  ],
};
function sampleFor(rel){ return normalize(rel === '' ? sampleRoot : (sampleChildren[rel] || [])); }

/* ---------- Rendering ---------- */
function iconSvg(r){
  const shape = r.kind === 'container'
    ? '<path d="M2 5a1 1 0 011-1h4l2 2h8a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" fill="currentColor"/>'
    : '<path d="M5 2h6l4 4v12H5V2z" stroke="currentColor" stroke-width="1.3" fill="none"/>';
  return `<svg class="ic" viewBox="0 0 20 20" fill="none">${shape}</svg>`;
}
function badge(r){
  if(!r.category) return '<span class="muted">—</span>';
  const label = r.kind === 'container' ? (catCont[r.category] || 'Folder') : (catItem[r.category] || 'File');
  return `<span class="badge b-${r.category}">${label}</span>`;
}

function buildShell(){
  root.innerHTML = `
    <div class="cb-wrap">
      <div class="cb-head">
        <h1>Content Browser</h1>
        <span class="cb-context" id="cbContext"></span>
        <button class="cb-refresh" id="cbRefresh" title="Refresh">↻ Refresh</button>
      </div>
      <div class="cb-banner" id="cbBanner"></div>
      <div class="toolbar" id="cbChips"></div>
      <div class="table-card">
        <div class="crumbs-row" id="cbCrumbs"></div>
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Modified</th></tr></thead>
          <tbody id="cbBody"></tbody>
        </table>
      </div>
    </div>`;

  const chips = document.getElementById('cbChips');
  FILTERS.forEach(([key, label]) => {
    const c = document.createElement('div');
    c.className = 'chip-filter' + (key === filter ? ' active' : '');
    c.textContent = label;
    c.dataset.key = key;
    c.addEventListener('click', () => { filter = key; renderTable(); });
    chips.appendChild(c);
  });
  const box = document.createElement('div');
  box.className = 'search-box';
  box.innerHTML = '⌕ <input id="cbSearch" placeholder="Filter by name…">';
  chips.appendChild(box);
  document.getElementById('cbSearch').addEventListener('input', (e) => { search = e.target.value.toLowerCase(); renderTable(); });

  document.getElementById('cbRefresh').addEventListener('click', () => navigate(folderRel));
  document.getElementById('cbContext').textContent = `${ctx.org} / ${ctx.repo}`;

  const banner = document.getElementById('cbBanner');
  if(live){ banner.style.display = 'none'; }
  else { banner.textContent = '🧪 Preview mode — showing sample data. Registered as a DA app, this reads your real content live via the DA List API.'; }
}

function renderTable(){
  document.querySelectorAll('#cbChips .chip-filter').forEach((c) => c.classList.toggle('active', c.dataset.key === filter));

  // breadcrumb
  const crumbs = document.getElementById('cbCrumbs');
  const parts = folderRel ? folderRel.split('/') : [];
  let html = `<span class="crumb-link${parts.length ? '' : ' active'}" data-rel="">⌂ ${ctx.repo}</span>`;
  let acc = '';
  parts.forEach((p, i) => {
    acc = acc ? `${acc}/${p}` : p;
    html += `<span class="crumb-sep">›</span><span class="crumb-link${i === parts.length - 1 ? ' active' : ''}" data-rel="${acc}">${p}</span>`;
  });
  crumbs.innerHTML = html;
  crumbs.querySelectorAll('.crumb-link').forEach((c) => c.addEventListener('click', () => navigate(c.dataset.rel)));

  const list = items
    .filter((r) => (filter === 'all' ? true : filter === 'folder' ? !r.category : r.category === filter))
    .filter((r) => !search || r.name.toLowerCase().includes(search) || r.displayName.toLowerCase().includes(search));

  const body = document.getElementById('cbBody');
  body.innerHTML = '';
  if(!list.length){
    body.innerHTML = '<tr><td colspan="3" class="muted" style="padding:24px 14px;">This folder is empty.</td></tr>';
    return;
  }
  list.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="name-cell">${iconSvg(r)}${r.displayName}</div></td>
      <td>${badge(r)}</td>
      <td class="modified">${r.modified}</td>`;
    tr.addEventListener('click', () => {
      if(r.kind === 'container') navigate(folderRel ? `${folderRel}/${r.displayName}` : r.displayName);
      else openCanvas(r);
    });
    body.appendChild(tr);
  });
}

function openCanvas(r){
  if(live && r.path){
    const url = canvasUrl(r.path, r.ext);
    try { window.top.location.href = url; } catch { window.open(url, '_blank'); }
  } else {
    toast('Preview mode — this opens in the DA canvas editor when running inside DA.');
  }
}

let toastTimer;
function toast(msg){
  let t = document.getElementById('cbToast');
  if(!t){ t = document.createElement('div'); t.id = 'cbToast'; t.className = 'cb-toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

async function navigate(rel){
  folderRel = rel || '';
  if(live){
    document.getElementById('cbBody').innerHTML = '<tr><td colspan="3" class="cb-loading">Loading…</td></tr>';
    try { items = normalize(await fetchList(folderRel)); }
    catch(e){ items = []; toast(e.message); }
  } else {
    items = sampleFor(folderRel);
  }
  renderTable();
}

/* ---------- Init ---------- */
(async function init(){
  const sdk = await getSdk();
  if(sdk){
    daFetch = sdk.actions?.daFetch ?? null;
    if(sdk.context) ctx = { ...sdk.context };
  }
  const forced = urlOrgRepo();
  if(forced){ ctx.org = forced.org; ctx.repo = forced.repo; }
  live = Boolean(daFetch && ctx.org && ctx.repo);

  buildShell();
  navigate('');
})();

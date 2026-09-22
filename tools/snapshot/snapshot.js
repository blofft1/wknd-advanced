/* eslint-disable no-console */
// Snapshot — a DA editor (right-rail) extension to assemble, review, and audit
// multi-page snapshots. Real page browsing + snapshot assembly via the DA List API;
// the admin actions (create in .aem.reviews, request-review/lock, approve & publish,
// reject & unlock) are MOCKED — they require the admin.hlx.page /snapshot API, whose
// hlx admin token the DA_SDK token doesn't grant (sidekick/worker = step 2).

import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { DA_ORIGIN } from 'https://da.live/nx/public/utils/constants.js';

let ctx; // { org, repo, path, token, actions }

const SKIP = new Set(['media', 'icons', 'tools', 'drafts', 'fragments', '.da', '.git', '.helix', 'launches']);

const state = {
  docs: null,          // array of relative page paths (no .html)
  selected: new Set(), // chosen page paths for the snapshot being built
  snapshots: [],       // session audit list of assembled snapshots
  current: null,       // snapshot object currently in Review
  tab: 'create',
  filter: '',
};

/* ---------------- helpers ---------------- */
const slug = (s) => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const normalizePath = (p) => {
  if (!p) return '';
  const w = p.startsWith('/') ? p : `/${p}`;
  return w.replace(/\.html$/, '');
};
const reviewsUrl = (name, path) => `https://${slug(name)}--main--${ctx.repo}--${ctx.org}.aem.reviews${path}`;
const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.querySelector('.toast-message').textContent = msg;
  el.className = `toast ${type}`;
  setTimeout(() => el.classList.add('hidden'), 5000);
}

async function listDocs() {
  const docs = [];
  async function walk(path) {
    let entries;
    try {
      const res = await ctx.actions.daFetch(`${DA_ORIGIN}/list/${ctx.org}/${ctx.repo}${path}`);
      if (!res.ok) return;
      entries = await res.json();
    } catch { return; }
    if (!Array.isArray(entries)) entries = entries.data || [];
    const folders = [];
    entries.forEach((e) => {
      const rel = (e.path || '').replace(`/${ctx.org}/${ctx.repo}`, '');
      if (e.ext === 'html') docs.push(rel.replace(/\.html$/, ''));
      else if (!e.ext && e.name && !e.name.startsWith('.') && !SKIP.has(e.name)) folders.push(rel);
    });
    await Promise.all(folders.map(walk));
  }
  await walk('');
  docs.sort();
  return docs;
}

/* ---------------- render ---------------- */
function render() {
  const app = document.getElementById('snap-app');
  app.innerHTML = `
    <header class="sn-head"><h1>Snapshot</h1></header>
    <nav class="sn-tabs">
      <button data-tab="create" class="sn-tab">Create</button>
      <button data-tab="review" class="sn-tab">Review</button>
      <button data-tab="audit" class="sn-tab">Audit</button>
    </nav>
    <section id="sn-body" class="sn-body"></section>
  `;
  app.querySelectorAll('.sn-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === state.tab);
    b.addEventListener('click', () => { state.tab = b.dataset.tab; render(); });
  });
  const body = app.querySelector('#sn-body');
  if (state.tab === 'create') renderCreate(body);
  if (state.tab === 'review') renderReview(body);
  if (state.tab === 'audit') renderAudit(body);
}

function renderCreate(body) {
  body.innerHTML = `
    <label class="sn-label" for="sn-name">Snapshot name</label>
    <input id="sn-name" class="sn-input" placeholder="e.g. fall-collection-2026" autocomplete="off">
    <label class="sn-label" for="sn-desc">Description (optional)</label>
    <input id="sn-desc" class="sn-input" placeholder="What's in this release?">
    <label class="sn-check"><input type="checkbox" id="sn-lock" checked> Lock pages during review</label>

    <div class="sn-subhead">Pages <span id="sn-count" class="sn-count">0 selected</span></div>
    <input id="sn-filter" class="sn-input" placeholder="Filter pages…" value="${esc(state.filter)}">
    <div id="sn-list" class="sn-list"><div class="sn-muted">Loading pages…</div></div>

    <button id="sn-create" class="sn-btn sn-btn-primary">Create Snapshot</button>
    <p class="sn-note">Browsing + assembly are live. The actual create in <code>.aem.reviews</code> needs the hlx admin API (sidekick/worker) — mocked here.</p>
  `;

  const listEl = body.querySelector('#sn-list');
  const countEl = body.querySelector('#sn-count');
  const filterEl = body.querySelector('#sn-filter');

  const paint = () => {
    const q = state.filter.toLowerCase();
    const rows = (state.docs || []).filter((p) => !q || p.toLowerCase().includes(q));
    countEl.textContent = `${state.selected.size} selected`;
    if (!rows.length) { listEl.innerHTML = '<div class="sn-muted">No pages match.</div>'; return; }
    listEl.innerHTML = rows.map((p) => `
      <label class="sn-row">
        <input type="checkbox" data-path="${esc(p)}" ${state.selected.has(p) ? 'checked' : ''}>
        <span class="sn-path">${esc(p)}</span>
      </label>`).join('');
    listEl.querySelectorAll('input[type=checkbox]').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (cb.checked) state.selected.add(cb.dataset.path); else state.selected.delete(cb.dataset.path);
        countEl.textContent = `${state.selected.size} selected`;
      });
    });
  };

  filterEl.addEventListener('input', () => { state.filter = filterEl.value; paint(); });

  if (state.docs) { paint(); } else {
    listDocs().then((docs) => {
      state.docs = docs;
      if (ctx.path && docs.includes(ctx.path)) state.selected.add(ctx.path); // seed current page
      paint();
    }).catch((e) => { listEl.innerHTML = `<div class="sn-muted">Could not list pages (${e.message}).</div>`; });
  }

  body.querySelector('#sn-create').addEventListener('click', () => {
    const name = body.querySelector('#sn-name').value;
    if (!slug(name)) { toast('Enter a snapshot name.', 'warn'); return; }
    if (state.selected.size < 1) { toast('Select at least one page.', 'warn'); return; }
    const snap = {
      name: slug(name),
      description: body.querySelector('#sn-desc').value,
      locked: body.querySelector('#sn-lock').checked,
      status: body.querySelector('#sn-lock').checked ? 'In review (locked)' : 'Draft',
      pages: [...state.selected],
      created: new Date(),
    };
    state.snapshots.unshift(snap);
    state.current = snap;
    state.selected = new Set();
    state.tab = 'review';
    render();
    toast(`(mock) Snapshot "${snap.name}" assembled with ${snap.pages.length} pages ✓`, 'success');
  });
}

function renderReview(body) {
  const s = state.current;
  if (!s) { body.innerHTML = '<div class="sn-muted">Create a snapshot, or pick one from Audit.</div>'; return; }
  body.innerHTML = `
    <div class="sn-snaphead">
      <strong>${esc(s.name)}</strong>
      <span class="sn-status ${s.locked ? 'locked' : ''}">${esc(s.status)}</span>
    </div>
    ${s.description ? `<p class="sn-muted">${esc(s.description)}</p>` : ''}
    <div class="sn-subhead">Pages (${s.pages.length}) — review on <code>.aem.reviews</code></div>
    <div class="sn-list">
      ${s.pages.map((p) => `
        <div class="sn-row">
          <a class="sn-review-link" href="${reviewsUrl(s.name, p)}" target="_blank" rel="noopener">${esc(p)} ↗</a>
        </div>`).join('')}
    </div>
    <div class="sn-actions">
      <button id="sn-approve" class="sn-btn sn-btn-primary">Approve &amp; Publish</button>
      <button id="sn-reject" class="sn-btn">Reject &amp; Unlock</button>
      <button id="sn-lock-toggle" class="sn-btn sn-btn-ghost">${s.locked ? 'Unlock' : 'Request Review (lock)'}</button>
    </div>
    <div class="sn-placeholders">
      <span class="sn-chip" title="coming soon">🔔 Notifications</span>
      <span class="sn-chip" title="coming soon">🔀 Bulk diff</span>
      <span class="sn-chip" title="coming soon">✎ Mark-up</span>
    </div>
    <p class="sn-note">Approve/Reject/Lock call the hlx admin <code>/snapshot</code> API — mocked here (step 2: sidekick/worker).</p>
  `;
  body.querySelector('#sn-approve').addEventListener('click', () => {
    s.status = 'Published'; s.locked = false; render(); toast('(mock) Approved & published ✓', 'success');
  });
  body.querySelector('#sn-reject').addEventListener('click', () => {
    s.status = 'Rejected — unlocked'; s.locked = false; render(); toast('(mock) Rejected & unlocked', 'info');
  });
  body.querySelector('#sn-lock-toggle').addEventListener('click', () => {
    s.locked = !s.locked; s.status = s.locked ? 'In review (locked)' : 'Draft'; render();
    toast(s.locked ? '(mock) Review requested — snapshot locked' : '(mock) Unlocked', 'info');
  });
}

function renderAudit(body) {
  body.innerHTML = `
    <input id="sn-search" class="sn-input" placeholder="Search snapshots by name…">
    <div id="sn-audit" class="sn-list"></div>
    <p class="sn-note">Session list. The live version queries the <code>/snapshot</code> API across the site (search by date, name, status).</p>
  `;
  const wrap = body.querySelector('#sn-audit');
  const paint = (q = '') => {
    const rows = state.snapshots.filter((s) => !q || s.name.includes(q.toLowerCase()));
    if (!rows.length) { wrap.innerHTML = '<div class="sn-muted">No snapshots yet.</div>'; return; }
    wrap.innerHTML = rows.map((s, i) => `
      <button class="sn-audit-row" data-i="${state.snapshots.indexOf(s)}">
        <span class="sn-audit-name">${esc(s.name)}</span>
        <span class="sn-audit-meta">${s.pages.length}p · ${s.created.toLocaleDateString()} · ${esc(s.status)}</span>
      </button>`).join('');
    wrap.querySelectorAll('.sn-audit-row').forEach((b) => b.addEventListener('click', () => {
      state.current = state.snapshots[Number(b.dataset.i)]; state.tab = 'review'; render();
    }));
  };
  body.querySelector('#sn-search').addEventListener('input', (e) => paint(e.target.value));
  paint();
}

/* ---------------- init ---------------- */
(async function init() {
  try {
    const sdk = await DA_SDK;
    const context = sdk.context || sdk;
    ctx = {
      org: context.org,
      repo: context.repo,
      path: normalizePath(context.path || ''),
      token: sdk.token,
      actions: sdk.actions,
    };
    if (!ctx.org || !ctx.repo || !ctx.actions) throw new Error('No DA context');
    render();
  } catch (e) {
    console.error(e);
    document.getElementById('snap-app').innerHTML = '<div class="loading">Open Snapshot from inside the DA editor (sign in to Document Authoring), then refresh.</div>';
  }
}());

/* eslint-disable no-console */
// Launch — a DA editor (right-rail) extension that "branches" the current page so
// one author can edit an isolated copy while others keep editing the original,
// with quick links to compare, and an Activate date range that schedules go-live.
//
// Branch model (DA has no git-style content branch): copy the page to a parallel
// path under /launches/{name}/{path}. A pre-launch backup of the original is kept
// at /launches/{name}/_original/{path} so we can auto-revert.
//
// Scheduling: writes rows to the site's .helix/crontab sheet (the EDS scheduler).
// NOTE: cron can only publish/unpublish a PATH — it cannot copy. So the fully
// scheduled "swap the ORIGINAL url to branch content, then auto-revert" needs the
// companion launch worker (step 2). What is fully functional here: real branch
// copy, compare links, "Go Live Now" swap, revert, and scheduling the branch's
// own /launches URL for the window.

import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { DA_ORIGIN } from 'https://da.live/nx/public/utils/constants.js';

let ctx; // { org, repo, path, token, actions }

/* ---------------- helpers ---------------- */
const slug = (s) => (s || '')
  .toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const normalizePath = (p) => {
  if (!p) return '';
  const withSlash = p.startsWith('/') ? p : `/${p}`;
  return withSlash.replace(/\.html$/, '');
};

const esc = (s) => (s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const srcUrl = (path, ext = 'html') => `${DA_ORIGIN}/source/${ctx.org}/${ctx.repo}${path}.${ext}`;
const previewUrl = (path) => `https://main--${ctx.repo}--${ctx.org}.aem.page${path}`;
const canvasUrl = (path) => `https://da.live/canvas#/${ctx.org}/${ctx.repo}${path}`;
const branchPathFor = (name) => `/launches/${slug(name)}${ctx.path}`;
const backupPathFor = (name) => `/launches/${slug(name)}/_original${ctx.path}`;

async function readSource(path, ext = 'html') {
  const res = await ctx.actions.daFetch(srcUrl(path, ext));
  if (!res.ok) throw new Error(`read ${path}.${ext} → ${res.status}`);
  return res.text();
}

async function writeSource(path, content, ext = 'html', type = 'text/html') {
  const body = new FormData();
  body.append('data', new Blob([content], { type }));
  const res = await ctx.actions.daFetch(srcUrl(path, ext), { method: 'POST', body });
  if (!res.ok) throw new Error(`write ${path}.${ext} → ${res.status}`);
  return res;
}

async function exists(path, ext = 'html') {
  try {
    const res = await ctx.actions.daFetch(srcUrl(path, ext), { method: 'HEAD' });
    return res.ok;
  } catch { return false; }
}

function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.querySelector('.toast-message').textContent = msg;
  el.className = `toast ${type}`;
  setTimeout(() => el.classList.add('hidden'), 5000);
}

// Best-effort conversion of a datetime-local value into a "later" text expression
// for the crontab `when` column. Verify against aem.live/docs/scheduling — the
// exact one-shot syntax can need tweaking, so we also surface it in the UI.
function toWhen(dtLocal) {
  if (!dtLocal) return '';
  const d = new Date(dtLocal);
  const h = d.getHours();
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = ((h + 11) % 12) + 1;
  const mm = String(d.getMinutes()).padStart(2, '0');
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  const day = d.getDate();
  const ord = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  return `at ${h12}:${mm} ${ampm} on the ${ord(day)} day of ${months[d.getMonth()]}`;
}

/* ---------------- actions ---------------- */
async function createBranch(name) {
  const html = await readSource(ctx.path);
  await writeSource(branchPathFor(name), html);            // the editable branch
  if (!(await exists(backupPathFor(name)))) {
    await writeSource(backupPathFor(name), html);          // restore point for revert
  }
  return branchPathFor(name);
}

async function goLiveNow(name) {
  const branchHtml = await readSource(branchPathFor(name));
  if (!(await exists(backupPathFor(name)))) {
    const orig = await readSource(ctx.path);
    await writeSource(backupPathFor(name), orig);          // ensure we can revert
  }
  await writeSource(ctx.path, branchHtml);                 // swap branch content onto original path
}

async function revert(name) {
  const orig = await readSource(backupPathFor(name));
  await writeSource(ctx.path, orig);
}

async function scheduleWindow(name, startLocal, endLocal) {
  // Read existing crontab sheet (if any), append rows, write back.
  let sheet;
  try { sheet = JSON.parse(await readSource('/.helix/crontab', 'json')); } catch { sheet = null; }
  const data = (sheet && Array.isArray(sheet.data)) ? sheet.data : [];
  const bp = branchPathFor(name);
  if (startLocal) data.push({ when: toWhen(startLocal), command: `publish ${bp}` });
  if (endLocal) data.push({ when: toWhen(endLocal), command: `unpublish ${bp}` });
  const out = {
    total: data.length, limit: data.length, offset: 0, data, ':type': 'sheet',
  };
  await writeSource('/.helix/crontab', JSON.stringify(out, null, 2), 'json', 'application/json');
  return data.slice(-2);
}

/* ---------------- UI ---------------- */
function render() {
  const app = document.getElementById('launch-app');
  app.innerHTML = `
    <header class="lx-head">
      <h1>Launch</h1>
      <p class="lx-page" title="${ctx.path}">Page: <code>${ctx.path || '—'}</code></p>
    </header>

    <section class="lx-card">
      <label class="lx-label" for="lx-name">Branch name</label>
      <input id="lx-name" class="lx-input" placeholder="e.g. summer-sale" autocomplete="off">
      <button id="lx-create" class="lx-btn lx-btn-primary">Create Branch</button>
      <p class="lx-hint">Copies this page to <code>/launches/&lt;name&gt;${ctx.path}</code> so you can edit it while others keep editing the original.</p>
    </section>

    <section id="lx-links" class="lx-card lx-hidden">
      <h2 class="lx-h2">Compare</h2>
      <div class="lx-links"></div>
    </section>

    <section id="lx-activate" class="lx-card lx-hidden">
      <h2 class="lx-h2">Activate date range</h2>
      <label class="lx-label" for="lx-start">Go live</label>
      <input id="lx-start" class="lx-input" type="datetime-local">
      <label class="lx-label" for="lx-end">Auto-revert</label>
      <input id="lx-end" class="lx-input" type="datetime-local">
      <button id="lx-schedule" class="lx-btn">Schedule Launch</button>
      <div class="lx-divider"></div>
      <button id="lx-golive" class="lx-btn lx-btn-primary">Go Live Now (swap onto original)</button>
      <button id="lx-revert" class="lx-btn lx-btn-ghost">Revert to original</button>
      <pre id="lx-cron" class="lx-cron lx-hidden"></pre>
      <p class="lx-note">⚠️ Cron publishes the branch at its own <code>/launches</code> URL for the window. The scheduled <em>swap onto the original URL</em> + timed auto-revert needs the launch worker (step 2).</p>
    </section>
  `;

  const nameInput = app.querySelector('#lx-name');
  let currentBranch = '';

  app.querySelector('#lx-create').addEventListener('click', async () => {
    const name = nameInput.value;
    if (!slug(name)) { toast('Enter a branch name first.', 'warn'); return; }
    try {
      toast('Creating branch…');
      const bp = await createBranch(name);
      currentBranch = name;
      showLinks(name, bp);
      app.querySelector('#lx-activate').classList.remove('lx-hidden');
      toast('Branch created ✓', 'success');
    } catch (e) { console.error(e); toast(`Branch failed: ${e.message}`, 'error'); }
  });

  function showLinks(name, bp) {
    const wrap = app.querySelector('#lx-links');
    wrap.classList.remove('lx-hidden');
    wrap.querySelector('.lx-links').innerHTML = `
      <a class="lx-link" href="${canvasUrl(bp)}" target="_blank" rel="noopener">✏️ Edit branch</a>
      <a class="lx-link" href="${canvasUrl(ctx.path)}" target="_blank" rel="noopener">✏️ Edit original</a>
      <a class="lx-link" id="lx-diff" href="#">🔀 View Diff</a>
      <div id="lx-diff-panel" class="lx-diff lx-hidden"></div>
    `;

    app.querySelector('#lx-diff').addEventListener('click', async (e) => {
      e.preventDefault();
      const panel = app.querySelector('#lx-diff-panel');
      if (!panel.classList.contains('lx-hidden')) { panel.classList.add('lx-hidden'); return; }
      panel.classList.remove('lx-hidden');
      panel.innerHTML = '<p class="lx-note">Loading diff…</p>';
      try {
        const [orig, branch] = await Promise.all([readSource(ctx.path), readSource(bp)]);
        panel.innerHTML = `
          <div class="lx-diff-cols">
            <div><h3>Original</h3><pre>${esc(orig)}</pre></div>
            <div><h3>Branch</h3><pre>${esc(branch)}</pre></div>
          </div>
          <p class="lx-note">Raw source, side by side. Highlighted block-level diff coming soon.</p>`;
      } catch (err) {
        panel.innerHTML = `<p class="lx-note">Diff preview unavailable (${err.message}). Highlighted diff coming soon.</p>`;
      }
    });
  }

  app.querySelector('#lx-schedule').addEventListener('click', async () => {
    if (!currentBranch) { toast('Create a branch first.', 'warn'); return; }
    const start = app.querySelector('#lx-start').value;
    const end = app.querySelector('#lx-end').value;
    if (!start && !end) { toast('Pick a go-live and/or auto-revert time.', 'warn'); return; }
    try {
      const rows = await scheduleWindow(currentBranch, start, end);
      const cron = app.querySelector('#lx-cron');
      cron.textContent = `.helix/crontab rows written:\n${rows.map((r) => `${r.when}  |  ${r.command}`).join('\n')}`;
      cron.classList.remove('lx-hidden');
      toast('Schedule written to .helix/crontab ✓', 'success');
    } catch (e) { console.error(e); toast(`Schedule failed: ${e.message}`, 'error'); }
  });

  app.querySelector('#lx-golive').addEventListener('click', async () => {
    if (!currentBranch) { toast('Create a branch first.', 'warn'); return; }
    try {
      toast('Swapping branch onto original…');
      await goLiveNow(currentBranch);
      toast('Original now holds branch content — preview/publish to go live ✓', 'success');
    } catch (e) { console.error(e); toast(`Go-live failed: ${e.message}`, 'error'); }
  });

  app.querySelector('#lx-revert').addEventListener('click', async () => {
    if (!currentBranch) { toast('Create a branch first.', 'warn'); return; }
    try {
      await revert(currentBranch);
      toast('Reverted original to pre-launch content ✓', 'success');
    } catch (e) { console.error(e); toast(`Revert failed: ${e.message}`, 'error'); }
  });
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
    if (!ctx.org || !ctx.repo) throw new Error('No DA context');
    render();
  } catch (e) {
    console.error(e);
    document.getElementById('launch-app').innerHTML = '<div class="loading">Open Launch from inside the DA editor (sign in to Document Authoring), then refresh.</div>';
  }
}());

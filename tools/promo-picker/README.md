# Structured Content Picker — Build Guide

A walkthrough of how we built a **right-rail plugin for Document Authoring (Experience Workspace)** that lets authors **search, filter, preview, insert, and edit** schema-driven structured content — plus how to **set up Structured Content in a site from scratch** if it isn't already configured.

Built and validated on the `blofft1/wknd-advanced` EDS/DA site.

---

## 1. The mental model — four layers

Structured content in DA/EDS has four distinct layers. Keep them separate in your head:

| Layer | What it is | Where it lives |
|---|---|---|
| **Schema** | Defines a content *type* (typed fields + validation), as JSON Schema 2020-12 | A document in DA at `.da/forms/schemas/<name>.html` |
| **Content** | The *data* — one document per entry, authored in a generated form | A DA document (e.g. `/promos/fjords-of-norway`), delivered as JSON |
| **Block** | The *presentation* — turns the JSON into styled HTML on a page | `blocks/<name>/` in the project repo (Git) |
| **Picker plugin** | The *authoring UX* — find/insert/edit content in the right rail | `tools/<name>/index.html` in the project repo (Git) |

> Key idea: **authors control the data (the form); developers control the presentation (block/plugin, in code).** They meet by name.

---

## 2. Configure Structured Content in a site (if it doesn't already exist)

> On `wknd-advanced` this was already set up — these are the steps to replicate it elsewhere.

### Prerequisites
- An **Edge Delivery Services** project with **Document Authoring** enabled.
- The **Configuration Service** enabled for the site.
- **Organization Administrator** role (needed to edit the `editor.path` config).

### Step 2a — Create a schema
Schemas are stored as **documents** in a hidden folder: `.da/forms/schemas/`. Each schema is a JSON Schema (a documented subset of **JSON Schema 2020-12**) placed inside a code block. Example (`promo-card`):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Promo Card",
  "type": "object",
  "properties": {
    "image":       { "type": "string", "title": "Image URL", "format": "uri" },
    "imageAlt":    { "type": "string", "title": "Image Alt Text" },
    "title":       { "type": "string", "title": "Card Title" },
    "linkUrl":     { "type": "string", "title": "Link URL", "format": "uri" },
    "description": { "type": "string", "title": "Description" }
  },
  "required": ["title", "description"]
}
```
Supported field types: `string`, `number`, `integer`, `boolean`, `array`, `object`. Validation: `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `enum` (dropdowns). Reuse shapes with `$defs` + `$ref`. Every schema file in `.da/forms/schemas/` becomes a selectable option in the form editor's schema dropdown.

### Step 2b — Map a folder to the form editor
In the site's **DA config**, add an `editor.path` entry so documents in a folder open in the **form editor** instead of the normal document editor:

```
editor.path: /<ORG>/<SITE>/<FOLDER>=https://da.live/form#
```
Example: `editor.path: /blofft1/wknd-advanced/promos=https://da.live/form#`
(Add multiple entries for multiple folders.)

### Step 2c — Author content
1. Browse to the configured folder: `https://da.live/#/<org>/<site>/<folder>`
2. Click **New** → pick a schema → fill the generated form (auto-saves).
3. **Preview / Publish** the document — this is required for it to be served (see gotchas).

### Step 2d — Delivery (how you read the JSON)
Published structured content is delivered as JSON:
```
https://da-sc.adobeaem.workers.dev/<live|preview>/<org>/<site>/<path>
```
Response shape:
```json
{ "metadata": { "schemaName": "promo-card", "title": "..." }, "data": { ...fields } }
```

---

## 3. The rendering block (`blocks/promo-card/`)

A block that consumes the structured-content JSON and renders it as cards, styled to match the site's `cards` block, with `compact` and `banner` variants.

- **Authoring:** an author inserts a `Promo Card` block (a table named `promo-card`); each row references a structured-content doc by link/path. Variant via the block name, e.g. `Promo Card (banner)`.
- **Code:** `decorate(block)` reads the referenced paths, fetches each doc's JSON from the `da-sc` endpoint, and builds the DOM. It derives `org`/`site`/`env` from the hostname (`main--<site>--<org>.aem.page|live`), normalizes fields across schemas, and handles external image URLs (plain `<img>`) vs. site media (`createOptimizedPicture`).

See `blocks/promo-card/promo-card.js` + `promo-card.css`.

---

## 4. The picker plugin (`tools/promo-picker/`)

A self-contained HTML app that runs in the DA right-rail Library and drives the authoring workflow.

### 4a — The DA_SDK
Everything hinges on the DA SDK:
```js
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
const sdk = await DA_SDK; // { org, repo, path, token, actions, ... }  (context is spread at top level)
const { org, repo, actions } = sdk;
```
`actions` provides: `daFetch` (authenticated fetch), `sendText`, `sendHTML`, `setTitle`, `setHref`, `setHash`, `closeLibrary`, `getSelection`, `setPrompt`, `showPanel`.

Load it defensively so the app also runs standalone (for local preview) — race the import against a short timeout and fall back to sample data.

### 4b — Discover structured content anywhere on the site
1. **Recursively list** every document via `actions.daFetch('https://admin.da.live/list/<org>/<repo>/<path>')`, skipping asset/system folders (`media`, `icons`, `tools`, `.da`).
2. **Probe** each doc's `da-sc` JSON; keep only those with a `metadata.schemaName` (that's what makes it structured content).
3. Concurrency-limit the probes (~10 in flight).

> For a large production site, replace the crawl with a **query-index** (`helix-query.yaml`) that lists structured content in one cached JSON.

### 4c — Insert a block
Build a block table and send it into the document:
```js
actions.sendHTML('<table><tr><td>promo-card</td></tr><tr><td><a href="/promos/x">/promos/x</a></td></tr></table>');
```

### 4d — Edit → open the form
Open the schema form for a doc **in a new tab** so the author never loses their place:
```js
const win = window.open(`https://da.live/form#/${org}/${repo}${path}`, '_blank');
if (win) win.opener = null;         // opened OK — sever opener for safety
else /* copy link + toast; never navigate the main window */;
```

### 4e — Host & register
- **Host:** it's in `tools/promo-picker/` → `git push` deploys it via **AEM Code Sync** to
  `https://main--<site>--<owner>.aem.page/tools/promo-picker/index.html`.
- **Register:** add it to the site's **DA Library config** as `{ title, url }`. Mirror an existing plugin (e.g. the built-in **Fragment Picker**). It then appears in the right-rail Library.

---

## 5. Gotchas & lessons learned (read this first if something breaks)

| Symptom | Cause & fix |
|---|---|
| Panel shows the site's **404 page** | Registered URL points at the **folder**. EDS doesn't auto-serve a directory index — register the explicit `.../index.html`. |
| New content **doesn't appear** in the picker | Structured-content docs must be **previewed/published** — the `da-sc` endpoint only serves previewed content (returns 404 otherwise). Bulk-preview the folder. |
| **Edit clobbers the current page** / rail disappears | `window.open(url, '_blank', 'noopener')` returns `null` **even on success**, so a "blocked?" fallback fires. Don't pass `noopener` in the features arg; sever `win.opener` manually. **Never** use `setHref` to "open" — it replaces the main window. |
| SDK context is **undefined** | The SDK spreads context at the **top level** (`sdk.org`, `sdk.repo`, `sdk.token`) — there is no `sdk.context`. |
| Auth errors calling DA APIs from the plugin | Use `actions.daFetch` (carries the IMS token) for `admin.da.live` calls. The `da-sc` delivery endpoint is public (no auth) once content is previewed. |
| Schemas "aren't in Git" | Correct — schemas live as **documents in DA** (`.da/forms/schemas/`), not in the code repo. |

---

## 6. File map (this project)

| Path | Purpose |
|---|---|
| `.da/forms/schemas/promo-card.html` | The `promo-card` schema (in DA, not Git) |
| `blocks/promo-card/promo-card.{js,css}` | Renders structured content as cards (+ `compact`/`banner` variants) |
| `tools/promo-picker/index.html` | The right-rail picker plugin (search / filter / refresh / preview / Edit / Insert) |
| `tools/promo-picker/README.md` | This guide |

---

*Built on Adobe Document Authoring (`da.live`) + Edge Delivery Services. SDK: `https://da.live/nx/utils/sdk.js`. Delivery: `https://da-sc.adobeaem.workers.dev/`.*

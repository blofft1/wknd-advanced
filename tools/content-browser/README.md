# Content Browser — a real Document Authoring (DA) app

This is the prototype's Browse view rebuilt as an actual DA app. It runs inside DA using
the **DA SDK** (authenticated) and the **DA Admin List API** to browse the real content of
an org/repo. Opened standalone (e.g. our GitHub Pages preview) it shows sample data with a
"preview mode" banner.

Files:
- `content-browser.html` — entry point (loads the CSS + JS module into a root div)
- `content-browser.js` — DA SDK bootstrap + List API + rendering
- `content-browser.css` — layout on top of the shared `styles.css`

## How it works

1. On load it imports the SDK: `import DA_SDK from 'https://da.live/nx/utils/sdk.js'`.
   - `sdk.context` → the signed-in org, repo, and token.
   - `sdk.actions.daFetch` → an authenticated fetch used for all API calls.
2. It calls the **List API** — `https://admin.da.live/list/{org}/{repo}[/folder]` —
   paginating via the `da-continuation-token` response header, and classifies each item
   (Page / Fragment / Config / Locale / Asset / Folder) the way the prototype does.
3. Clicking a folder browses into it; clicking a document opens it in the DA canvas editor
   (`https://da.live/canvas#/{org}/{repo}/{path}`).
4. If no DA session is present, it falls back to sample data so the file still previews.

## Deploy it to a real site

1. Copy this `da-app/` folder (plus `styles.css`) into your Edge Delivery **code** repo
   for the site (the repo connected to DA via AEM Code Sync) and push.
2. Open the site config sheet: `https://da.live/config#/{org}/{repo}/`.
3. Add an **`apps`** sheet with columns `title`, `description`, `image`, `path`, and a row:

   | Column | Value |
   |---|---|
   | `title` | `Content Browser` |
   | `description` | `Redesigned content browser` |
   | `image` | *(a published thumbnail URL)* |
   | `path` | `https://da.live/app/{org}/{repo}/da-app/content-browser?org={org}&repo={repo}` |

4. Save, then visit `https://da.live/apps#/{org}/{repo}` — it appears as a card and launches
   inside DA against live content.

## Next steps toward parity with the prototype

- **Title / Status columns:** the List API returns paths, not titles/status. Add a
  self-generating inventory sheet (like Adobe's `better-da` tool stores `.da/better-da.json`)
  to derive and cache richer metadata, editable inline via the Source API.
- **Metadata editing / multi-select actions:** use the Source API
  (`https://admin.da.live/source/{org}/{repo}/{path}`) for read/write.

Reference: <https://docs.da.live/developers> · List API: <https://docs.da.live/developers/api/list>

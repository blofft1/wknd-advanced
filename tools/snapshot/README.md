# Snapshot — assemble, review & audit (DA editor extension)

A DA editor **Library extension** (right-rail panel) for multi-page **snapshots** —
coordinated, reviewable content releases. Three tabs mirror the whiteboard:

- **Create** — a wizard to build a snapshot: browse the whole site (real, DA **List API**), **multi-select + filter**, name it, add a description, and toggle **Lock pages during review**. The current page is pre-selected (snapshots are multi-page by default).
- **Review** — the snapshot's pages with their **`.aem.reviews`** review URLs, plus **Approve & Publish**, **Reject & Unlock**, and **Request Review (lock)** actions, and placeholders for **Notifications / Bulk diff / Mark-up**.
- **Audit** — all snapshots (session list) with **search by name**; click one to open it in Review.

## What's real vs mocked
- **Real:** page browsing/multi-select/filter (`{DA_ORIGIN}/list/{org}/{repo}`), snapshot assembly, `.aem.reviews` URL construction (`{name}--main--{repo}--{org}.aem.reviews`), lock/status state.
- **Mocked (clearly labeled):** the actual create/lock/request-review/approve/publish calls. Those hit the **`admin.hlx.page` `/snapshot` API**, whose **hlx admin token** the `DA_SDK` token doesn't grant — the same auth boundary as publishing.

## Step 2 — wire the real /snapshot API
Route the admin actions through the **AEM Sidekick review plugin** (`https://tools.aem.live/tools/snapshot-admin/popover.html`) or a small **worker** that holds the hlx admin token, then replace the mocked handlers in `snapshot.js` (`#sn-approve`, `#sn-reject`, `#sn-lock-toggle`, and create) with real `/snapshot` calls. See <https://www.aem.live/docs/snapshots-reviews>.

## Register it (one row in the `library` config sheet)
Deploys via code sync on push. To show it in the editor, add a row to the **`library`**
sheet at `da.live/config#/blofft1/wknd-advanced`, mirroring your `tags`/`launch` rows,
with `path` = `/tools/snapshot/snapshot.html`, title **Snapshot**. Then: open a page in
the DA editor → **Library → Snapshot**.

## Notes
- Must run inside the DA editor (needs `DA_SDK` context); standalone shows a sign-in hint.
- DA tool files cache ~2 hrs — hard-refresh to pick up updates.

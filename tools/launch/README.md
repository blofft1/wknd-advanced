# Launch — branch & schedule a page (DA editor extension)

A DA editor **Library extension** (right-rail panel) that lets an author work on an
isolated **branch** of the current page while other authors keep editing the original,
compare the two, and set an **Activate date range** for go-live.

## What it does
1. **Create Branch** — copies the current page to `/launches/<name>/<original-path>` (real copy via the DA Source API) and stashes a pre-launch backup at `/launches/<name>/_original/<original-path>` for revert.
2. **Compare** — quick links to *Edit branch*, *Preview branch*, *Edit original*, *Preview original (older version)* so you can demo updating the two pages side by side.
3. **Activate date range**
   - **Schedule Launch** — writes rows to the site's `.helix/crontab` sheet: `publish` the branch at go-live, `unpublish` at auto-revert.
   - **Go Live Now (swap onto original)** — copies branch content onto the original path immediately (backup kept), for the live demo money-shot.
   - **Revert to original** — restores the pre-launch backup onto the original path.

## Branch path convention
`/launches/{branch-name}/{original-path}` — e.g. branching `/en/budgeting-basics` into
launch `summer-sale` → `/launches/summer-sale/en/budgeting-basics`. Clean, groupable,
easy to list/audit later (ties into the Snapshot "audit" idea).

## Register it (one row in the `library` config sheet)
This tool's **code** deploys via code sync on push. To make it appear in the editor,
add a row to your site's **`library`** sheet at `da.live/config#/blofft1/wknd-advanced`
— mirror your existing `tags` / `fragments` plugin rows, pointing at:

| title | path | ref | format | experience |
|---|---|---|---|---|
| Launch | `/tools/launch/launch.html` | (blank) | (match tags/fragments) | (match tags/fragments) |

> The `library` sheet lives in DA's **config service** (not the content bus), so it must
> be edited in the DA config UI. Copy the exact column values from your working `tags` row.

Then in the DA editor: open a page → **Library** → **Launch**.

## The one limitation (and step 2: the worker)
The EDS scheduler (`.helix/crontab`) can only **publish/unpublish a path** — it cannot
copy. So the fully *scheduled* "swap the **original** URL to branch content at go-live,
then auto-revert" is not possible with cron alone. Two honest modes:
- **Works today (cron):** the branch is published at its own `/launches/...` URL for the window.
- **Needs a worker (step 2):** a small Cloudflare worker (this repo already deploys workers) that, at the scheduled moment, copies branch→original + publishes, and at end restores the backup + publishes. `Go Live Now` already does this swap manually today.

## Notes
- `when` values are generated as best-effort [`later`](https://www.aem.live/docs/scheduling) text expressions — verify/tweak the exact one-shot syntax in the crontab sheet.
- Publishing itself (preview/live) still happens via the sidekick or the scheduler; this tool writes content + schedule rows, not the publish auth.
- Must be opened from **inside the DA editor** (needs `DA_SDK` context); opened standalone it shows a sign-in hint.

# Preflight Demo Script (WKND, Experience Workspace)

Sources: adobe/da-live PR #1369 (merged Oct 20, v1.10.0), PR #1370 (OPEN, not merged when read), Slack #tmp-experience-workspace-workshop-sept-22-24.
Not yet verified live: everything below is built from the PR text, not from a run.

## Pre-flight checklist (do before the demo)
1. A Brand exists in Experience Context (experience.adobe.com -> AEM -> Experience Context) in an IMS org you can access.
2. The WKND domain is added to the brand: `https://main--wknd-advanced--blofft1.preview.da.live` (auto-adds .aem.page, .aem.live, .ue.da.live).
3. Brand status = ACTIVE. AI checks status = ACTIVE (text + image) for scenes 3-4, DRAFT for scene 2.
4. WKND code is deployed to the branch you demo from. `scripts/preflight.js` is already wired in `scripts/scripts.js:411` (defined, never invoked).
5. Prepare two pages: a "clean" page (passes) and a "dirty" page (no meta description, an image without alt, a legacy finance term such as "portfolio"). Preview both.
6. Run the AI evaluation once beforehand. A fully loaded page took ~3m 47s.
7. Be signed in to the same IMS org in EW and Coworker standalone.

Demo pages and check-to-page map: see PREFLIGHT-DEMO-CONTENT.md. The site code checks now total 7 (3 original + destination metadata, heading hierarchy, CTA wording, hero image alt).

## Scenes

### 1. Out-of-box checks, no brand (30s)
- Set brand to DRAFT (or use a site with no brand). Open the dirty page in Canvas view, open the Preflight panel.
- Show: links, fragments, H1 count, lorem ipsum, SEO title, SEO description. Results run but are not saved. Panel shows a "Create a brand" prompt.
- Message: basic hygiene is free, ungated by SKU or onboarding.

### 2. Site code checks (2 min) - the WKND differentiator
- Brand ACTIVE, AI checks DRAFT. Re-run on the dirty page.
- Show the three WKND checks: meta description, image alt text, on-brand copy (no legacy finance terms). Each has YES/NO/NA, reasoning and a fix suggestion.
- Open `scripts/preflight.js`: `window.aem.preflight` is an async function returning `SiteCodeCheckResult[]`. Show it is a few lines of plain DOM code.
- Fix the page (add alt, remove "portfolio"), re-run, show it flip to pass.
- Talking points: whole function has a 5s timeout; a timeout or throw becomes a synthetic NO ("Site Code Checks Timeout/Failure"); no warning state by design (pass/fail/NA only); takes ~10s today.

### 3. AI checks (2 min + wait)
- AI checks ACTIVE. Show the brand's text and image check config screens first, then run on the page.
- Evaluation can take minutes. Use the pre-run result or narrate over the wait.
- Message: brand guidelines become enforceable checks, with caps on checks per brand and images per page.

### 4. Same results everywhere (1 min)
- EW Chat: `/aem-governance-evaluate-page-viz`
- Coworker standalone: `/aem-governance-evaluate-page-viz https://main--wknd-advanced--blofft1.preview.da.live/<path>`
- Message: one engine (Experience Context API + MCP), consistent in the panel, chat, Coworker and 3rd-party agents. This ties to the ABV play loop: insight -> edit -> preflight -> publish.

### 5. Publish enforcement (OPTIONAL - confirm first)
- Depends on PR #1370 (browse-view preflight + enforce at publish). It was OPEN when read. Amol Anand (Sept 15) said PRs were in place and Ben Peter (Oct 21) reported request-publish from preflight was blocked.
- Only include if you have verified it works in your environment; otherwise show the PR #1369 enforce video and call it "in review".

## Gaps to state honestly
- Canvas view only; the original da.live editor keeps the old preflight.
- No warning severity; Governance Insight dashboard, citation highlighting and "send to chat" are listed as upcoming.
- ASO Preflight alignment was raised by Martin Buergi (Oct 14) and not resolved in the threads I read.
- Brand requires an IMS org; bbirds/WKND demo brand feasibility is unconfirmed.
- The PR demo uses the Sites Internal org and Andrei Stefan Tuicu's da-test site as the reference.

## Suggested WKND additions (not done)
- Add an explicit NA case (image-alt returns NA only when a page has no images).
- Add a travel-specific check, e.g. every destination page has a price/season metadata field.

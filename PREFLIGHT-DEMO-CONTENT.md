# Preflight Demo Pages: content to author in DA / Experience Workspace

Two pages, same topic. "Fail" trips every check; "Pass" is the fixed version.
Create both under `/destinations/` so the destination metadata check applies.

- `/destinations/preflight-fail` (Preflight Fail)
- `/destinations/preflight-pass` (Preflight Pass)

Brand source: WKND Brand Guidelines v1.0 (July 2026), "The Field Guide".

---

## PAGE 1: /destinations/preflight-fail

### Metadata table
Leave **empty**: no Title, no Description, no `price`, no `season`.
(Fails: SEO title, SEO description, meta description, destination metadata.)

### Hero block
- Image: an off-brand image, such as a staged stock photo of an office or a laptop. **Leave alt text empty.**
  (Fails: image alt, hero image alt, AI image check.)
- Heading (H1): `Moab Canyon Adventure`

### Section 1
H1 (a second one):
`WELCOME TO OUR DESTINATION PORTFOLIO`
(Fails: H1 count, on-brand copy; "portfolio" is a legacy finance term.)

Paragraph:
> Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

(Fails: lorem ipsum.)

### Section 2 (skipped heading level)
H2: `Why Go`

H4: `Trail Overview`
(Fails: heading hierarchy, H2 straight to H4.)

Paragraph (violates claim guardrails and voice):
> Perfect year-round: conditions guaranteed. Anyone can do it, no experience needed. Just show up and go. Blaze your own trail wherever you like, and don't miss out: lowest price ever, book now before it's gone!

(Fails AI text checks. Maps to guideline "Don't say" list:
guaranteed conditions, no experience needed, just show up and go, off-trail, false scarcity.)

Paragraph (dry corporate tone):
> Our offering leverages best-in-class synergies to deliver value-added traveler outcomes within a scalable itinerary framework.

(Fails AI tone check: not adventurous, first-hand, or "you"-led.)

### Section 3 (broken links)
- Link: `Read our packing guide` pointing to `/destinations/this-page-does-not-exist`
- Fragment link: `https://main--wknd-advanced--blofft1.aem.page/fragments/does-not-exist`
(Fails: links, fragments.)

### Buttons
- `Click here`
- `Learn more`
(Fails: CTA wording.)

---

## PAGE 2: /destinations/preflight-pass

### Metadata table
| Metadata | Value |
|---|---|
| Title | Moab Canyon Adventure: Weekend Guide |
| Description | A first-hand weekend guide to Moab: difficulty, gear, and the best season to go. |
| price | From $180 per person (prices vary by season; confirm at booking) |
| season | Spring and fall |

### Hero block
- Image: real golden-hour outdoor photo with people mid-adventure. Alt: `Two hikers cross red rock at golden hour in Moab`
- H1: `Find Your Next Trail in Moab`

### Section 1
H2: `Why Go`

> Red rock at sunrise, empty canyon trails, and a weekend that feels like a week. Moab is best in spring and fall, when the trail is typically clear.

### Section 2
H2: `The Route`
H3: `Trail Overview`

> Intermediate: some scrambling; bring sturdy boots. Start early, carry plenty of water, and check current conditions and permits before you go. Pack out what you pack in. Leave no trace.

### Section 3
- Working link: `Read our packing guide` pointing to a page that exists
- Buttons: `Book your trip`, `Explore the trail`

---

## Check-to-page map (use as the on-stage narrator)

| Check | Type | Fail page trigger | Pass page fix |
|---|---|---|---|
| Links / Fragments | OOTB | Two dead links | Working link |
| H1 count | OOTB | Two H1s | One H1 |
| Lorem ipsum | OOTB | Placeholder paragraph | Real copy |
| SEO title / description | OOTB | No metadata | Title and description |
| Meta description | Site code | No description | Present |
| Image alt | Site code | Empty alt | Descriptive alt |
| On-brand copy (no finance terms) | Site code | "Portfolio" | Travel language |
| Destination metadata | Site code | No price/season | Both present |
| Heading hierarchy | Site code | H2 to H4 | H2 to H3 |
| CTA wording | Site code | "Click here" | "Book your trip" |
| Hero image alt | Site code (NA on pages without hero) | Missing alt | Alt text |
| Claim guardrails, voice | AI text | Guarantees, false scarcity, corporate-speak | Typical/can language, active voice |
| Imagery | AI image | Staged office stock | Real outdoor photo |

## Notes
- NA demo: open any page without a hero (such as the homepage) and the hero check shows NA, and the destination check shows NA on non-destination pages.
- The AI rows assume the guideline PDF has been ingested into the WKND brand and text/image AI checks are ACTIVE. I haven't confirmed which specific AI checks exist in Experience Context.
- Run the AI evaluation on both pages before the demo (~4 min).

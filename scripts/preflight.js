/*
 * Site Code Checks for the AEM Experience Context / Experience Workspace preflight panel.
 *
 * Defines `window.aem.preflight()` — a function (no args) returning an array of
 * SiteCodeCheckResult. The Experience Context crawler detects this function at render
 * time and executes it during a preflight evaluation (triggered from the preflight side
 * panel, on publish, or via the EW/Coworker chat). Do NOT invoke window.aem.preflight()
 * here — only define it; the crawler calls it. Requires a Brand linked to the site.
 *
 * Reference: adobe/da-live PR #1369.
 */

export const Alignment = Object.freeze({
  YES: 'YES',
  NO: 'NO',
  NA: 'NA',
});

export class SiteCodeCheckResult {
  /**
   * @param {object} r
   * @param {string} r.id Stable check identifier.
   * @param {string} r.title Human-readable check title.
   * @param {'YES'|'NO'|'NA'} r.alignment Check outcome.
   * @param {string} r.reasoning Explanation of the outcome.
   * @param {string} [r.suggestions] How to fix a failing check.
   */
  constructor({
    id, title, alignment, reasoning, suggestions,
  }) {
    this.id = id;
    this.title = title;
    this.alignment = alignment;
    this.reasoning = reasoning;
    if (suggestions !== undefined) this.suggestions = suggestions;
  }
}

/* --- individual deterministic checks (read the rendered DOM at call time) --- */

function checkMetaDescription() {
  const desc = document.querySelector('meta[name="description"]')?.content?.trim();
  return new SiteCodeCheckResult({
    id: 'meta-description',
    title: 'Page has a meta description',
    alignment: desc ? Alignment.YES : Alignment.NO,
    reasoning: desc
      ? `Meta description present (${desc.length} characters).`
      : 'No meta description found — weakens SEO and link/social previews.',
    suggestions: desc ? undefined : 'Add a "description" row to the page Metadata table.',
  });
}

function checkImageAlt() {
  const imgs = [...document.querySelectorAll('main img')];
  const missing = imgs.filter((img) => !img.getAttribute('alt')?.trim());
  if (imgs.length === 0) {
    return new SiteCodeCheckResult({
      id: 'image-alt',
      title: 'All content images have alt text',
      alignment: Alignment.NA,
      reasoning: 'No images found in the main content.',
    });
  }
  return new SiteCodeCheckResult({
    id: 'image-alt',
    title: 'All content images have alt text',
    alignment: missing.length === 0 ? Alignment.YES : Alignment.NO,
    reasoning: `${imgs.length - missing.length}/${imgs.length} content images have alt text.`,
    suggestions: missing.length
      ? 'Add descriptive alt text to every content image (use empty alt="" only for decorative images).'
      : undefined,
  });
}

// Legacy finance vocabulary that must not survive the WKND reskin.
const LEGACY_TERMS = [
  'tfsa', 'rrsp', 'fhsa', 'resp', 'fire number', 'net worth', 'savings rate',
  'retire early', 'compound interest', 'etf', 'etfs', 'dividend', 'portfolio', 'investing',
];

function checkOnBrandCopy() {
  const text = (document.querySelector('main')?.innerText || '').toLowerCase();
  const found = LEGACY_TERMS.filter((t) => new RegExp(`\\b${t}\\b`).test(text));
  return new SiteCodeCheckResult({
    id: 'wknd-no-legacy-finance-terms',
    title: 'On-brand copy (no legacy finance terms)',
    alignment: found.length ? Alignment.NO : Alignment.YES,
    reasoning: found.length
      ? `Found legacy finance wording: ${found.join(', ')}.`
      : 'No legacy finance terminology detected — copy reads on-brand for WKND.',
    suggestions: found.length
      ? 'Replace finance terms with WKND travel language (see the reskin terminology map).'
      : undefined,
  });
}

/* --- demo checks: business rule, accessibility, brand voice, applicability --- */

const metaContent = (name) => document.querySelector(`meta[name="${name}"]`)?.content?.trim();

// A destination page is under /destinations/ or declares template: destination.
function isDestinationPage() {
  return window.location.pathname.includes('/destinations/')
    || metaContent('template') === 'destination';
}

// Business rule: destination pages must carry price and season metadata.
function checkDestinationMetadata() {
  const id = 'wknd-destination-metadata';
  const title = 'Destination pages have price and season metadata';
  if (!isDestinationPage()) {
    return new SiteCodeCheckResult({
      id,
      title,
      alignment: Alignment.NA,
      reasoning: 'Not a destination page (no /destinations/ path or destination template).',
    });
  }
  const missing = ['price', 'season'].filter((name) => !metaContent(name));
  return new SiteCodeCheckResult({
    id,
    title,
    alignment: missing.length ? Alignment.NO : Alignment.YES,
    reasoning: missing.length
      ? `Missing metadata: ${missing.join(', ')}.`
      : 'Price and season metadata are present.',
    suggestions: missing.length
      ? `Add ${missing.map((m) => `"${m}"`).join(' and ')} row(s) to the page Metadata table.`
      : undefined,
  });
}

// Accessibility: headings must not skip levels (e.g. H2 straight to H4).
function checkHeadingHierarchy() {
  const levels = [...document.querySelectorAll('main h1, main h2, main h3, main h4, main h5, main h6')]
    .map((h) => Number(h.tagName[1]));
  const skips = [];
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i] - levels[i - 1] > 1) skips.push(`H${levels[i - 1]} to H${levels[i]}`);
  }
  return new SiteCodeCheckResult({
    id: 'wknd-heading-hierarchy',
    title: 'Heading levels do not skip',
    alignment: skips.length ? Alignment.NO : Alignment.YES,
    reasoning: skips.length
      ? `Heading levels skip: ${skips.join(', ')}.`
      : `${levels.length} heading(s) follow a valid hierarchy.`,
    suggestions: skips.length
      ? 'Use consecutive heading levels so screen reader users can follow the page outline.'
      : undefined,
  });
}

// Brand voice: calls to action must be action-oriented, not generic.
const GENERIC_CTAS = ['click here', 'learn more', 'read more', 'here', 'submit'];

function checkCtaWording() {
  const generic = [...document.querySelectorAll('main a.button, main .button-container a')]
    .map((a) => a.textContent.trim().toLowerCase())
    .filter((text) => GENERIC_CTAS.includes(text));
  return new SiteCodeCheckResult({
    id: 'wknd-cta-wording',
    title: 'Calls to action use on-brand wording',
    alignment: generic.length ? Alignment.NO : Alignment.YES,
    reasoning: generic.length
      ? `Generic button text found: ${[...new Set(generic)].map((t) => `"${t}"`).join(', ')}.`
      : 'All buttons use descriptive, action-oriented wording.',
    suggestions: generic.length
      ? 'Use action wording such as "Book your trip" or "Explore the trail".'
      : undefined,
  });
}

// Applicability: only checks a hero image when the page has one (otherwise NA).
function checkHeroImageAlt() {
  const id = 'wknd-hero-image-alt';
  const title = 'Hero image has alt text';
  const hero = document.querySelector('main .hero img');
  if (!hero) {
    return new SiteCodeCheckResult({
      id,
      title,
      alignment: Alignment.NA,
      reasoning: 'This page has no hero image.',
    });
  }
  const ok = !!hero.getAttribute('alt')?.trim();
  return new SiteCodeCheckResult({
    id,
    title,
    alignment: ok ? Alignment.YES : Alignment.NO,
    reasoning: ok ? 'Hero image has alt text.' : 'Hero image has no alt text.',
    suggestions: ok ? undefined : 'Describe the hero image for screen reader users.',
  });
}

/* --- register (define, do not invoke) --- */

export default function registerPreflightChecks() {
  window.aem = window.aem || {};
  window.aem.preflight = async () => [
    checkMetaDescription(),
    checkImageAlt(),
    checkOnBrandCopy(),
    checkDestinationMetadata(),
    checkHeadingHierarchy(),
    checkCtaWording(),
    checkHeroImageAlt(),
  ];
}

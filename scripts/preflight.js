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

/* --- register (define, do not invoke) --- */

export default function registerPreflightChecks() {
  window.aem = window.aem || {};
  window.aem.preflight = async () => [
    checkMetaDescription(),
    checkImageAlt(),
    checkOnBrandCopy(),
  ];
}

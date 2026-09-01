import { createOptimizedPicture } from '../../scripts/aem.js';
import { createTag } from '../../scripts/shared.js';

/**
 * Promo Card block — renders DA Structured Content (Promo Card / Highline Offer
 * schemas) as cards, styled to match the site's `cards` block.
 *
 * Authoring: each row references a structured-content document — either a link
 * (e.g. /offers/summer-highline-promo) or the plain path. One card per row.
 * Variants (add to the block name in the doc): `compact`, `banner`.
 */

// Derive the DA structured-content delivery base from the current host.
//   main--<site>--<org>.aem.(page|live) → org/site + env; localhost → defaults.
function scBase() {
  const { hostname } = window.location;
  let org = 'blofft1';
  let site = 'wknd-advanced';
  let env = 'preview';
  const m = hostname.match(/^main--(.+)--([^-.]+)\.aem\.(page|live)$/);
  if (m) {
    [, site, org] = m;
    env = m[3] === 'live' ? 'live' : 'preview';
  }
  return `https://da-sc.adobeaem.workers.dev/${env}/${org}/${site}`;
}

// Read the authored rows → a list of site-relative structured-content paths.
function authoredPaths(block) {
  return [...block.children]
    .map((row) => {
      const a = row.querySelector('a[href]');
      const raw = (a ? a.getAttribute('href') : row.textContent || '').trim();
      if (!raw) return '';
      try {
        return new URL(raw, window.location.origin).pathname.replace(/\.html$/, '');
      } catch {
        return raw.replace(/\.html$/, '');
      }
    })
    .filter(Boolean);
}

// Normalize across the Promo Card and Highline Offer schemas.
function normalize(data = {}, path = '') {
  return {
    title: data.title || data.offerName || '',
    description: data.description || data.summary || '',
    image: data.image || '',
    imageAlt: data.imageAlt || '',
    href: data.linkUrl || data.ctaUrl || path || '#',
    cta: data.ctaLabel || '',
    price: data.price,
  };
}

function buildCard(d) {
  const li = createTag('li');
  const link = createTag('a', { href: d.href, class: 'promo-card-link' });

  if (d.image) {
    const imageDiv = createTag('div', { class: 'promo-card-image' });
    imageDiv.append(createOptimizedPicture(d.image, d.imageAlt || d.title, false, [{ width: '750' }]));
    link.append(imageDiv);
  }

  const body = createTag('div', { class: 'promo-card-body' });
  if (d.title) body.append(createTag('h3', {}, d.title));
  if (d.price != null && d.price !== '') {
    body.append(createTag('p', { class: 'promo-card-price' }, `$${Number(d.price).toLocaleString()}`));
  }
  if (d.description) body.append(createTag('p', { class: 'promo-card-desc' }, d.description));
  if (d.cta) body.append(createTag('span', { class: 'promo-card-cta' }, d.cta));
  link.append(body);
  li.append(link);
  return li;
}

export default async function decorate(block) {
  const base = scBase();
  const paths = authoredPaths(block);
  block.textContent = '';

  if (!paths.length) {
    block.append(createTag('p', { class: 'promo-card-empty' }, 'No promo content referenced.'));
    return;
  }

  const results = await Promise.all(
    paths.map(async (p) => {
      const url = `${base}${p.startsWith('/') ? p : `/${p}`}`;
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const json = await res.json();
        return normalize(json.data, p);
      } catch {
        return null;
      }
    }),
  );

  const cards = results.filter(Boolean);
  if (!cards.length) {
    block.append(createTag('p', { class: 'promo-card-empty' }, "Couldn't load promo content."));
    return;
  }

  const ul = createTag('ul');
  cards.forEach((d) => ul.append(buildCard(d)));
  block.append(ul);
}

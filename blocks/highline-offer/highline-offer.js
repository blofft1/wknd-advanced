import { createTag } from '../../scripts/shared.js';

/**
 * Highline Offer block — renders a DA structured-content "Highline Offer"
 * document as an offer page: image, category, name, price, summary, CTA and terms.
 * Authored rows are `<h3>key</h3> | value` pairs produced by the DA form.
 * @param {Element} block The highline-offer block element
 */

function readFields(block) {
  const fields = {};
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    const key = keyCell?.textContent.trim();
    if (key && valueCell) fields[key] = valueCell;
  });
  return fields;
}

const text = (cell) => cell?.textContent.trim() || '';

function toUrl(raw) {
  if (!raw) return '';
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('/') || raw.startsWith('#')) return raw;
  return `https://${raw}`;
}

function formatPrice(raw) {
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!raw || Number.isNaN(n)) return '';
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function buildMedia(fields) {
  const img = fields.image?.querySelector('img');
  const src = img?.getAttribute('src') || toUrl(text(fields.image));
  if (!src) return null;
  const alt = text(fields.imageAlt) || text(fields.offerName);
  const media = createTag('div', { class: 'highline-offer-media' });
  media.append(createTag('img', { src, alt, loading: 'eager' }));
  return media;
}

function buildTerms(block, fields) {
  // The disclaimer value is a `self://#disclaimer-xxxx` pointer to a sibling block.
  const ref = text(fields.disclaimer).split('#')[1];
  const terms = ref && block.closest('main')?.querySelector(`.${CSS.escape(ref)}`);
  if (!terms) return null;
  const wrapper = terms.closest('.disclaimer-wrapper');
  terms.classList.add('highline-offer-terms');
  if (wrapper && wrapper !== terms) wrapper.remove();
  return terms;
}

export default function decorate(block) {
  const fields = readFields(block);
  const name = text(fields.offerName);
  const price = formatPrice(text(fields.price));
  const category = text(fields.category);
  const summary = text(fields.summary);
  const ctaLabel = text(fields.ctaLabel);
  const ctaUrl = toUrl(text(fields.ctaUrl));

  const media = buildMedia(fields);
  const body = createTag('div', { class: 'highline-offer-body' });
  if (category) body.append(createTag('p', { class: 'highline-offer-category' }, category));
  if (name) body.append(createTag('h1', {}, name));
  if (price) body.append(createTag('p', { class: 'highline-offer-price' }, price));
  if (summary) body.append(createTag('p', { class: 'highline-offer-summary' }, summary));
  if (ctaLabel && ctaUrl) {
    const cta = createTag('p', { class: 'button-container' });
    cta.append(createTag('a', { href: ctaUrl, class: 'button primary' }, ctaLabel));
    body.append(cta);
  }

  const terms = buildTerms(block, fields);
  if (terms) body.append(terms);

  block.textContent = '';
  if (media) block.append(media);
  else block.classList.add('no-image');
  block.append(body);
}

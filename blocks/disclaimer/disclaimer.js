import { createTag } from '../../scripts/shared.js';

/**
 * Disclaimer block — fine print from a DA structured-content "Disclaimer".
 * Rows are `<h3>key</h3> | value`; `details` is the terms text and `reference`
 * a link to the full terms. Collapsed by default so it stays out of the way.
 * @param {Element} block The disclaimer block element
 */
export default function decorate(block) {
  const fields = {};
  [...block.children].forEach((row) => {
    const [keyCell, valueCell] = row.children;
    const key = keyCell?.textContent.trim();
    if (key && valueCell) fields[key] = valueCell.textContent.trim();
  });

  block.textContent = '';
  if (!fields.details && !fields.reference) {
    block.remove();
    return;
  }

  const details = createTag('details');
  details.append(createTag('summary', {}, 'Terms & conditions'));
  if (fields.details) details.append(createTag('p', {}, fields.details));
  if (fields.reference) {
    const href = /^(https?:)?\/\//i.test(fields.reference) ? fields.reference : `https://${fields.reference}`;
    const p = createTag('p');
    p.append(createTag('a', { href, rel: 'noopener' }, 'Read the full terms'));
    details.append(p);
  }
  block.append(details);
}

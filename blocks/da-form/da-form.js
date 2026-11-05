/**
 * DA structured-content documents start with a `da-form` block that only holds
 * form bookkeeping (title, x-schema-name). It is not meant for visitors.
 * @param {Element} block The da-form block element
 */
export default function decorate(block) {
  (block.closest('.da-form-wrapper') || block).remove();
}

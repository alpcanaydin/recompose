function rendered(element: Element | null | undefined): Element {
  if (element === null || element === undefined) {
    throw new Error('the story rendered nothing to measure');
  }

  return element;
}

/**
 * The style the browser actually painted on an element a story looked up.
 *
 * @summary Reach for it in a play function that checks a value the design fixes. It fails loudly
 * when the lookup found nothing, so a silent null never reads as a passing measurement.
 */
export function paintedStyle(element: Element | null | undefined): CSSStyleDeclaration {
  return getComputedStyle(rendered(element));
}

/**
 * The box the browser actually laid out for an element a story looked up.
 *
 * @summary Reach for it when the design fixes a width or a height rather than a declaration.
 */
export function paintedBox(element: Element | null | undefined): DOMRect {
  return rendered(element).getBoundingClientRect();
}

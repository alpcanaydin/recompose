const CONTROL = 'data-panel-control';

/**
 * Whether a pointer landed on a panel or on something that speaks for whether it stands.
 *
 * @summary A panel carries `data-panel-control`, and so does every control that opens or closes it,
 * the border that sizes it, and anything that chooses what it speaks for. A pointer landing on one of
 * those is not a press away from the panel: it stops the control that opens the panel from closing it
 * in the same gesture, stops a drag on its border from reading as a person looking elsewhere, and
 * stops choosing a second subject from being read as wanting no panel at all.
 */
export function pressedAPanelControl(path: readonly EventTarget[]): boolean {
  return path.some((step) => step instanceof Element && step.hasAttribute(CONTROL));
}

/**
 * Moves focus and makes the move visible, which the browser will not do on its own.
 *
 * @summary Reach for it whenever the app decides where focus goes, so a sighted keyboard reader can see where it landed.
 */
export function placeFocus(control: HTMLElement | null | undefined): void {
  if (!control) {
    return;
  }

  control.setAttribute('data-placed-focus', '');
  control.addEventListener(
    'blur',
    () => {
      control.removeAttribute('data-placed-focus');
    },
    { once: true },
  );
  control.focus();
}

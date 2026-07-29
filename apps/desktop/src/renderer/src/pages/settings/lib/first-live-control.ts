const CONTROL = ':is(button, input, select, textarea, [tabindex])';
const KEYBOARD_REACHABLE = ':not([tabindex="-1"], [aria-hidden="true"])';
const OPERABLE = ':not(:disabled, [aria-disabled="true"], [aria-disabled="true"] *)';

export function firstLiveControl(surface: HTMLElement | null): HTMLElement | null {
  return surface?.querySelector<HTMLElement>(`${CONTROL}${KEYBOARD_REACHABLE}${OPERABLE}`) ?? null;
}

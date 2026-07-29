import { useEffect, useRef } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { placeFocus } from './place-focus';

function FocusedOnMount() {
  const safeChoice = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    placeFocus(safeChoice.current);
  }, []);

  return (
    <button ref={safeChoice} type="button">
      Cancel
    </button>
  );
}

test('a control the app focuses shows where focus landed, until it leaves', async () => {
  const screen = await render(<FocusedOnMount />);
  const cancel = screen.getByRole('button', { name: 'Cancel' });

  await expect.element(cancel).toHaveFocus();
  await expect.element(cancel).toHaveAttribute('data-placed-focus');

  cancel.element().dispatchEvent(new FocusEvent('blur'));

  await expect.element(cancel).not.toHaveAttribute('data-placed-focus');
});

test('nothing to focus is not a crash', () => {
  expect(() => {
    placeFocus(null);
  }).not.toThrow();
});

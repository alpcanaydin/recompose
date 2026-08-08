import { beforeEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { inspectorOpen, toggleInspector } from '../../lib/inspector-visibility';
import { InspectorToggle } from './inspector-toggle';

beforeEach(() => {
  if (!inspectorOpen()) {
    toggleInspector();
  }
});

async function renderToggle(available = true) {
  return render(<InspectorToggle available={available} where="standing" />);
}

const theToggle = { name: 'Inspector' };

test('the control reads open while the inspector stands', async () => {
  const screen = await renderToggle();

  await expect
    .element(screen.getByRole('button', theToggle))
    .toHaveAttribute('aria-expanded', 'true');
});

test('pressing it puts the inspector away, and pressing it again brings it back', async () => {
  const screen = await renderToggle();

  await userEvent.click(screen.getByRole('button', theToggle));

  await expect
    .element(screen.getByRole('button', theToggle))
    .toHaveAttribute('aria-expanded', 'false');

  await userEvent.click(screen.getByRole('button', theToggle));

  await expect
    .element(screen.getByRole('button', theToggle))
    .toHaveAttribute('aria-expanded', 'true');
});

test('the control follows a change nothing on it made, so the two never disagree', async () => {
  const screen = await renderToggle();

  toggleInspector();

  await expect
    .element(screen.getByRole('button', theToggle))
    .toHaveAttribute('aria-expanded', 'false');
});

test('a surface carrying no inspector holds the control unmovable rather than dropping it', async () => {
  const screen = await renderToggle(false);

  await expect.element(screen.getByRole('button', theToggle)).toBeDisabled();
  await expect
    .element(screen.getByRole('button', theToggle))
    .toHaveAttribute('aria-expanded', 'false');
});

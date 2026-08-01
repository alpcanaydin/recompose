import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';

import { StatusChip } from './status-chip';

test('the standing reads as one word rather than as a word said twice', async () => {
  const screen = await render(<StatusChip tone="positive" word="Connected" />);

  await expect.element(page.getByText('Connected')).toBeVisible();
  expect(screen.container.textContent).toBe('Connected');
});

test('the mark beside the word adds nothing a screen reader has to hear', async () => {
  const screen = await render(<StatusChip tone="attention" word="Needs sign-in" />);

  await expect.element(page.getByText('Needs sign-in')).toBeVisible();
  expect(screen.container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
});

test('the two tones say their own word, so neither rests on color alone', async () => {
  await render(
    <>
      <StatusChip tone="positive" word="Connected" />
      <StatusChip tone="attention" word="Needs sign-in" />
    </>,
  );

  await expect.element(page.getByText('Connected')).toBeVisible();
  await expect.element(page.getByText('Needs sign-in')).toBeVisible();
});

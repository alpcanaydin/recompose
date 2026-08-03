import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { Icon } from './icon';

test('an icon adds nothing to the name of the control it sits in', async () => {
  const screen = await render(
    <button type="button">
      <Icon name="plus" />
      Create Gateway
    </button>,
  );

  await expect.element(screen.getByRole('button', { name: 'Create Gateway' })).toBeVisible();
});

test('an icon-only control keeps the name its caller gave it', async () => {
  const screen = await render(
    <button aria-label="Read the guide" type="button">
      <Icon name="book" />
    </button>,
  );

  await expect.element(screen.getByRole('button', { name: 'Read the guide' })).toBeVisible();
});

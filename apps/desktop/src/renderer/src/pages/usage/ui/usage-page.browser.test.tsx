import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { UsagePage } from './usage-page';

test('the usage screen names itself before it has anything to report', async () => {
  const screen = await render(<UsagePage />);

  await expect.element(screen.getByRole('heading', { level: 1, name: 'Usage' })).toBeVisible();
});

test('the usage screen reports the quiet rather than inventing a reading', async () => {
  const screen = await render(<UsagePage />);

  await expect
    .element(screen.getByRole('heading', { level: 2, name: 'No requests yet' }))
    .toBeVisible();
  await expect.element(screen.getByText(/rate, latency, tokens, and spend/u)).toBeVisible();
});

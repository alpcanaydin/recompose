import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { SubscriptionsEmptyState } from './subscriptions-empty-state';

test('a screen with nothing connected names what a subscription account is', async () => {
  const screen = await render(<SubscriptionsEmptyState />);

  await expect
    .element(screen.getByText(/A subscription account is/))
    .toHaveTextContent("the provider's own command-line tool");
});

test('the state itself offers no act, because the window strip already carries the one act', async () => {
  const screen = await render(<SubscriptionsEmptyState />);

  await expect.poll(() => screen.getByRole('button').elements()).toEqual([]);
});

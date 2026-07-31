import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { GetStartedCard } from './get-started-card';

const noop = () => {};

test('a fresh session reads none of its four steps as done', async () => {
  const screen = await render(
    <GetStartedCard gatewayExists={false} onSkip={noop} providerConnected={false} />,
  );

  await expect.element(screen.getByText('0 of 4')).toBeVisible();
});

test('the count follows what the app holds rather than a record of its own', async () => {
  const screen = await render(<GetStartedCard gatewayExists onSkip={noop} providerConnected />);

  await expect.element(screen.getByText('2 of 4')).toBeVisible();
});

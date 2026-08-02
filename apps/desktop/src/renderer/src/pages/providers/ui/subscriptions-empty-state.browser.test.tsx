import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { SubscriptionsEmptyState } from './subscriptions-empty-state';

function CatalogAsk() {
  const [asked, setAsked] = useState(false);

  return (
    <>
      <SubscriptionsEmptyState
        onAddProvider={() => {
          setAsked(true);
        }}
      />
      {asked ? <p>The catalog stands open.</p> : null}
    </>
  );
}

function nothing() {
  return undefined;
}

test('a screen with nothing connected names what a subscription account is', async () => {
  const screen = await render(<SubscriptionsEmptyState onAddProvider={nothing} />);

  await expect
    .element(screen.getByText(/A subscription account is/))
    .toHaveTextContent("the provider's own command-line tool");
});

test('a screen with nothing connected offers one act rather than a choice of acts', async () => {
  const screen = await render(<SubscriptionsEmptyState onAddProvider={nothing} />);

  await expect
    .poll(() =>
      screen
        .getByRole('button')
        .elements()
        .map((control) => control.textContent),
    )
    .toEqual(['Add provider']);
});

test('the one act asks for the catalog rather than connecting anything by itself', async () => {
  const screen = await render(<CatalogAsk />);

  await screen.getByRole('button', { name: 'Add provider' }).click();

  await expect.element(screen.getByText('The catalog stands open.')).toBeVisible();
});

import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { LocalRuntimesNote } from './local-runtimes-note';

function nothing() {
  return undefined;
}

function CatalogAsk() {
  const [asked, setAsked] = useState(false);

  return (
    <>
      <LocalRuntimesNote
        onAddProvider={() => {
          setAsked(true);
        }}
      />
      {asked ? <p>The catalog stands open.</p> : null}
    </>
  );
}

test('the fourth destination says what a local runtime is rather than standing blank', async () => {
  const screen = await render(<LocalRuntimesNote onAddProvider={nothing} />);

  await expect
    .element(screen.getByText(/A local runtime/))
    .toHaveTextContent('serves a model from this machine');
});

test('the fourth destination offers one act rather than a choice of acts', async () => {
  const screen = await render(<LocalRuntimesNote onAddProvider={nothing} />);

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

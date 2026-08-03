import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { LocalRuntimesNote } from './local-runtimes-note';

test('the fourth destination says what a local runtime is rather than standing blank', async () => {
  const screen = await render(<LocalRuntimesNote />);

  await expect
    .element(screen.getByText(/A local runtime/))
    .toHaveTextContent('serves a model from this machine');
});

test('the note itself offers no act, because the window strip already carries the one act', async () => {
  const screen = await render(<LocalRuntimesNote />);

  await expect.poll(() => screen.getByRole('button').elements()).toEqual([]);
});

import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';

import { EmptyState } from './empty-state';

const noop = () => {};

test('the invitation sends a reader to documentation that exists rather than to nothing', async () => {
  const screen = await render(<EmptyState onCreateGateway={noop} />);
  const guide = screen.getByRole('link', { name: 'Read the guide' });

  await expect.element(guide).toHaveAttribute('href', 'https://github.com/recomposesh/recompose');
  await expect.element(guide).toHaveAttribute('target', '_blank');
});

test('the invitation names the shortcut that opens the same sheet', async () => {
  const screen = await render(<EmptyState onCreateGateway={noop} />);

  await expect.element(screen.getByText('or press ⌘ N')).toBeVisible();
});

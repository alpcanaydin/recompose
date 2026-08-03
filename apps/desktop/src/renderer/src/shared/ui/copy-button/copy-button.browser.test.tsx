import { afterEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { CopyButton } from './copy-button';

const address = 'http://localhost:8397';

afterEach(() => {
  vi.restoreAllMocks();
});

test('a clipboard that refuses the write says so, rather than reading as a dead button', async () => {
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
    new Error('the document is not focused'),
  );

  const screen = await render(<CopyButton label="Copy address" value={address} />);

  await userEvent.click(screen.getByRole('button', { name: 'Copy address' }));

  await expect.element(screen.getByRole('status')).toHaveTextContent('Copying failed.');
});

test('the confirmation clears, so copying a second time announces itself again', async () => {
  const screen = await render(<CopyButton label="Copy address" value={address} />);
  const announcement = screen.getByRole('status');

  await userEvent.click(screen.getByRole('button', { name: 'Copy address' }));

  await expect.element(announcement).toHaveTextContent('Address copied.');
  await expect.element(announcement, { timeout: 4000 }).not.toHaveTextContent('Address copied.');
});

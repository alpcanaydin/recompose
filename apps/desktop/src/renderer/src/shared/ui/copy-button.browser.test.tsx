import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { CopyButton } from './copy-button';

const address = 'http://localhost:8397';

test('the confirmation clears, so copying a second time announces itself again', async () => {
  const screen = await render(<CopyButton label="Copy address" value={address} />);
  const announcement = screen.getByRole('status');

  await userEvent.click(screen.getByRole('button', { name: 'Copy address' }));

  await expect.element(announcement).toHaveTextContent('Address copied.');
  await expect.element(announcement, { timeout: 4000 }).not.toHaveTextContent('Address copied.');
});

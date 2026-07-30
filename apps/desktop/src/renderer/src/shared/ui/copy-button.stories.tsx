import { expect, waitFor } from 'storybook/test';

import preview from '#.storybook/preview';

import { CopyButton } from './index';

const address = 'http://localhost:8397';

const meta = preview.meta({
  component: CopyButton,
});

/** The affordance beside a value the person needs somewhere else. */
export const Basic = meta.story({
  args: { label: 'Copy address', value: address },
  play: async ({ canvas, userEvent }) => {
    const button = await canvas.findByRole('button', { name: 'Copy address' });
    const announcement = await canvas.findByRole('status');

    await expect(announcement.textContent).toBe('');

    await userEvent.click(button);

    await waitFor(async () => {
      await expect(announcement).toHaveTextContent('Address copied.');
    });
    await expect(await navigator.clipboard.readText()).toBe(address);
  },
});

import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { FailedStartLine } from './failed-start-line';

const meta = preview.meta({
  component: FailedStartLine,
  args: { port: 8397, onMoveToFreePort: () => {} },
});

/** The sentence a squatted port leaves, next to the only recovery this build ships. */
export const PortTaken = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'Another process holds port 8397.',
    );
  },
});

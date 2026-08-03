import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { ToolbarFooter } from './toolbar-footer';

const meta = preview.meta({
  component: ToolbarFooter,
  args: {
    attempt: 1,
    failure: undefined,
    onMoveToFreePort: () => undefined,
    refusal: undefined,
  },
});

/**
 * The line under the strip when the engine refused the last request.
 *
 * @summary A refusal means the engine never answered, so it takes the line rather than a
 * sentence about a port nobody reached.
 */
export const Refused = meta.story({
  args: { refusal: 'The engine did not answer.' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent('The engine did not answer.');
  },
});

/**
 * The line when the port was lost, which offers the move to a free one.
 *
 * @summary The failure names the port it lost and carries its remedy on the same line.
 */
export const LostPort = meta.story({
  args: { failure: { port: 51234 } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: /free port/i })).toBeVisible();
  },
});

/** The refused line in the dark scheme, where the danger ink has to stay readable. */
export const DarkScheme = meta.story({
  args: { refusal: 'The engine did not answer.' },
  globals: { theme: 'dark' },
});

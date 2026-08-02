import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { ToolbarStrip } from './toolbar-strip';

const meta = preview.meta({
  component: ToolbarStrip,
  args: {
    address: 'http://localhost:51234',
    name: 'Codex',
    onRun: () => undefined,
    port: 51234,
    running: false,
    status: 'stopped' as const,
  },
  decorators: [
    (Story) => (
      <div className="bg-surface-toolbar">
        <Story />
      </div>
    ),
  ],
});

/**
 * The strip of one stopped gateway, whose run control offers the start.
 *
 * @summary The reading asks for the toolbar landmark under the gateway's own name and for the
 * start act, because every control in the strip acts on that one gateway and no other.
 */
export const Stopped = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('toolbar', { name: 'Codex' })).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Start' })).toBeVisible();
  },
});

/** The same strip while the gateway serves, whose run control offers the stop instead. */
export const Running = meta.story({
  args: { running: true, status: 'running' as const },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Stop' })).toBeVisible();
  },
});

/** The same strip in the dark scheme, where every raised control has to keep its edge. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

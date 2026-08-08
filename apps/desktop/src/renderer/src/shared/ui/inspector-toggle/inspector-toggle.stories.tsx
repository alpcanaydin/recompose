import { expect, waitFor } from 'storybook/test';

import preview from '#.storybook/preview';

import { inspectorOpen, toggleInspector } from '../../lib/inspector-visibility';
import { InspectorToggle } from './inspector-toggle';

function standAs(open: boolean) {
  if (inspectorOpen() !== open) {
    toggleInspector();
  }
}

const meta = preview.meta({
  component: InspectorToggle,
  args: { available: true, where: 'standing' as const },
  decorators: [
    (Story) => (
      <div className="flex justify-center bg-surface-toolbar p-4">
        <Story />
      </div>
    ),
  ],
});

/**
 * The control while the inspector stands, which is the state a gateway lands in.
 *
 * @summary Open is the loud state, because the control's whole job is saying whether the panel
 * beside it is the reason the surface is narrower.
 */
export const Open = meta.story({
  play: async ({ canvas }) => {
    standAs(true);

    const toggle = await canvas.findByRole('button', { name: 'Inspector' });

    await waitFor(async () => {
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });
  },
});

/** The control once a person has put the inspector away, which hands the stage its full width. */
export const Closed = meta.story({
  play: async ({ canvas }) => {
    standAs(false);

    const toggle = await canvas.findByRole('button', { name: 'Inspector' });

    await waitFor(async () => {
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    standAs(true);
  },
});

/**
 * The control on a surface that carries no inspector at all.
 *
 * @summary It stays in the strip rather than disappearing, so the row keeps its shape as a person
 * moves between a gateway and a screen that has none, and it says plainly that it cannot be used.
 */
export const Unavailable = meta.story({
  args: { available: false },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Inspector' })).toBeDisabled();
  },
});

/** The control inside the toolbar's button group, where the gateway strip carries it. */
export const Grouped = meta.story({ args: { where: 'grouped' as const } });

/** The control in the dark scheme, where the open state has to read against the strip. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

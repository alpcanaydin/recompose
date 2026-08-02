import { expect } from 'storybook/test';

import { inChecklistPanel } from '#.storybook/checklist-panel';
import preview from '#.storybook/preview';

import { ChecklistHeader } from './checklist-header';

const meta = preview.meta({
  component: ChecklistHeader,
  args: { headingId: 'checklist-heading', collapsed: false },
  decorators: [inChecklistPanel],
});

/**
 * The heading of the checklist, doubling as the control that folds it.
 *
 * @summary The reading asks for the expanded state on the control, because a header that folds
 * something has to say which of the two states it would move to.
 */
export const Open = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: /Get started/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  },
});

/** The folded header, whose chevron turns to say the list can come back. */
export const Folded = meta.story({
  args: { collapsed: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: /Get started/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  },
});

/** The same header in the dark scheme. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

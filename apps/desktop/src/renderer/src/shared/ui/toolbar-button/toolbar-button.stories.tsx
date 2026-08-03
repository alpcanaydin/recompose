import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { ToolbarButton } from './toolbar-button';

const meta = preview.meta({
  component: ToolbarButton,
  args: { glyph: 'book' as const, label: 'Docs', where: 'standing' as const },
  decorators: [
    (Story) => (
      <div className="flex items-center gap-2 bg-surface-toolbar p-4">
        <Story />
      </div>
    ),
  ],
});

/**
 * One standing control of the strip.
 *
 * @summary The reading asks for the accessible name, because the glyph is decorative and the name
 * is all a screen reader gets of the control.
 */
export const Standing = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Docs' })).toBeVisible();
  },
});

/**
 * A control whose machinery has not landed, which names what it waits for in its tooltip.
 *
 * @summary A dead control that says nothing reads as broken, so the title carries the waiting.
 */
export const Waiting = meta.story({
  args: { waitsFor: 'the guide' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Docs' })).toHaveAttribute(
      'title',
      'Docs. Waits on the guide.',
    );
  },
});

/** The grouped size the panel toggles share inside their bordered group. */
export const Grouped = meta.story({
  args: { where: 'grouped' as const, glyph: 'panel-right' as const, label: 'Inspector' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Inspector' })).toBeVisible();
  },
});

/** The same control in the dark scheme, where the raised surface has to keep its edge. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

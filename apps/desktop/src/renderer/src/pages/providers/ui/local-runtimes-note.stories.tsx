import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { LocalRuntimesNote } from './local-runtimes-note';

const meta = preview.meta({
  component: LocalRuntimesNote,
  decorators: [
    (Story) => (
      <section className="mx-auto flex w-full max-w-column flex-col gap-5 p-6">
        <h1 className="text-title text-ink">Local Runtimes</h1>
        <Story />
      </section>
    ),
  ],
});

/**
 * The destination the sidebar's fourth row leads to, before anything can run on this machine.
 *
 * @summary The reading asks for the sentence and refuses any act inside the note, because the
 * catalog's one act lives in the window strip and the note only says what will stand here.
 */
export const Awaited = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/A local runtime/)).toBeVisible();
    await expect(canvas.queryByRole('button')).toBeNull();
  },
});

/** The same note in the dark scheme, where the dashed edge has to stay readable as an edge. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

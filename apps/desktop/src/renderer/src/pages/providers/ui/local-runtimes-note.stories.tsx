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
 * @summary The reading asks for the sentence and for the absence of any act, because an act here
 * would promise something the app cannot do yet, and a destination that promises nothing is the
 * honest half of showing the row at all.
 */
export const Awaited = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/A local runtime/)).toBeVisible();
    await expect(canvas.queryByRole('button')).toBeNull();
  },
});

/** The same note in the dark scheme, where the heading and the sentence carry the whole note. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

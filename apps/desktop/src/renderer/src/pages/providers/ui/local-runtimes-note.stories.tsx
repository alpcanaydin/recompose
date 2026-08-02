import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { LocalRuntimesNote } from './local-runtimes-note';

const meta = preview.meta({
  component: LocalRuntimesNote,
  args: { onAddProvider: () => undefined },
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
 * @summary The reading asks for the sentence and for the one act, because the destination has to
 * say what will stand here while still offering the same catalog every other kind adds through.
 */
export const Awaited = meta.story({
  play: async ({ canvas }) => {
    const acts = await canvas.findAllByRole('button');

    await expect(await canvas.findByText(/A local runtime/)).toBeVisible();
    await expect(acts.map((act) => act.textContent)).toEqual(['Add provider']);
  },
});

/** The same note in the dark scheme, where the dashed edge has to stay readable as an edge. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

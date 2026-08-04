import type { AccountsDocument, LocalAccount } from '@recompose/contracts';

import { expect, screen, userEvent } from 'storybook/test';

import preview from '#.storybook/preview';

import { LocalRuntimeRow } from './local-runtime-row';

const stored: LocalAccount = {
  id: 'l1',
  provider: 'ollama',
  kind: 'local',
  address: 'http://127.0.0.1:11434',
};

const heldRegistry: AccountsDocument = { schemaVersion: 4, accounts: [stored] };

const meta = preview.meta({
  component: LocalRuntimeRow,
  args: { account: stored },
  decorators: [
    (Story) => (
      <ul className="mx-auto w-full max-w-column py-4">
        <Story />
      </ul>
    ),
  ],
  parameters: { bridge: { accounts: heldRegistry } },
});

/**
 * A stored runtime whose server answered the look, reading Running as of this mount.
 *
 * @summary The reading asks for the address in the mono value style and the standing word,
 * because the row is a name, an address, and an observation, and nothing else.
 */
export const Running = meta.story({
  parameters: {
    bridge: {
      accounts: heldRegistry,
      reachability: { verdict: 'answers' as const, version: '0.5.1' },
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('http://127.0.0.1:11434')).toBeVisible();
    await expect(await canvas.findByText('Running')).toBeVisible();
  },
});

/**
 * A stored runtime whose server didn't answer, reading the quiet fact rather than an alarm.
 *
 * @summary A stopped loopback server is expected life, so the word rides the inert tone and the
 * stored address stands unchanged beneath the name.
 */
export const NotRunning = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Not running')).toBeVisible();
    await expect(await canvas.findByText('http://127.0.0.1:11434')).toBeVisible();
  },
});

/**
 * A stranger answering on the runtime's port, which must never read as the runtime running.
 *
 * @summary The one standing a person acts on differently, so it carries the attention tone.
 */
export const AnotherServer = meta.story({
  parameters: {
    bridge: {
      accounts: heldRegistry,
      reachability: { verdict: 'unrecognized' as const, status: 404 },
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Another server answered')).toBeVisible();
  },
});

/**
 * The overflow holding the row's two acts and nothing else.
 *
 * @summary Checking again and removing are not part of reading the row, so both live behind the
 * overflow, matching the key row's anatomy.
 */
export const Acts = meta.story({
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions for Ollama' }));

    const actions = await screen.findAllByRole('menuitem');

    await expect(actions.map((action) => action.textContent)).toEqual(['Check again', 'Remove']);
  },
});

/** The runtime row in the dark scheme, where the inert word has to hold against the card. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

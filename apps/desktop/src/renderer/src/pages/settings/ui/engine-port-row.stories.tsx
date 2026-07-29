import { defaultSettings } from '@recompose/contracts';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inFieldGroup, inSettingsColumn } from '#.storybook/settings-column';

import { EnginePortRow } from './engine-port-row';

const meta = preview.meta({
  component: EnginePortRow,
  decorators: [inFieldGroup('Server'), inSettingsColumn],
  parameters: { bridge: { settings: defaultSettings() } },
});

const acceptedRange = 'Accepts 1024 through 65535.';

type PortDraft = {
  canvas: { findByRole: (role: string, options: { name: string }) => Promise<HTMLElement> };
  userEvent: {
    clear: (target: HTMLElement) => Promise<void>;
    type: (target: HTMLElement, text: string) => Promise<void>;
  };
};

async function draftInPortField(
  { canvas, userEvent }: PortDraft,
  entry: string,
): Promise<HTMLElement> {
  const port = await canvas.findByRole('textbox', { name: 'Port' });

  await userEvent.clear(port);
  await userEvent.type(port, entry);

  return port;
}

/** The stored port at rest, with the accepted range stated where it cannot drift from the schema. */
export const Basic = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('textbox', { name: 'Port' })).toHaveValue('8397');
    await expect(await canvas.findByText(acceptedRange)).toBeInTheDocument();
  },
});

/**
 * The draft rule: what is typed reaches storage on Enter, and never per keystroke.
 *
 * @summary The merge gate for the port field, where a half-typed number must not be written.
 */
export const CommitsOnEnter = meta.story({
  play: async ({ canvas, userEvent }) => {
    const port = await draftInPortField({ canvas, userEvent }, '9000{Enter}');

    await expect(port).toHaveValue('9000');
  },
});

/** Escape abandons the draft and puts the stored port back in the field. */
export const EscapeReverts = meta.story({
  play: async ({ canvas, userEvent }) => {
    const port = await draftInPortField({ canvas, userEvent }, '9000{Escape}');

    await expect(port).toHaveValue('8397');
  },
});

/** A port outside the range never commits, and the field keeps stating what it accepts. */
export const OutOfRangeReverts = meta.story({
  play: async ({ canvas, userEvent }) => {
    const port = await draftInPortField({ canvas, userEvent }, '80{Enter}');

    await expect(port).toHaveValue('8397');
    await expect(await canvas.findByText(acceptedRange)).toBeInTheDocument();
  },
});

/** The same row under the dark scheme, where the field border has to stay visible. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
});

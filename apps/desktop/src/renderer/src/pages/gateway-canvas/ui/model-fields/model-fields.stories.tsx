import { createRef } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { ModelFields } from './model-fields';

const targets = [
  {
    heading: 'API Keys',
    options: [
      { id: 'k1', name: 'work', mark: 'anthropic' as const },
      { id: 'k2', name: 'personal', mark: 'openai' as const },
    ],
  },
  {
    heading: 'Local Runtimes',
    options: [{ id: 'l1', name: 'Ollama', mark: 'ollama' as const, detail: '127.0.0.1:11434' }],
  },
];

const meta = preview.meta({
  component: ModelFields,
  args: {
    nameField: createRef<HTMLInputElement>(),
    name: '',
    onNameChange: () => {},
    targets,
    onPickTarget: () => {},
    models: [],
    providerModel: '',
    onPickModel: () => {},
  },
  decorators: [
    (Story) => (
      <div className="mx-auto my-4 w-76 px-3.5">
        <Story />
      </div>
    ),
  ],
});

/**
 * The fields as the flow opens: nothing settled, and the model list waiting on a target.
 *
 * @summary The model field says what it waits on rather than standing empty, so a person learns
 * that a model belongs to an account rather than wondering whether the list failed.
 */
export const Empty = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('textbox', { name: 'Name' })).toHaveValue('');
    await expect(await canvas.findByText('Pick a target first.')).toBeVisible();
  },
});

/**
 * A settled draft, reading the id a client will ask for under the name.
 *
 * @summary The id is derived rather than typed, so it stands where a person can check it against
 * what they will paste into a client, and the hint says why one caller's picker may skip it.
 */
export const Settled = meta.story({
  args: {
    name: 'Fast Sonnet',
    target: 'k1',
    targetName: 'work',
    models: ['claude-haiku-4-5', 'claude-sonnet-5'],
    providerModel: 'claude-sonnet-5',
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('fast-sonnet')).toBeVisible();
    await expect(await canvas.findByText(/Claude Code/)).toBeVisible();
    await expect(await canvas.findByText("· from work's live list")).toBeVisible();
  },
});

/** A name deriving a prefixed id, which every caller's picker surfaces, so no hint stands. */
export const NoHintNeeded = meta.story({
  args: { name: 'Claude Fast', target: 'k1', targetName: 'work', models: ['claude-sonnet-5'] },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('claude-fast')).toBeVisible();
    await expect(canvas.queryByText(/Claude Code/)).toBeNull();
  },
});

/** A refused name, which says so under the field it refuses rather than under the whole flow. */
export const NameRefused = meta.story({
  args: { name: 'fast', nameRefusal: 'This gateway already serves a virtual model named "fast".' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      'already serves a virtual model',
    );
  },
});

/**
 * A target whose model list nothing could read, refusing where the models would have stood.
 *
 * @summary The refusal takes the place of the list rather than sitting under the flow, because the
 * one thing a person can act on is the account they just picked.
 */
export const ModelListRefused = meta.story({
  args: {
    name: 'Fast',
    target: 'l1',
    targetName: 'Ollama',
    modelRefusal: "recompose couldn't read this account's model list.",
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('alert')).toHaveTextContent("couldn't read");
  },
});

/** The fields in the dark scheme, where the refusal tint has to hold against the box. */
export const DarkScheme = meta.story({
  args: {
    name: 'Fast',
    target: 'l1',
    targetName: 'Ollama',
    modelRefusal: "recompose couldn't read this account's model list.",
  },
  globals: { theme: 'dark' },
});

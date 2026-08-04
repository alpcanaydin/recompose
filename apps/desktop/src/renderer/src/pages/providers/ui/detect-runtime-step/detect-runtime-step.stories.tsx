import type { RecomposeIpc } from '@recompose/contracts';

import { expect, userEvent } from 'storybook/test';

import preview from '#.storybook/preview';

import { DetectRuntimeStep } from './detect-runtime-step';

const meta = preview.meta({
  component: DetectRuntimeStep,
  args: { runtime: 'ollama' as const, onConnected: () => undefined },
});

const answersOnlyOnPort9000: RecomposeIpc['accounts:detect-runtime'] = async ({ port }) =>
  Promise.resolve({
    ok: true,
    value: port === 9000 ? { verdict: 'answers', version: '0.6.2' } : { verdict: 'unreachable' },
  });

/** The face a running server earns: the answer, its version, and Add as the one settle act. */
export const Answering = meta.story({
  parameters: { bridge: { reachability: { verdict: 'answers', version: '0.5.1' } } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Ollama is running at 127.0.0.1:11434.')).toBeVisible();
    await expect(await canvas.findByText('Version 0.5.1')).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Add Ollama' })).toBeVisible();
  },
});

/** The face silence earns: the remedy sentence, Check again leading, Add anyway beside it. */
export const Silent = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/isn't running at 127.0.0.1:11434/)).toBeVisible();

    const checkAgain = await canvas.findByRole('button', { name: 'Check again' });
    const addAnyway = await canvas.findByRole('button', { name: 'Add anyway' });

    await expect(getComputedStyle(checkAgain).backgroundColor).not.toBe(
      getComputedStyle(addAnyway).backgroundColor,
    );
  },
});

/** The face a squatting stranger earns, which never claims the runtime is running. */
export const AnotherServer = meta.story({
  parameters: { bridge: { reachability: { verdict: 'unrecognized', status: 404 } } },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('Another server answered at 127.0.0.1:11434.'),
    ).toBeVisible();
  },
});

/** The one knob: pointing the look at another port re-runs it there, and the sentence follows. */
export const MovedPort = meta.story({
  parameters: { bridge: { overrides: { 'accounts:detect-runtime': answersOnlyOnPort9000 } } },
  play: async ({ canvas }) => {
    const knob = await canvas.findByRole('textbox', { name: 'Port' });

    await expect(knob).toHaveValue('11434');
    await expect(await canvas.findByText(/isn't running at 127.0.0.1:11434/)).toBeVisible();

    await userEvent.clear(knob);
    await userEvent.type(knob, '9000');

    await expect(await canvas.findByText('Ollama is running at 127.0.0.1:9000.')).toBeVisible();
  },
});

/** The verdict fills the slot the look reserved, so the step's height never moves twice. */
export const SettlesWithoutMoving = meta.story({
  parameters: {
    bridge: {
      overrides: {
        'accounts:detect-runtime': async () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ ok: true, value: { verdict: 'answers', version: '0.5.1' } });
            }, 250);
          }),
      },
    },
  },
  play: async ({ canvas }) => {
    const slot = await canvas.findByRole('status');

    await expect(slot).toHaveTextContent('Checking');

    const whileLooking = slot.getBoundingClientRect().height;

    await canvas.findByText('Ollama is running at 127.0.0.1:11434.');

    await expect(slot.getBoundingClientRect().height).toBe(whileLooking);
  },
});

/** The silent face in the dark scheme, where the plain and primary acts still tell apart. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
});

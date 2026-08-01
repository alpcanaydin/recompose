import type { SubscriptionTool } from '@recompose/contracts';

import { expect } from 'storybook/test';

import preview from '#.storybook/preview';
import { inSettingsColumn } from '#.storybook/settings-column';

import type { CatalogEntry } from '../model/provider-catalog';

import { ProviderConnectFork } from './provider-connect-fork';

const claudeCode: SubscriptionTool = {
  provider: 'anthropic',
  toolName: 'Claude Code',
  present: true,
  signInCommand: 'claude',
  shellSetupLine: 'export CLAUDE_CONFIG_DIR="/tmp/anthropic/active"',
};

const anthropic: CatalogEntry = {
  id: 'anthropic',
  name: 'Anthropic',
  ways: ['subscription', 'api-key'],
};

const meta = preview.meta({
  component: ProviderConnectFork,
  args: { entry: anthropic, onConnected: () => undefined },
  parameters: { bridge: { tools: [claudeCode] } },
  decorators: [inSettingsColumn],
});

/**
 * Both ways of connecting Anthropic, each headed by what it yields rather than by its steps.
 *
 * @summary The two controls sit one card apart and read as alternatives, so each one names the
 * provider it acts on. A person who tabs between them hears two different sentences, which is the
 * whole point of showing the ways together instead of one after the other.
 */
export const BothWays = meta.story({
  play: async ({ canvas }) => {
    const names = (await canvas.findAllByRole('button')).map((control) =>
      control.textContent.trim(),
    );

    await expect(names).toEqual(['Sign in to Anthropic', 'Connect']);
    await expect(new Set(names).size).toBe(names.length);
  },
});

/**
 * The sign-in way with its tool missing, where the control is inert rather than merely quiet.
 *
 * @summary A control a person can still press would begin something the machine cannot finish,
 * so this one refuses the press outright and carries the reason as its own description. The
 * reading checks the property rather than the styling, because a dimmed live button looks the
 * same as this one.
 */
export const ToolMissing = meta.story({
  parameters: { bridge: { tools: [{ ...claudeCode, present: false }] } },
  play: async ({ canvas }) => {
    const control = await canvas.findByRole('button', { name: 'Sign in to Anthropic' });
    const reason = control.getAttribute('aria-describedby') ?? '';

    await expect(control).toBeDisabled();
    await expect(document.getElementById(reason)).toHaveTextContent("Claude Code isn't installed");
  },
});

/** The same fork in the dark scheme, where the attention ink lifts a step to hold its ground. */
export const DarkScheme = meta.story({
  globals: { theme: 'dark' },
  parameters: { bridge: { tools: [{ ...claudeCode, present: false }] } },
});

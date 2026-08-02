import type { SubscriptionTool } from '@recompose/contracts';

import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import { SignInWay } from './sign-in-way';

const claudeCode: SubscriptionTool = {
  provider: 'anthropic',
  toolName: 'Claude Code',
  present: true,
  signInCommand: 'claude login',
  shellSetupLine: 'export CLAUDE_CONFIG_DIR="/Users/dev/.recompose/anthropic"',
};

const meta = preview.meta({
  component: SignInWay,
  args: { name: 'Anthropic', provider: 'anthropic' as const, onConnected: () => undefined },
  decorators: [
    (Story) => (
      <div className="w-sheet p-4">
        <Story />
      </div>
    ),
  ],
});

/**
 * The subscription arm when the provider's tool is installed and ready to sign in.
 *
 * @summary The reading asks for the yield in the heading and for the live act, because the arm
 * has to say what connecting gives before it offers to connect.
 */
export const ToolPresent = meta.story({
  parameters: { bridge: { tools: [claudeCode] } },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'An account for Claude Code' }),
    ).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Sign in to Anthropic' })).toBeEnabled();
  },
});

/**
 * The same arm when the tool is missing, which names the gap instead of failing later.
 *
 * @summary The act stays on screen but cannot move, so a person reads what to install and where
 * the sign-in will stand once they have.
 */
export const ToolAbsent = meta.story({
  parameters: {
    bridge: {
      tools: [{ provider: 'anthropic' as const, toolName: 'Claude Code', present: false as const }],
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/isn't installed/)).toBeVisible();
    await expect(
      await canvas.findByRole('button', { name: 'Sign in to Anthropic' }),
    ).toBeDisabled();
  },
});

/** The same arm in the dark scheme, where the card lifts off the drawer behind it. */
export const DarkScheme = meta.story({
  parameters: { bridge: { tools: [claudeCode] } },
  globals: { theme: 'dark' },
});

import type { SubscriptionAccountView, SubscriptionTool } from '@recompose/contracts';

import { expect, screen, userEvent } from 'storybook/test';

import preview from '#.storybook/preview';

import { SubscriptionAccountRow } from './subscription-account-row';

const claudeCode: SubscriptionTool = {
  provider: 'anthropic',
  toolName: 'Claude Code',
  present: true,
  signInCommand: 'claude',
  shellSetupLine: 'export CLAUDE_CONFIG_DIR="/tmp/anthropic/active"',
};

const connected: SubscriptionAccountView = {
  id: 's1',
  provider: 'anthropic',
  label: 'Anthropic',
  signedInAs: 'dev@example.com',
  plan: 'Max',
  standing: 'connected',
  active: true,
};

const meta = preview.meta({
  component: SubscriptionAccountRow,
  args: { view: connected },
  parameters: { bridge: { tools: [claudeCode], subscriptions: [connected] } },
  decorators: [
    (Story) => (
      <ul className="mx-auto w-full max-w-column p-4">
        <Story />
      </ul>
    ),
  ],
});

/**
 * A connected account, reading leading to trailing as who it is, what it serves, and how it stands.
 *
 * @summary The standing is a word with a mark beside it rather than a color alone, so the reading
 * asks for the word. The serves line is the only place the row says where the quota goes, which is
 * what keeps a subscription from being mistaken for something a gateway could route to.
 */
export const Connected = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Connected')).toBeVisible();
    await expect(await canvas.findByText(/Serves Claude Code/)).toBeVisible();
  },
});

/**
 * A lapsed account, whose remedy stands on the row instead of hiding behind the overflow.
 *
 * @summary A lapse is the one standing a person has to act on, so the act sits where the standing
 * is read. The reading counts the names in the row, because the same act living in two places at
 * once would leave a person choosing between two controls that sound identical.
 */
export const Lapsed = meta.story({
  args: { view: { ...connected, standing: 'lapsed' } },
  play: async ({ canvas }) => {
    const names = (await canvas.findAllByRole('button')).map((control) =>
      (control.getAttribute('aria-label') ?? control.textContent).trim(),
    );

    await expect(names).toEqual(['Sign in again', 'Actions for Anthropic']);
    await expect(await canvas.findByText('Signed out')).toBeVisible();
  },
});

/**
 * The overflow open on an account a tool does not currently run as.
 *
 * @summary Choosing the account is the act that moves the pointer, so it appears only where it
 * would change something. The shell line is copied rather than shown, because a person pastes it
 * into a terminal and never reads it here.
 */
export const QuieterActions = meta.story({
  args: { view: { ...connected, active: false } },
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Actions for Anthropic' }));

    const actions = await screen.findAllByRole('menuitem');

    await expect(actions.map((action) => action.textContent)).toEqual([
      'Use this account',
      'Sign in again',
      'Copy shell setup',
      'Remove',
    ]);
  },
});

/** The same row in the dark scheme, where the card lifts off the screen behind it. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

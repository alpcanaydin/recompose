import { expect, waitFor } from 'storybook/test';

import preview from '#.storybook/preview';

import { noAccounts, paintedBox, paintedStyle } from '../../../../shared/testing';
import { emptyDefinition } from '../../lib/model-draft';
import { freshGateway, listedModels, storedAccounts } from '../../testing/gateway-canvas.testkit';
import { AddModelFlow } from './add-model-flow';

const meta = preview.meta({
  component: AddModelFlow,
  args: {
    gateway: freshGateway,
    opening: emptyDefinition(),
    onBack: () => {},
    onKeep: () => {},
  },
  parameters: { bridge: { accounts: storedAccounts, gateways: [freshGateway] } },
  decorators: [
    (Story) => (
      <div className="mx-auto flex h-125 w-76 flex-col bg-surface-toolbar">
        <Story />
      </div>
    ),
  ],
});

/**
 * The flow as it opens, with focus already in the name.
 *
 * @summary The three fields stand in the order a person settles them, and the act that stores waits
 * on the two picks, so nothing can be stored half said.
 */
export const Opening = meta.story({
  play: async ({ canvas }) => {
    const name = await canvas.findByRole('textbox', { name: 'Name' });

    await waitFor(async () => {
      await expect(name).toHaveFocus();
    });
    await expect(await canvas.findByRole('button', { name: 'Add virtual model' })).toBeDisabled();
  },
});

/**
 * The target list, holding every account that can serve, including subscriptions.
 *
 * @summary A subscription uses its provider-native transport, so it stands beside the other
 * account kinds a virtual model can target.
 */
export const TargetsOnOffer = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('API Keys')).toBeVisible();
    await expect(await canvas.findByText('Subscriptions')).toBeVisible();
    await expect(await canvas.findByText('Aggregators')).toBeVisible();
    await expect(await canvas.findByText('Local Runtimes')).toBeVisible();
  },
});

/**
 * A whole binding, previewed in the footer before anything is stored.
 *
 * @summary The preview reads in the direction a request travels, so a person checks the sentence
 * rather than three fields, and the act that stores only then becomes movable.
 */
export const Settled = meta.story({
  parameters: { bridge: { providerModels: listedModels } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByRole('textbox', { name: 'Name' }), 'Fast');
    await userEvent.click(await canvas.findByRole('button', { name: /work/ }));
    await userEvent.click(await canvas.findByRole('button', { name: 'claude-haiku-4-5' }));

    await expect(await canvas.findByText('serves as fast → work · claude-haiku-4-5')).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Add virtual model' })).toBeEnabled();
  },
});

/**
 * A target whose model list nothing could read, refusing inside the flow.
 *
 * @summary The refusal arrives while the draft still stands, so a person learns the account cannot
 * be read from before committing a binding that would only fail once traffic reached it.
 */
export const ModelListRefused = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /work/ }));

    await expect(await canvas.findByRole('alert')).toHaveTextContent("couldn't read");
  },
});

/**
 * The footer acts at the width the drawer actually has, where both have to hold one line.
 *
 * @summary "Add virtual model" is a long label in a narrow panel, so the reading measures the
 * button's height rather than trusting it: two lines here is the defect a person reported from the
 * real window. Cancel takes only the room its own word needs so the long label keeps the rest.
 */
export const FooterActsHoldOneLine = meta.story({
  play: async ({ canvas }) => {
    const store = await canvas.findByRole('button', { name: 'Add virtual model' });
    const cancel = await canvas.findByRole('button', { name: 'Cancel' });

    await expect(paintedBox(store).height).toBeLessThan(40);
    await expect(paintedBox(cancel).height).toBeLessThan(40);
    await expect(paintedStyle(store).whiteSpace).toBe('nowrap');
    await expect(paintedStyle(store).justifyContent).toBe('center');
    await expect(paintedStyle(cancel).justifyContent).toBe('center');
  },
});

/**
 * The stretched act, whose label has to sit in the middle of the room it was given.
 *
 * @summary A native button centres its own title, and the push button traded that away the moment
 * it became a flex box without saying where its content goes. Every button so far hugged its label,
 * so nothing showed it; this one is told to fill the footer, and its label went to the leading edge
 * with the slack behind it. The reading measures the label against the button rather than the
 * class, since the defect is invisible until a button is wider than what it holds.
 */
export const StretchedActCentresItsLabel = meta.story({
  play: async ({ canvas }) => {
    const store = await canvas.findByRole('button', { name: 'Add virtual model' });
    const label = document.createRange();

    label.selectNodeContents(store);

    const written = label.getBoundingClientRect();
    const button = paintedBox(store);

    await expect(
      Math.abs((written.left + written.right) / 2 - button.left - button.width / 2),
    ).toBeLessThan(1);
  },
});

const nothingOffered = {
  bridge: { accounts: noAccounts, gateways: [freshGateway] },
};

/**
 * The target with nothing behind it, which is what most people meet on their first gateway.
 *
 * @summary Nothing stored can serve until an account is connected, so a fresh install meets this
 * before it meets a target list. Left empty the picker reads as a flow that failed; here it names
 * what is missing and carries the one act that fixes it.
 */
export const NothingCanServe = meta.story({
  parameters: nothingOffered,
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No account can serve yet')).toBeVisible();
    await expect(await canvas.findByRole('link', { name: 'Open Providers' })).toBeVisible();
    await expect(canvas.queryByRole('searchbox', { name: 'Search accounts' })).toBeNull();
  },
});

/** The empty target in the dark scheme, where its box has to separate from the field around it. */
export const NothingCanServeDark = meta.story({
  parameters: nothingOffered,
  globals: { theme: 'dark' },
});

/** The flow in the dark scheme, where the footer preview has to separate from the acts below it. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

import { expect, waitFor } from 'storybook/test';

import preview from '#.storybook/preview';

import { freshGateway, listedModels, storedAccounts } from '../../testing/gateway-canvas.testkit';
import { AddModelFlow } from './add-model-flow';

const meta = preview.meta({
  component: AddModelFlow,
  args: { gateway: freshGateway, onBack: () => {} },
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

/** The flow in the dark scheme, where the footer preview has to separate from the acts below it. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

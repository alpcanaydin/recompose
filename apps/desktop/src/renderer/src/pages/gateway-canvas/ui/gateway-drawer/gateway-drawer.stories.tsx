import type { ComponentProps } from 'react';

import { useState } from 'react';
import { expect } from 'storybook/test';

import preview from '#.storybook/preview';

import type { SettledDefinition } from '../../lib/model-draft';

import { paintedBox } from '../../../../shared/testing';
import { draftKept, emptyDefinition } from '../../lib/model-draft';
import {
  accountsWithout,
  freshGateway,
  listedModels,
  runningGateway,
  servingGateway,
  storedAccounts,
} from '../../testing/gateway-canvas.testkit';
import { GatewayDrawer } from './gateway-drawer';

function DrawerHarness(standing: ComponentProps<typeof GatewayDrawer>) {
  const [drafting, setDrafting] = useState<SettledDefinition | undefined>(standing.drafting);

  return (
    <GatewayDrawer
      {...standing}
      drafting={drafting}
      onKeepDrafting={(values) => {
        setDrafting((held) => draftKept(held, values));
      }}
      onLeaveDrafting={() => {
        setDrafting(undefined);
      }}
      onStartDrafting={() => {
        setDrafting(emptyDefinition());
      }}
    />
  );
}

const meta = preview.meta({
  component: GatewayDrawer,
  render: (standing) => <DrawerHarness {...standing} />,
  args: {
    gateway: servingGateway,
    drafting: undefined,
    onStartDrafting: () => {},
    onLeaveDrafting: () => {},
    onKeepDrafting: () => {},
  },
  parameters: {
    bridge: {
      accounts: storedAccounts,
      gateways: [servingGateway],
      engineStates: runningGateway,
      providerModels: listedModels,
    },
  },
  decorators: [
    (Story) => (
      <div className="flex h-125 justify-end bg-surface-content">
        <Story />
      </div>
    ),
  ],
});

/**
 * The inspector as a person finds it: where the gateway answers, and what it serves.
 *
 * @summary Endpoint leads because a client needs the base URL before anything else matters, and
 * Serves follows because that is the part a person changes.
 */
export const Overview = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('http://localhost:8397')).toBeVisible();
    await expect(await canvas.findByText('Running')).toBeVisible();
    await expect(await canvas.findByText('· 2 virtual models')).toBeVisible();
  },
});

/**
 * A gateway serving nothing, which invites the first virtual model.
 *
 * @summary The empty state says what a virtual model is for, because the idea is the thing a person
 * is missing at this point rather than the control.
 */
export const ServingNothing = meta.story({
  args: { gateway: freshGateway },
  parameters: { bridge: { gateways: [freshGateway] } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Nothing serves yet')).toBeVisible();
    await expect(
      await canvas.findByText('Add a virtual model to map a name onto a stored account.'),
    ).toBeVisible();
  },
});

/**
 * The Serves header at the width the drawer actually has, which has to hold one line.
 *
 * @summary The tally can grow, so the reading measures the header's height rather than trusting it:
 * two lines here is the defect a person reported from the real window.
 */
export const ServesHeaderHoldsOneLine = meta.story({
  play: async ({ canvas }) => {
    const header = await canvas.findByRole('heading', { name: /Serves/ });

    await expect(paintedBox(header).height).toBeLessThan(24);
    await expect(await canvas.findByText('· 2 virtual models')).toBeVisible();
  },
});

/** The same header with nothing served, where the tally stands aside rather than wrapping. */
export const ServesHeaderWhenEmpty = meta.story({
  args: { gateway: freshGateway },
  parameters: { bridge: { gateways: [freshGateway] } },
  play: async ({ canvas }) => {
    const header = await canvas.findByRole('heading', { name: /Serves/ });

    await expect(paintedBox(header).height).toBeLessThan(24);
    await expect(canvas.queryByText('· no virtual models yet')).toBeNull();
  },
});

/** A gateway nobody started, where the endpoint box speaks for the engine rather than guessing. */
export const NotRunning = meta.story({
  parameters: { bridge: { engineStates: { 'my-gateway': { status: 'stopped' as const } } } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Stopped')).toBeVisible();
  },
});

/**
 * A target that left the registry, read beside a model that still serves.
 *
 * @summary Both rows stay, because a gateway with one broken binding is still serving the others
 * and a person needs to see which is which.
 */
export const OneTargetRemoved = meta.story({
  parameters: {
    bridge: {
      accounts: accountsWithout('g1'),
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('target removed')).toBeVisible();
    await expect(await canvas.findByText('serving')).toBeVisible();
  },
});

/** Asking for a virtual model takes the drawer over, rather than opening a sheet on top of it. */
export const DefiningAModel = meta.story({
  args: { gateway: freshGateway },
  parameters: { bridge: { gateways: [freshGateway] } },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Add virtual model' }));

    await expect(await canvas.findByRole('textbox', { name: 'Name' })).toBeVisible();
  },
});

/** The drawer in the dark scheme, where the boxes have to separate from the panel behind them. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

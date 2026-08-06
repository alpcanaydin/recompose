import { expect, waitFor } from 'storybook/test';

import preview from '#.storybook/preview';
import { withShellSurface } from '#.storybook/shell-surface';

import { inspectorOpen, toggleInspector } from '../../../../shared/lib';
import {
  freshGateway,
  runningGateway,
  servingGateway,
  storedAccounts,
} from '../../testing/gateway-canvas.testkit';
import { GatewayCanvasPage } from './gateway-canvas-page';

function openTheInspector() {
  if (!inspectorOpen()) {
    toggleInspector();
  }
}

const meta = preview.meta({
  component: GatewayCanvasPage,
  args: { slug: 'my-gateway' },
  beforeEach: () => {
    openTheInspector();

    return openTheInspector;
  },
  decorators: [withShellSurface],
  parameters: {
    bridge: {
      accounts: storedAccounts,
      gateways: [servingGateway],
      engineStates: runningGateway,
    },
  },
});

/**
 * The gateway surface: the stage it will be composed on, beside the inspector that changes it.
 *
 * @summary The split is the shape the screen keeps once the canvas grows nodes, so the drawer is
 * where a person works today and stays where it is tomorrow.
 */
export const Serving = meta.story({
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: /My Gateway/ })).toBeVisible();
    await expect(await canvas.findByText('· 2 virtual models')).toBeVisible();
    await expect(await canvas.findByText('fast → work · claude-haiku-4-5')).toBeVisible();
  },
});

/** Asking for a virtual model takes the drawer over and leaves the stage standing. */
export const DefiningAModel = meta.story({
  parameters: {
    bridge: { accounts: storedAccounts, gateways: [freshGateway], engineStates: runningGateway },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Add virtual model' }));

    await expect(await canvas.findByRole('textbox', { name: 'Name' })).toBeVisible();
    await expect(await canvas.findByRole('button', { name: /My Gateway/ })).toBeVisible();
  },
});

/**
 * The node let go of, which hands the stage the whole window.
 *
 * @summary The inspector is something a person opens, so the screen has to read as finished without
 * it rather than as a panel that failed to load.
 */
export const InspectorClosed = meta.story({
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /My Gateway/ }));

    await waitFor(async () => {
      await expect(canvas.queryByText('Endpoint')).toBeNull();
    });
    await expect(await canvas.findByRole('button', { name: /My Gateway/ })).toBeVisible();
  },
});

/** The whole surface in the dark scheme, where the drawer has to separate from the stage. */
export const DarkScheme = meta.story({ globals: { theme: 'dark' } });

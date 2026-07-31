import { expect } from '@playwright/test';

import { Given, Then, When } from '../fixtures';
import { healthNameAt } from '../gateway-client';
import {
  gatewayAddress,
  gatewayRowReading,
  pressToolbarControl,
  storedGateway,
} from '../gateway-screen';
import { focusedGateway, focusGateway, rememberTakenPort, takenPort } from '../scenario-memory';

Given('a start that failed while another process held its port', async ({ page, portSquatter }) => {
  const name = focusedGateway(page);
  const { port } = await storedGateway(page, name);

  await portSquatter.take(port);
  rememberTakenPort(page, port);
  await pressToolbarControl(page, name, 'Start');

  await expect(page.getByRole('alert')).toHaveText(`Another process holds port ${String(port)}.`);
});

When('the maintainer stops {string} from the toolbar', async ({ page }, name: string) => {
  focusGateway(page, name);
  await pressToolbarControl(page, name, 'Stop');
});

When(
  'the port frees and the maintainer starts {string} again',
  async ({ page, portSquatter }, name: string) => {
    await portSquatter.release(takenPort(page));
    await pressToolbarControl(page, name, 'Start');
  },
);

Then('{string} answers at its own address', async ({ page }, name: string) => {
  await expect.poll(async () => healthNameAt(await gatewayAddress(page, name))).toBe(name);
});

Then('{string} keeps serving', async ({ page }, name: string) => {
  expect(await healthNameAt(await gatewayAddress(page, name))).toBe(name);
});

Then('{string} stays stopped', async ({ page }, name: string) => {
  await expect(gatewayRowReading(page, name, 'Stopped')).toBeVisible();
  expect(await healthNameAt(await gatewayAddress(page, name))).toBeNull();
});

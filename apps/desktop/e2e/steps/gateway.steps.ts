import { expect } from '@playwright/test';

import { Given, Then, When } from '../fixtures';
import { healthNameAt } from '../gateway-client';
import {
  createThroughSheet,
  gatewayAddress,
  gatewayRowReading,
  haltGateway,
  openCreationSheet,
  openGateway,
  pressToolbarControl,
  seedGateway,
  storedGateway,
} from '../gateway-screen';
import { focusedGateway, focusGateway, rememberTakenPort, takenPort } from '../scenario-memory';

Given('a gateway named {string} exists', async ({ page }, name: string) => {
  await seedGateway(page, name);
});

Given('the creation sheet is open', async ({ page }) => {
  await openCreationSheet(page);
});

Given('a running gateway named {string}', async ({ page }, name: string) => {
  await seedGateway(page, name);
  await expect(gatewayRowReading(page, name, 'Running')).toBeVisible();
  focusGateway(page, name);
});

Given('a stopped gateway named {string}', async ({ page }, name: string) => {
  await seedGateway(page, name);
  await haltGateway(page, name);
  focusGateway(page, name);
});

Given(
  'another process has taken the port that {string} holds',
  async ({ page, portSquatter }, name: string) => {
    const { port } = await storedGateway(page, name);

    await portSquatter.take(port);
    rememberTakenPort(page, port);
  },
);

When(
  'the maintainer creates the gateway {string} on the offered port',
  async ({ page }, name: string) => {
    await createThroughSheet(page, { name });
    focusGateway(page, name);
  },
);

When('the maintainer starts {string} from the toolbar', async ({ page }, name: string) => {
  focusGateway(page, name);
  await pressToolbarControl(page, name, 'Start');
});

Then('the sidebar shows {string} as {word}', async ({ page }, name: string, state: string) => {
  await expect(gatewayRowReading(page, name, state)).toBeVisible();
});

Then('{string} stops answering', async ({ page }, name: string) => {
  await expect.poll(async () => healthNameAt(await gatewayAddress(page, name))).toBeNull();
});

Then('a message names the taken port', async ({ page }) => {
  await openGateway(page, focusedGateway(page));

  await expect(page.getByRole('alert')).toHaveText(
    `Another process holds port ${String(takenPort(page))}.`,
  );
});

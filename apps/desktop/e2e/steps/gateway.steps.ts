import { Given } from '../fixtures';
import { openCreationSheet, seedGateway } from '../gateway-screen';

Given('a gateway named {string} exists', async ({ page }, name: string) => {
  await seedGateway(page, name);
});

Given('the creation sheet is open', async ({ page }) => {
  await openCreationSheet(page);
});

import { Given } from '../fixtures';
import { seedGateway } from '../gateway-screen';

Given('a gateway named {string} exists', async ({ page }, name: string) => {
  await seedGateway(page, name);
});

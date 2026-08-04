import { Given } from '../fixtures';

Given('nothing answers on the documented port', async ({ localRuntime }) => {
  await localRuntime.fallsSilent();
});

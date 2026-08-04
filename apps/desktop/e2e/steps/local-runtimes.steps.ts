import { Given } from '../fixtures';

Given('Ollama answers on its documented localhost port', async ({ localRuntime }) => {
  await localRuntime.answers();
});

Given('nothing answers on the documented port', async ({ localRuntime }) => {
  await localRuntime.fallsSilent();
});

import { expect } from '@playwright/test';

import { accountsHeldInRegistry, accountsStoredInRegistry } from '../accounts-document';
import { Given, Then, When } from '../fixtures';
import { catalog, detectReading, pickEntry, placementOf, portField } from '../provider-screen';

/** The look reaches the runtime over a spawned child, rather than on the pick's own keystroke. */
const RUNTIME_LOOK_WAIT_MS = 20_000;

const WITHIN_ONE_LINE_PX = 10;

const ASKS_TO_LOOK = /check|detect|look|scan/iu;

Given(
  'Ollama version {string} answers on its documented localhost port',
  async ({ localRuntime }, version: string) => {
    await localRuntime.answersWithVersion(version);
  },
);

Then('the surface reads {string}', async ({ page }, sentence: string) => {
  await expect(detectReading(page).getByRole('paragraph').first()).toHaveText(sentence, {
    timeout: RUNTIME_LOOK_WAIT_MS,
  });
});

Then('the version {string} stands beneath', async ({ page }, version: string) => {
  const lines = detectReading(page).getByRole('paragraph');
  const beneath = lines.last();

  await expect(beneath).toContainText(version);

  const sentence = await placementOf(lines.first());

  expect((await placementOf(beneath)).top).toBeGreaterThan(sentence.top);
});

Then('no act asked permission to look', async ({ page }) => {
  await expect(catalog(page).getByRole('button', { name: ASKS_TO_LOOK })).toHaveCount(0);
});

Then(
  '{string} leads, with {string} standing beside it as a plain act',
  async ({ page }, leading: string, alongside: string) => {
    const leads = catalog(page).getByRole('button', { name: leading });
    const beside = catalog(page).getByRole('button', { name: alongside });

    await expect(leads).toBeVisible();
    await expect(beside).toBeVisible();

    const leadsAt = await placementOf(leads);
    const besideAt = await placementOf(beside);

    expect(leadsAt.left).toBeGreaterThan(besideAt.right);
    expect(Math.abs(leadsAt.centerY - besideAt.centerY)).toBeLessThan(WITHIN_ONE_LINE_PX);
  },
);

Then('no account joins the registry', async ({ electronApp }) => {
  expect(await accountsHeldInRegistry(electronApp)).toBe(0);
});

const DOCUMENTED_OLLAMA_PORT = '11434';

Given("Ollama answers on a port that isn't the documented one", async ({ localRuntime }) => {
  await localRuntime.answers();
  expect(new URL(localRuntime.origin).port).not.toBe(DOCUMENTED_OLLAMA_PORT);
});

When(
  'the maintainer picks {string} and points the look at that port',
  async ({ localRuntime, page }, runtime: string) => {
    await pickEntry(page, runtime);
    await portField(page).fill(new URL(localRuntime.origin).port);
    await portField(page).press('Enter');
  },
);

Then('the surface reads that Ollama is running at that port', async ({ localRuntime, page }) => {
  await expect(detectReading(page).getByRole('paragraph').first()).toHaveText(
    `Ollama is running at ${new URL(localRuntime.origin).host}.`,
    { timeout: RUNTIME_LOOK_WAIT_MS },
  );
});

Then(
  'adding it stores that address with no credential',
  async ({ electronApp, localRuntime, page }) => {
    await catalog(page).getByRole('button', { name: 'Add Ollama' }).click();
    await expect(catalog(page)).toBeHidden();

    const stored = await accountsStoredInRegistry(electronApp);

    expect(stored).toEqual([
      expect.objectContaining({ kind: 'local', address: localRuntime.origin }),
    ]);
    expect(stored[0]).not.toHaveProperty('credentialRef');
  },
);

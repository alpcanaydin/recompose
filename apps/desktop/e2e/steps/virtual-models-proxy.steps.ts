import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import type { GatewayAnswer } from '../gateway-client';

import { Given, Then, When } from '../fixtures';
import {
  anthropicListedIds,
  openAiListedIds,
  readFrom,
  refusalSentence,
  sendTurn,
  turnUnder,
} from '../gateway-client';
import { gatewayAddress, seedGateway, storedGateway } from '../gateway-screen';
import { answerTheProviderGives } from '../key-probe-stub';
import { accountRows, openProviderScreen } from '../provider-screen';
import { focusedGateway, focusGateway } from '../scenario-memory';
import {
  accountHeldAs,
  gatewayTargetingAKey,
  GATEWAY_A_SCENARIO_ACTS_ON,
} from '../stored-target-accounts';
import { bindingOf, seedVirtualModels } from '../stored-virtual-models';
import { vaultLeavesTheMachine } from '../vault-file';

const MESSAGES_PATH = '/v1/messages';

const MODEL_LISTING = '/v1/models';

const REAL_MODEL = 'claude-sonnet-5';

const ANSWERED = 200;

const REFUSED_BY_CONFIG = 502;

const NO_SUCH_MODEL = 404;

const answers = new WeakMap<Page, GatewayAnswer>();

const namesAsked = new WeakMap<Page, string>();

function answerHeld(page: Page): GatewayAnswer {
  const answer = answers.get(page);

  if (answer === undefined) {
    throw new Error('no step asked this gateway anything');
  }

  return answer;
}

function nameAsked(page: Page): string {
  const name = namesAsked.get(page);

  if (name === undefined) {
    throw new Error('no step sent a request under a name this scenario could read back');
  }

  return name;
}

async function gatewayServing(page: Page, names: readonly string[]): Promise<void> {
  await gatewayTargetingAKey(page);

  const key = await accountHeldAs(page, 'api-key');

  await seedVirtualModels(
    page,
    focusedGateway(page),
    names.map((name) => bindingOf(name, key.id, REAL_MODEL)),
  );
}

Given(
  'a gateway holding a virtual model {string} bound to a stored key account',
  async ({ page }, name: string) => {
    await gatewayServing(page, [name]);
  },
);

Given('a gateway holding no virtual model named {string}', async ({ page }, name: string) => {
  await seedGateway(page, GATEWAY_A_SCENARIO_ACTS_ON);
  focusGateway(page, GATEWAY_A_SCENARIO_ACTS_ON);

  const stored = await storedGateway(page, GATEWAY_A_SCENARIO_ACTS_ON);

  expect(stored.virtualModels.map((model) => model.id)).not.toContain(name);
});

Given(
  'a virtual model {string} whose target account left the registry',
  async ({ page }, name: string) => {
    await gatewayServing(page, [name]);
    await openProviderScreen(page, 'API Keys');
    await accountRows(page)
      .first()
      .getByRole('button', { name: /^Actions for/u })
      .click();
    await page.getByRole('menuitem', { name: 'Remove' }).click();
    await expect(accountRows(page)).toHaveCount(0);
  },
);

Given(
  'a virtual model {string} whose target account holds no stored credential',
  async ({ electronApp, page }, name: string) => {
    await gatewayServing(page, [name]);
    await vaultLeavesTheMachine(electronApp);
  },
);

Given(
  'a gateway holding virtual models {string} and {string}',
  async ({ page }, first: string, second: string) => {
    await gatewayServing(page, [first, second]);
  },
);

When('a request arrives under {string}', async ({ page }, name: string) => {
  const address = await gatewayAddress(page, focusedGateway(page));

  namesAsked.set(page, name);
  answers.set(page, await sendTurn(address, MESSAGES_PATH, turnUnder(name)));
});

When('a client asks the gateway for its model listing', async ({ page }) => {
  const address = await gatewayAddress(page, focusedGateway(page));

  answers.set(page, await readFrom(address, MODEL_LISTING));
});

Then("the target's provider receives it under the target's real model name", ({ keyProbe }) => {
  expect(keyProbe.modelsAsked()).toEqual([REAL_MODEL]);
});

Then('the answer travels back to the caller', ({ page }) => {
  const answer = answerHeld(page);

  expect(answer.status).toBe(ANSWERED);
  expect(JSON.stringify(answer.body)).toContain(answerTheProviderGives);
});

Then('the gateway answers a typed refusal naming the unknown model', ({ page }) => {
  const answer = answerHeld(page);

  expect(answer.status).toBe(NO_SUCH_MODEL);
  expect(refusalSentence(answer.body)).toContain(nameAsked(page));
});

Then('no request leaves the machine', ({ keyProbe }) => {
  expect(keyProbe.modelsAsked()).toEqual([]);
});

Then('the gateway answers a typed refusal naming the missing target', ({ page }) => {
  const answer = answerHeld(page);

  expect(answer.status).toBe(REFUSED_BY_CONFIG);
  expect(refusalSentence(answer.body)).toContain('no target');
  expect(refusalSentence(answer.body)).toContain(nameAsked(page));
});

Then('the gateway answers a typed refusal naming the missing credential', ({ page }) => {
  const answer = answerHeld(page);

  expect(answer.status).toBe(REFUSED_BY_CONFIG);
  expect(refusalSentence(answer.body)).toContain('no credential');
  expect(refusalSentence(answer.body)).toContain(nameAsked(page));
});

Then('nothing else receives the request', ({ keyProbe }) => {
  expect(keyProbe.modelsAsked()).toEqual([]);
});

Then('the listing names {string} and {string}', ({ page }, first: string, second: string) => {
  expect(anthropicListedIds(answerHeld(page).body)).toEqual([first, second]);
});

Then('it answers the same set in the Anthropic and the OpenAI shape', ({ page }) => {
  const { body } = answerHeld(page);

  expect(openAiListedIds(body)).toEqual(anthropicListedIds(body));
});

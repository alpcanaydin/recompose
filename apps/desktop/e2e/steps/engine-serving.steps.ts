import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import type { GatewayAnswer } from '../gateway-client';

import { Then, When } from '../fixtures';
import { addressOfPort, namedGateway, postTo, readFrom, refusalSentence } from '../gateway-client';
import { storedGateway } from '../gateway-screen';

/** A path no gateway serves, which is where an SDK habitually starts against a base URL. */
const MODEL_LISTING = '/v1/models';

const MODEL_REQUEST = '/v1/messages';

type Exchange = { gateway: string; answer: GatewayAnswer };

const exchanges = new WeakMap<Page, Exchange[]>();

function record(page: Page, gateway: string, answer: GatewayAnswer): void {
  exchanges.set(page, [...(exchanges.get(page) ?? []), { gateway, answer }]);
}

function heldExchanges(page: Page): Exchange[] {
  const held = exchanges.get(page) ?? [];

  if (held.length === 0) {
    throw new Error('no step sent a request the scenario could read an answer from');
  }

  return held;
}

function lastAnswer(page: Page): GatewayAnswer {
  const last = heldExchanges(page).at(-1);

  if (last === undefined) {
    throw new Error('the answers this scenario recorded vanished between its steps');
  }

  return last.answer;
}

function answerFrom(page: Page, gateway: string): GatewayAnswer {
  const found = heldExchanges(page).find((exchange) => exchange.gateway === gateway);

  if (found === undefined) {
    throw new Error(`no step asked "${gateway}" anything`);
  }

  return found.answer;
}

async function addressOf(page: Page, name: string): Promise<string> {
  return addressOfPort((await storedGateway(page, name)).port);
}

async function checkHealth(page: Page, name: string): Promise<void> {
  record(page, name, await readFrom(await addressOf(page, name), '/health'));
}

When(
  'a client using the address of {string} as its base URL sends a request',
  async ({ page }, name: string) => {
    record(page, name, await readFrom(await addressOf(page, name), MODEL_LISTING));
  },
);

Then('{string} answers the request', ({ page }, name: string) => {
  const answer = answerFrom(page, name);

  expect(answer.contentType).toContain('application/json');
  expect(refusalSentence(answer.body)).toContain(name);
});

When('a client checks the health of {string}', async ({ page }, name: string) => {
  await checkHealth(page, name);
});

When(
  'a client checks the health of {string} and of {string}',
  async ({ page }, first: string, second: string) => {
    await checkHealth(page, first);
    await checkHealth(page, second);
  },
);

Then('a success answers carrying the name {string}', ({ page }, name: string) => {
  const answer = answerFrom(page, name);

  expect(answer.status).toBe(200);
  expect(namedGateway(answer.body)).toBe(name);
});

When('a client sends a model request to {string}', async ({ page }, name: string) => {
  record(page, name, await postTo(await addressOf(page, name), MODEL_REQUEST));
});

Then('a typed refusal answers', ({ page }) => {
  const answer = lastAnswer(page);

  expect(answer.status).toBe(404);
  expect(answer.contentType).toContain('application/json');
  expect(refusalSentence(answer.body)).not.toBe('');
});

Then('it names {string} and states that it holds no model', ({ page }, name: string) => {
  const sentence = refusalSentence(answerFrom(page, name).body);

  expect(sentence).toContain(name);
  expect(sentence).toContain('holds no virtual model');
});

Then('each answers with its own name', ({ page }) => {
  for (const exchange of heldExchanges(page)) {
    expect(namedGateway(exchange.answer.body)).toBe(exchange.gateway);
  }
});

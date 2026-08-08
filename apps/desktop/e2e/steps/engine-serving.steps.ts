import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

import type { GatewayAnswer } from '../gateway-client';

import { Then, When } from '../fixtures';
import {
  addressOfPort,
  anthropicListedIds,
  anthropicRefusalType,
  namedGateway,
  openAiRefusalCode,
  readFrom,
  refusalSentence,
  sendTurn,
  turnUnder,
} from '../gateway-client';
import { storedGateway } from '../gateway-screen';

/** Where an SDK habitually starts against a base URL, before it adds a path of its own. */
const MODEL_LISTING = '/v1/models';

/** Where an Anthropic client sends a turn. */
const ANTHROPIC_TURN = '/v1/messages';

/** Where an OpenAI client sends the same turn. */
const OPENAI_TURN = '/v1/chat/completions';

const BOTH_DIALECTS = 2;

const NO_SUCH_MODEL = 404;

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

/** The two answers one turn drew, the Anthropic reading first, in the order they were sent. */
function bothDialects(page: Page): [GatewayAnswer, GatewayAnswer] {
  const held = heldExchanges(page);
  const [anthropic, openAi] = held;

  if (held.length !== BOTH_DIALECTS || anthropic === undefined || openAi === undefined) {
    throw new Error('no step asked this gateway on both dialects');
  }

  return [anthropic.answer, openAi.answer];
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

  expect(answer.status).toBe(200);
  expect(answer.contentType).toContain('application/json');
  expect(anthropicListedIds(answer.body)).toEqual([]);
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

When(
  'a client asks {string} for the model {string} on both dialects',
  async ({ page }, name: string, model: string) => {
    const address = await addressOf(page, name);

    record(page, name, await sendTurn(address, ANTHROPIC_TURN, turnUnder(model)));
    record(page, name, await sendTurn(address, OPENAI_TURN, turnUnder(model)));
  },
);

Then('each answers a typed refusal naming {string}', ({ page }, model: string) => {
  const answered = bothDialects(page);

  for (const answer of answered) {
    expect(answer.status).toBe(NO_SUCH_MODEL);
    expect(answer.contentType).toContain('application/json');
    expect(refusalSentence(answer.body)).toContain(model);
  }
});

Then(
  'the Anthropic refusal carries an error type where the OpenAI one carries a code',
  ({ page }) => {
    const [anthropic, openAi] = bothDialects(page);

    expect(anthropicRefusalType(anthropic.body)).toBe('not_found_error');
    expect(openAiRefusalCode(openAi.body)).toBe('model_not_found');
  },
);

Then('each answers with its own name', ({ page }) => {
  for (const exchange of heldExchanges(page)) {
    expect(namedGateway(exchange.answer.body)).toBe(exchange.gateway);
  }
});

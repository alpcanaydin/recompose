import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import type { SpendGrantFor } from '../gateway-proxy';
import type { JsonObject } from '../gateway-wire';

import { aGatewayHolding, aVirtualModel } from '../gateway-app.testkit';
import { prepareXAIWebSocketTarget } from './xai-websocket-prepare';

const boundModel = aVirtualModel({
  id: 'fast',
  target: { standing: 'bound', providerModel: 'grok-4.3' },
});

function xaiGrant(): SpendGrant {
  return {
    verdict: 'resolved',
    providerOrigin: 'https://api.x.ai',
    spend: { custody: 'credentialed', provider: 'xai', credential: 'xai-key' },
  };
}

function granting(grant: SpendGrant): SpendGrantFor {
  return async () => Promise.resolve(grant);
}

async function prepared(message: JsonObject, grant: SpendGrant = xaiGrant()) {
  return prepareXAIWebSocketTarget(aGatewayHolding(boundModel), granting(grant), message);
}

describe('Refusing a xAI socket request the gateway cannot serve', () => {
  it('should refuse a request that names no known virtual model', async () => {
    await expect(prepared({ model: 'unknown' })).resolves.toEqual({
      error: 'unknown virtual model',
    });
  });

  it('should refuse a request whose model arrived as something other than a name', async () => {
    await expect(prepared({ model: 7 })).resolves.toEqual({ error: 'unknown virtual model' });
  });

  it('should refuse a request whose virtual model reaches no target', async () => {
    const removed = aVirtualModel({ id: 'fast', target: { standing: 'removed' } });
    const result = await prepareXAIWebSocketTarget(aGatewayHolding(removed), granting(xaiGrant()), {
      model: 'fast',
    });

    expect(result).toEqual({ error: 'unknown virtual model' });
  });

  it('should refuse a request the spend policy did not resolve', async () => {
    const refused: SpendGrant = { verdict: 'missing-credential' };

    await expect(prepared({ model: 'fast' }, refused)).resolves.toEqual({
      error: 'xAI target unavailable',
    });
  });

  it('should refuse a grant that spends a subscription rather than a key', async () => {
    const subscription: SpendGrant = {
      verdict: 'resolved',
      providerOrigin: 'https://api.x.ai',
      spend: {
        custody: 'subscription',
        provider: 'openai',
        accountId: 'acc',
        credential: '{}',
      },
    };

    await expect(prepared({ model: 'fast' }, subscription)).resolves.toEqual({
      error: 'xAI target unavailable',
    });
  });

  it('should refuse a key that belongs to another provider', async () => {
    const foreign: SpendGrant = {
      verdict: 'resolved',
      providerOrigin: 'https://api.openai.com',
      spend: { custody: 'credentialed', provider: 'openai', credential: 'openai-key' },
    };

    await expect(prepared({ model: 'fast' }, foreign)).resolves.toEqual({
      error: 'xAI target unavailable',
    });
  });
});

describe('Preparing a xAI socket target', () => {
  it('should read the request nested under a response envelope', async () => {
    const result = await prepared({ response: { model: 'fast', input: 'hello' } });

    expect(result).toHaveProperty('crossing.providerModel', 'grok-4.3');
  });

  it('should read a request that carries no response envelope', async () => {
    const result = await prepared({ model: 'fast', input: 'hello' });

    expect(result).toHaveProperty('crossing.virtualModel', 'fast');
  });

  it('should scope the replay to the prompt cache key the caller sent', async () => {
    const result = await prepared({ model: 'fast', prompt_cache_key: 'ws-session' });

    expect(result).toHaveProperty('crossing.sessionId', 'ws-session');
    expect(result).toHaveProperty('crossing.replayScopeId', 'prompt-cache:ws-session');
  });

  it('should leave the replay unscoped when the caller sent no prompt cache key', async () => {
    const result = await prepared({ model: 'fast' });

    expect(result).toHaveProperty('crossing.sessionId', undefined);
    expect(result).toHaveProperty('crossing.replayScopeId', undefined);
  });

  it('should key the upstream connection by origin, credential and provider model', async () => {
    const result = await prepared({ model: 'fast' });

    expect(result).toHaveProperty('key', 'https://api.x.ai\0xai-key\0grok-4.3');
  });

  it('should authorise the upstream connection with the granted key', async () => {
    const result = await prepared({ model: 'fast' });

    expect(result).toHaveProperty('headers.authorization', 'Bearer xai-key');
  });

  it('should send the provider model rather than the virtual one upstream', async () => {
    const result = await prepared({ model: 'fast', input: 'hello' });

    expect(result).toHaveProperty('normalized.model', 'grok-4.3');
  });
});

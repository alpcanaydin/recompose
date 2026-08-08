import type { SpendGrant } from '@recompose/contracts';

import { describe, expect, it } from 'vitest';

import type { JsonObject } from './gateway-wire';

import { pluginMethods } from './plugin-abi';
import { pluginTokenCount } from './plugin-count';
import { PluginHost } from './plugin-host';

type ResolvedGrant = Extract<SpendGrant, { verdict: 'resolved' }>;
type ExecutorTraits = { formats: readonly string[]; identifier: string; count: string };

const anAsk: JsonObject = {
  model: 'fast',
  max_tokens: 16,
  messages: [{ role: 'user', content: 'hello' }],
};

const credentialedSpend: ResolvedGrant['spend'] = {
  custody: 'credentialed',
  provider: 'plugin-provider',
  credential: '{"token":"secret"}',
  accountId: 'acc-plugin',
};

describe('plugin token counting declines what it cannot serve', () => {
  it('should answer nothing when the gateway holds no plugin host', async () => {
    await expect(pluginTokenCount(anAsk, aGrant(credentialedSpend), 'plugin-model')).resolves.toBe(
      null,
    );
  });

  it('should answer nothing for an open target that names no provider', async () => {
    const host = await aCountingHost();

    await expect(pluginTokenCount(anAsk, aGrant({ custody: 'open' }), 'm', host)).resolves.toBe(
      null,
    );
  });

  it('should answer nothing when no executor answers to the granted provider', async () => {
    const host = await aCountingHost({ identifier: 'another-provider' });

    await expect(
      pluginTokenCount(anAsk, aGrant(credentialedSpend), 'plugin-model', host),
    ).resolves.toBe(null);
  });

  it('should answer nothing when the executor speaks no dialect the gateway encodes', async () => {
    const host = await aCountingHost({ formats: ['a-dialect-nobody-speaks'] });

    await expect(
      pluginTokenCount(anAsk, aGrant(credentialedSpend), 'plugin-model', host),
    ).resolves.toBe(null);
  });

  it('should answer nothing when the request does not speak the Anthropic wire', async () => {
    const host = await aCountingHost();
    const notAnAsk: JsonObject = { model: 'fast', prompt: 'hello' };

    await expect(
      pluginTokenCount(notAnAsk, aGrant(credentialedSpend), 'plugin-model', host),
    ).resolves.toBe(null);
  });

  it('should answer nothing when the conversation folds away empty in translation', async () => {
    const host = await aCountingHost({ formats: ['chat-completions'] });
    const hollow: JsonObject = { model: 'fast', max_tokens: 16, messages: [] };

    await expect(
      pluginTokenCount(hollow, aGrant(credentialedSpend), 'plugin-model', host),
    ).resolves.toBe(null);
  });
});

describe('plugin token counting reaches the executor in its own dialect', () => {
  it('should carry the raw ask when the executor already speaks Anthropic', async () => {
    const host = await aCountingHost({ formats: ['anthropic'] });
    const answer = await countingWith(host);

    await expect(answer.json()).resolves.toEqual({ input_tokens: 17 });
  });

  it('should translate the ask when the executor speaks chat completions', async () => {
    const host = await aCountingHost({ formats: ['chat-completions'] });
    const answer = await countingWith(host);

    await expect(answer.json()).resolves.toEqual({ input_tokens: 17 });
  });

  it('should translate the ask when the executor speaks Gemini', async () => {
    const host = await aCountingHost({ formats: ['gemini'] });
    const answer = await countingWith(host);

    await expect(answer.json()).resolves.toEqual({ input_tokens: 17 });
  });

  it('should bill an open-custody executor no account and no credential', async () => {
    const host = await aCountingHost({ identifier: 'plugin-provider' });
    const anonymous: ResolvedGrant['spend'] = {
      custody: 'credentialed',
      provider: 'plugin-provider',
      credential: 'secret',
    };
    const answer = await countingWith(host, anonymous);

    await expect(answer.json()).resolves.toEqual({ input_tokens: 17 });
  });
});

describe('plugin token counting reads the total the executor spells', () => {
  it('should read a count spelled as input_tokens', async () => {
    const host = await aCountingHost({ count: '{"input_tokens":11}' });

    await expect((await countingWith(host)).json()).resolves.toEqual({ input_tokens: 11 });
  });

  it('should read a count spelled as total_tokens', async () => {
    const host = await aCountingHost({ count: '{"total_tokens":23}' });

    await expect((await countingWith(host)).json()).resolves.toEqual({ input_tokens: 23 });
  });

  it('should read a count spelled as totalTokens', async () => {
    const host = await aCountingHost({ count: '{"totalTokens":29}' });

    await expect((await countingWith(host)).json()).resolves.toEqual({ input_tokens: 29 });
  });

  it('should skip a spelling that is not a number and read the next', async () => {
    const host = await aCountingHost({ count: '{"input_tokens":"eleven","total_tokens":31}' });

    await expect((await countingWith(host)).json()).resolves.toEqual({ input_tokens: 31 });
  });

  it('should skip a negative count and read the next spelling', async () => {
    const host = await aCountingHost({ count: '{"input_tokens":-1,"totalTokens":37}' });

    await expect((await countingWith(host)).json()).resolves.toEqual({ input_tokens: 37 });
  });

  it('should hand back the executor payload when no spelling carries a total', async () => {
    const host = await aCountingHost({ count: '{"usage":{"prompt":5}}' });

    await expect((await countingWith(host)).text()).resolves.toBe('{"usage":{"prompt":5}}');
  });

  it('should hand back the executor payload when it is not an object at all', async () => {
    const host = await aCountingHost({ count: '"no count here"' });

    await expect((await countingWith(host)).text()).resolves.toBe('"no count here"');
  });
});

function aGrant(spend: ResolvedGrant['spend']): ResolvedGrant {
  return { verdict: 'resolved', providerOrigin: 'plugin://provider', spend };
}

async function countingWith(
  host: PluginHost,
  spend: ResolvedGrant['spend'] = credentialedSpend,
): Promise<Response> {
  const answer = await pluginTokenCount(anAsk, aGrant(spend), 'plugin-model', host);

  if (answer === null) throw new Error('the plugin executor did not answer the count');

  return answer;
}

async function aCountingHost(traits: Partial<ExecutorTraits> = {}): Promise<PluginHost> {
  const settled: ExecutorTraits = {
    formats: ['anthropic'],
    identifier: 'plugin-provider',
    count: '{"input_tokens":17}',
    ...traits,
  };
  const host = new PluginHost(() => ({
    call: async (method: string) => {
      await Promise.resolve();

      return answerFor(method, settled);
    },
    shutdown: () => undefined,
  }));

  await host.load('counting-plugin', '/counting-plugin');

  return host;
}

function answerFor(method: string, traits: ExecutorTraits): Uint8Array {
  if (method === pluginMethods.register) return registrationAnswer(traits.formats);

  if (method === 'executor.identifier') {
    return encoded({ ok: true, result: { identifier: traits.identifier } });
  }

  return encoded({
    ok: true,
    result: { Payload: Buffer.from(traits.count).toString('base64') },
  });
}

function registrationAnswer(formats: readonly string[]): Uint8Array {
  return encoded({
    ok: true,
    result: {
      schema_version: 2,
      metadata: { name: 'counting plugin' },
      capabilities: {
        executor: true,
        executor_model_scope: 'both',
        executor_input_formats: [...formats],
        executor_output_formats: ['chat-completions'],
      },
    },
  });
}

function encoded(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

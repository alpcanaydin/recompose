import { describe, expect, it } from 'vitest';

import type { Crossing } from './gateway-wire';

import { answerThroughPlugins } from './gateway-plugin-response';
import {
  askResponseGateway,
  pluginStreamAnswer,
  responseGateway,
} from './gateway-plugin-response.testkit';
import {
  encodedPluginBytes,
  responseHost,
  responsePlugin,
} from './plugin-response-interceptor.testkit';

function crossingUnderExecution(extra: Partial<Crossing> = {}): Crossing {
  return {
    dialect: 'chat-completions',
    raw: { model: 'virtual-model' },
    gatewayName: 'gateway one',
    virtualModel: 'virtual-model',
    providerModel: 'provider-model',
    pluginExecution: {
      requestHeaders: { authorization: ['Bearer sk-live-40d1'] },
      originalRequest: new TextEncoder().encode('{"model":"virtual-model"}'),
      requestBody: new TextEncoder().encode('{"model":"provider-model"}'),
      skipPluginId: '',
    },
    ...extra,
  };
}

function chatAnswer(): Response {
  return Response.json({
    id: 'chatcmpl_1',
    object: 'chat.completion',
    choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
  });
}

function historyLengthOf(request: Record<string, unknown>): number {
  const history = request['HistoryChunks'];

  return Array.isArray(history) ? history.length : 0;
}

describe('a gateway answer no plugin may touch', () => {
  it('should hand the answer back when the gateway hosts no plugins', async () => {
    const answer = await answerThroughPlugins(
      crossingUnderExecution(),
      chatAnswer(),
      'chat-completions',
    );

    await expect(answer.json()).resolves.toMatchObject({ id: 'chatcmpl_1' });
  });

  it('should hand the answer back when the request runs outside a plugin execution', async () => {
    const plugin = responsePlugin({ response: true }, () => ({
      Body: encodedPluginBytes('should-not-run'),
    }));
    const host = await responseHost([['response', 1, plugin]]);
    const { pluginExecution: _execution, ...crossing } = crossingUnderExecution();
    const answer = await answerThroughPlugins(crossing, chatAnswer(), 'chat-completions', host);

    await expect(answer.json()).resolves.toMatchObject({ id: 'chatcmpl_1' });
  });

  it('should name a request the gateway left unlabelled before handing it to a plugin', async () => {
    const seen: string[] = [];
    const plugin = responsePlugin({ response: true }, (_method, request) => {
      seen.push(String(request['RequestID']));

      return {};
    });
    const host = await responseHost([['response', 1, plugin]]);

    await answerThroughPlugins(crossingUnderExecution(), chatAnswer(), 'chat-completions', host);

    expect(seen[0]).toMatch(/^[0-9a-f-]{36}$/u);
  });
});

describe('a plugin host that holds no interceptor for the answer at hand', () => {
  it('should leave a streamed answer alone when no plugin reads chunks', async () => {
    const plugin = responsePlugin({ response: true }, () => ({
      Body: encodedPluginBytes('should-not-run'),
    }));
    const host = await responseHost([['response-only', 1, plugin]]);
    const { app } = responseGateway(host, () => pluginStreamAnswer(['first', 'second']));
    const answer = await askResponseGateway(app);

    await expect(answer.text()).resolves.toBe('firstsecond');
  });

  it('should leave a whole answer alone when no plugin reads whole answers', async () => {
    const plugin = responsePlugin({ stream: true }, () => ({
      Body: encodedPluginBytes('should-not-run'),
    }));
    const host = await responseHost([['stream-only', 1, plugin]]);
    const { app } = responseGateway(host, chatAnswer);
    const answer = await askResponseGateway(app, false);

    await expect(answer.json()).resolves.toMatchObject({ id: 'chatcmpl_1' });
  });
});

describe('the chunk history a stream plugin is shown', () => {
  it('should keep the history from growing past its ceiling', async () => {
    const lengths: number[] = [];
    const plugin = responsePlugin({ stream: true }, (_method, request) => {
      lengths.push(historyLengthOf(request));

      return {};
    });
    const host = await responseHost([['stream', 1, plugin]]);
    const chunks = Array.from({ length: 70 }, (_value, index) => `chunk-${String(index)}|`);
    const { app } = responseGateway(host, () => pluginStreamAnswer(chunks));
    const answer = await askResponseGateway(app);

    await expect(answer.text()).resolves.toContain('chunk-69|');
    expect(Math.max(...lengths)).toBe(64);
  });
});

describe('a caller that walks away from a streamed answer', () => {
  it('should let the gateway release the upstream stream it was reading', async () => {
    const plugin = responsePlugin({ stream: true }, () => ({}));
    const host = await responseHost([['stream', 1, plugin]]);
    const { app } = responseGateway(host, () => pluginStreamAnswer(['first', 'second']));
    const answer = await askResponseGateway(app);
    const body = answer.body;

    if (body === null) throw new Error('the plugin answer carried no body to cancel');

    await expect(body.cancel('the caller left')).resolves.toBeUndefined();
  });
});

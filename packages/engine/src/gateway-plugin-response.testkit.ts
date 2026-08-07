import type { PluginHost } from './plugin-host';

import { createGatewayApp } from './gateway-app';
import {
  aCredentialedGrant,
  aGatewayHolding,
  aVirtualModel,
  fetchAnsweringWith,
} from './gateway-app.testkit';

export function responseGateway(plugins: PluginHost, answer: () => Response) {
  const upstream = fetchAnsweringWith(answer);
  const app = createGatewayApp(
    aGatewayHolding(aVirtualModel()),
    async () => Promise.resolve(aCredentialedGrant('https://api.openai.com', 'openai')),
    upstream.fetchLike,
    undefined,
    undefined,
    undefined,
    plugins,
  );

  return { app, upstream };
}

export async function askResponseGateway(
  app: ReturnType<typeof createGatewayApp>,
  stream = true,
): Promise<Response> {
  return app.request('http://127.0.0.1:8397/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({
      model: 'fast',
      messages: [{ role: 'user', content: 'hello' }],
      ...(stream ? { stream: true } : {}),
    }),
  });
}

export function pluginStreamAnswer(chunks: readonly string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'content-type': 'text/event-stream' } });
}

import type { Duplex } from 'node:stream';

import { WebSocket } from 'ws';

export type UpstreamMode = 'success' | 'bare-error' | 'message-too-big' | 'handshake-429';

export function rejectFreeUsageHandshake(socket: Duplex): void {
  const body = JSON.stringify({
    code: 'subscription:free-usage-exhausted',
    error: { code: 'subscription:free-usage-exhausted', message: 'free usage exhausted' },
  });

  socket.end(
    `HTTP/1.1 429 Too Many Requests\r\nContent-Type: application/json\r\nContent-Length: ${String(Buffer.byteLength(body))}\r\n\r\n${body}`,
  );
}

function successResponse(client: WebSocket, message: unknown): void {
  const warmup =
    typeof message === 'object' && message !== null && Reflect.get(message, 'generate') === false;

  client.send(
    JSON.stringify(
      warmup
        ? {
            type: 'response.created',
            response: { id: 'resp_warmup', status: 'in_progress', output: [] },
          }
        : { type: 'response.completed', response: { id: 'resp_1' } },
    ),
  );
}

export function respondUpstream(client: WebSocket, mode: UpstreamMode, message: unknown): void {
  if (mode === 'bare-error') {
    client.send(
      JSON.stringify({
        error: {
          message: 'Request validation error: {"code":"400","error":"unsupported arguments"}',
          type: 'api_error',
        },
      }),
    );

    return;
  }

  if (mode === 'message-too-big') {
    client.close(1009, 'message too big');

    return;
  }

  successResponse(client, message);
}

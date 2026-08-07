import type { EngineGateway, SpendGrant } from '@recompose/contracts';
import type { Hono } from 'hono';
import type { WSContext, WSEvents } from 'hono/ws';

import { upgradeWebSocket } from '@hono/node-server';
import { WebSocket, type RawData } from 'ws';

import type { SpendGrantFor } from './gateway-proxy';
import type { Crossing, JsonObject } from './gateway-wire';

import { isJsonObject, parsedJson } from './gateway-wire';
import {
  credentialedRequestBody,
  credentialedRequestHeaders,
} from './provider/credentialed-target';
import { restoreXAIToolPayload } from './provider/xai-tool-response';

type XAIGrant = Extract<SpendGrant, { verdict: 'resolved' }> & {
  spend: { custody: 'credentialed'; provider: 'xai'; credential: string };
};
type SocketTarget = { body: JsonObject; virtualModel: string; providerModel: string };

function xaiGrant(grant: SpendGrant): grant is XAIGrant {
  return (
    grant.verdict === 'resolved' &&
    grant.spend.custody === 'credentialed' &&
    grant.spend.provider === 'xai'
  );
}

function upstreamWebSocketUrl(origin: string): string {
  const url = new URL(`${origin.replace(/\/+$/u, '')}/responses`);

  if (url.protocol === 'http:') url.protocol = 'ws:';
  else if (url.protocol === 'https:') url.protocol = 'wss:';
  else throw new Error(`unsupported xAI WebSocket URL scheme ${url.protocol}`);

  return url.href;
}

function requestBody(value: JsonObject): JsonObject {
  const nested = value['response'];
  const source = isJsonObject(nested) ? nested : value;
  const {
    type: _type,
    stream: _stream,
    stream_options: _streamOptions,
    background: _background,
    ...body
  } = source;
  const previous = body['previous_response_id'];

  if (typeof previous === 'string' && previous.trim() !== '') delete body['instructions'];

  return { ...body, type: 'response.create', store: true };
}

function rawText(data: RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString();
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data)).toString();

  return Buffer.from(data).toString();
}

function eventText(data: unknown): string | undefined {
  return typeof data === 'string' ? data : undefined;
}

function socketTarget(gateway: EngineGateway, message: JsonObject): SocketTarget | null {
  const body = isJsonObject(message['response']) ? message['response'] : message;
  const model = typeof body['model'] === 'string' ? body['model'] : '';
  const virtual = gateway.virtualModels.find((candidate) => candidate.id === model);

  return virtual?.target.standing === 'bound'
    ? {
        body,
        virtualModel: virtual.id,
        providerModel: virtual.target.providerModel,
      }
    : null;
}

function crossingFor(gateway: EngineGateway, target: SocketTarget): Crossing {
  const session =
    typeof target.body['prompt_cache_key'] === 'string'
      ? target.body['prompt_cache_key']
      : undefined;

  return {
    dialect: 'responses',
    raw: target.body,
    gatewayName: gateway.displayName,
    virtualModel: target.virtualModel,
    providerModel: target.providerModel,
    sessionId: session,
    replayScopeId: session === undefined ? undefined : `prompt-cache:${session}`,
  };
}

class XAIWebSocketProxy {
  private upstream?: WebSocket;
  private readonly downstream: WSContext;
  private readonly gateway: EngineGateway;
  private readonly spendGrantFor: SpendGrantFor;

  public constructor(downstream: WSContext, gateway: EngineGateway, spendGrantFor: SpendGrantFor) {
    this.downstream = downstream;
    this.gateway = gateway;
    this.spendGrantFor = spendGrantFor;
  }

  public async receive(text: string): Promise<void> {
    if (this.upstream !== undefined && this.upstream.readyState === WebSocket.OPEN) {
      this.upstream.send(text);

      return;
    }

    const parsed = parsedJson(text);

    if (!isJsonObject(parsed)) {
      this.downstream.close(1007, 'invalid JSON');

      return;
    }

    await this.connect(parsed);
  }

  public close(): void {
    this.upstream?.close();
  }

  private async connect(message: JsonObject): Promise<void> {
    const target = socketTarget(this.gateway, message);

    if (target === null) {
      this.downstream.close(1008, 'unknown virtual model');

      return;
    }

    const grant = await this.spendGrantFor(this.gateway.slug, target.virtualModel);

    if (!xaiGrant(grant)) {
      this.downstream.close(1008, 'xAI target unavailable');

      return;
    }

    const crossing = crossingFor(this.gateway, target);
    const normalized = credentialedRequestBody(grant, crossing, target.body);
    const headers = credentialedRequestHeaders(grant.spend, crossing);

    this.openUpstream(grant, crossing, headers, requestBody(normalized));
  }

  private openUpstream(
    grant: XAIGrant,
    crossing: Crossing,
    headers: Record<string, string>,
    body: JsonObject,
  ): void {
    const upstream = new WebSocket(upstreamWebSocketUrl(grant.providerOrigin), { headers });

    this.upstream = upstream;
    upstream.once('open', () => {
      upstream.send(JSON.stringify(body));
    });
    upstream.on('message', (data) => {
      const value = parsedJson(rawText(data));
      const restored = restoreXAIToolPayload(value, crossing.xaiNamespaceTools ?? {});

      this.downstream.send(JSON.stringify(restored));
    });
    upstream.once('close', (code, reason) => {
      this.downstream.close(code, reason.toString());
    });
    upstream.once('error', () => {
      this.downstream.close(1011, 'upstream WebSocket error');
    });
  }
}

function xaiWebSocketEvents(gateway: EngineGateway, spendGrantFor: SpendGrantFor): WSEvents {
  let proxy: XAIWebSocketProxy | undefined;

  return {
    onOpen(_event, socket) {
      proxy = new XAIWebSocketProxy(socket, gateway, spendGrantFor);
    },
    onMessage(event) {
      const text = eventText(Reflect.get(event, 'data'));

      if (text === undefined) proxy?.close();
      else void proxy?.receive(text);
    },
    onClose() {
      proxy?.close();
    },
  };
}

export function registerGatewayWebSockets(
  app: Hono,
  gateway: EngineGateway,
  spendGrantFor: SpendGrantFor,
): void {
  app.get(
    '/v1/responses',
    upgradeWebSocket(() => xaiWebSocketEvents(gateway, spendGrantFor)),
  );
  app.get(
    '/responses',
    upgradeWebSocket(() => xaiWebSocketEvents(gateway, spendGrantFor)),
  );
}

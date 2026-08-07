import type { EngineGateway, SpendGrant } from '@recompose/contracts';
import type { WSContext } from 'hono/ws';

import { WebSocket, type RawData } from 'ws';

import type { SpendGrantFor } from '../gateway-proxy';
import type { Crossing, JsonObject } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { credentialedRequestBody, credentialedRequestHeaders } from './credentialed-target';
import { restoreXAIToolPayload } from './xai-tool-response';
import { messageTooBigPayload, parseXAIWebSocketError } from './xai-websocket-error';
import {
  upstreamXAIWebSocketUrl,
  xaiWebSocketErrorPayload,
  xaiWebSocketRequestBody,
  xaiWebSocketText,
} from './xai-websocket-wire';

type XAIGrant = Extract<SpendGrant, { verdict: 'resolved' }> & {
  spend: { custody: 'credentialed'; provider: 'xai'; credential: string };
};
type SocketTarget = { body: JsonObject; virtualModel: string; providerModel: string };
type PreparedRequest = {
  body: JsonObject;
  crossing: Crossing;
  grant: XAIGrant;
  headers: Record<string, string>;
  key: string;
};
type ActiveConnection = {
  socket: WebSocket;
  key: string;
  ready: Promise<void>;
  crossing: Crossing;
};

function xaiGrant(grant: SpendGrant): grant is XAIGrant {
  return (
    grant.verdict === 'resolved' &&
    grant.spend.custody === 'credentialed' &&
    grant.spend.provider === 'xai'
  );
}

function socketTarget(gateway: EngineGateway, message: JsonObject): SocketTarget | null {
  const body = isJsonObject(message['response']) ? message['response'] : message;
  const model = typeof body['model'] === 'string' ? body['model'] : '';
  const virtual = gateway.virtualModels.find((candidate) => candidate.id === model);

  return virtual?.target.standing === 'bound'
    ? { body, virtualModel: virtual.id, providerModel: virtual.target.providerModel }
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

function connectionKey(grant: XAIGrant, crossing: Crossing): string {
  return `${grant.providerOrigin}\0${grant.spend.credential}\0${crossing.providerModel}`;
}

async function readyPromise(socket: WebSocket): Promise<void> {
  return new Promise<void>((resolve) => {
    socket.once('open', resolve);
    socket.once('error', resolve);
    socket.once('unexpected-response', resolve);
  });
}

function canSend(current: ActiveConnection | undefined, candidate: ActiveConnection): boolean {
  return current === candidate && candidate.socket.readyState === WebSocket.OPEN;
}

export class XAIWebSocketProxy {
  private active: ActiveConnection | undefined;
  private readonly downstream: WSContext;
  private readonly gateway: EngineGateway;
  private readonly spendGrantFor: SpendGrantFor;
  private terminal = false;
  private turn: Promise<void> = Promise.resolve();

  public constructor(downstream: WSContext, gateway: EngineGateway, spendGrantFor: SpendGrantFor) {
    this.downstream = downstream;
    this.gateway = gateway;
    this.spendGrantFor = spendGrantFor;
  }

  public async receive(text: string): Promise<void> {
    const work = async (): Promise<void> => {
      await this.receiveTurn(text);
    };

    this.turn = this.turn.then(work, work);

    return this.turn;
  }

  public close(): void {
    this.terminal = true;
    const active = this.active;

    this.active = undefined;
    active?.socket.close();
  }

  private async receiveTurn(text: string): Promise<void> {
    const parsed = parsedJson(text);

    if (!isJsonObject(parsed)) {
      this.downstream.close(1007, 'invalid JSON');

      return;
    }

    const prepared = await this.prepare(parsed);

    if (prepared !== null) await this.send(prepared);
  }

  private async prepare(message: JsonObject): Promise<PreparedRequest | null> {
    const target = socketTarget(this.gateway, message);

    if (target === null) {
      this.downstream.close(1008, 'unknown virtual model');

      return null;
    }

    const grant = await this.spendGrantFor(this.gateway.slug, target.virtualModel);

    if (!xaiGrant(grant)) {
      this.downstream.close(1008, 'xAI target unavailable');

      return null;
    }

    const crossing = crossingFor(this.gateway, target);
    const normalized = credentialedRequestBody(grant, crossing, target.body);

    return {
      body: xaiWebSocketRequestBody(normalized),
      crossing,
      grant,
      headers: credentialedRequestHeaders(grant.spend, crossing),
      key: connectionKey(grant, crossing),
    };
  }

  private async send(prepared: PreparedRequest): Promise<void> {
    const active = this.connectionFor(prepared);

    active.crossing = prepared.crossing;
    await active.ready;

    if (canSend(this.active, active)) {
      active.socket.send(JSON.stringify(prepared.body));
    }
  }

  private connectionFor(prepared: PreparedRequest): ActiveConnection {
    const current = this.active;

    if (current !== undefined && current.key === prepared.key) return current;

    this.active = undefined;
    current?.socket.close(1000, 'target changed');

    const active = this.openUpstream(prepared);

    this.active = active;

    return active;
  }

  private openUpstream(prepared: PreparedRequest): ActiveConnection {
    const socket = new WebSocket(upstreamXAIWebSocketUrl(prepared.grant.providerOrigin), {
      headers: prepared.headers,
    });
    const active: ActiveConnection = {
      socket,
      key: prepared.key,
      ready: readyPromise(socket),
      crossing: prepared.crossing,
    };

    this.bindUpstream(active);

    return active;
  }

  private bindUpstream(active: ActiveConnection): void {
    active.socket.on('message', (data) => {
      this.upstreamMessage(active, data);
    });
    active.socket.once('close', (code, reason) => {
      this.upstreamClose(active, code, reason);
    });
    active.socket.once('error', () => {
      if (this.active === active && !this.terminal) this.sendError(undefined);
    });
    active.socket.once('unexpected-response', (_request, response) => {
      this.handshakeError(active, response);
    });
  }

  private upstreamMessage(active: ActiveConnection, data: RawData): void {
    if (this.active !== active || this.terminal) return;

    const value = parsedJson(xaiWebSocketText(data));

    if (parseXAIWebSocketError(value) !== null) {
      this.sendError(value);
      active.socket.close();

      return;
    }

    const restored = restoreXAIToolPayload(value, active.crossing.xaiNamespaceTools ?? {});

    this.downstream.send(JSON.stringify(restored));
  }

  private upstreamClose(active: ActiveConnection, code: number, reason: Buffer): void {
    if (this.active !== active || this.terminal) return;

    this.active = undefined;

    if (code === 1009)
      this.downstream.send(JSON.stringify(messageTooBigPayload(reason.toString())));

    this.downstream.close(code, reason.toString());
    this.terminal = true;
  }

  private handshakeError(
    active: ActiveConnection,
    response: import('node:http').IncomingMessage,
  ): void {
    let text = '';

    response.on('data', (chunk) => {
      text += Buffer.from(chunk).toString();
    });
    response.on('end', () => {
      if (this.active !== active || this.terminal) return;

      const value = parsedJson(text);
      const body = isJsonObject(value) ? { ...value, status: response.statusCode } : value;

      this.sendError(body, response.statusCode ?? 500);
    });
  }

  private sendError(value: unknown, fallbackStatus = 500): void {
    const parsed = parseXAIWebSocketError(value);
    const payload = xaiWebSocketErrorPayload(value, fallbackStatus);

    this.downstream.send(JSON.stringify(payload));
    this.downstream.close(parsed?.status === 429 ? 1013 : 1011, 'upstream WebSocket error');
    this.terminal = true;
  }
}

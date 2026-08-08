import type { EngineGateway } from '@recompose/contracts';
import type { WSContext } from 'hono/ws';

import { WebSocket, type RawData } from 'ws';

import type { SpendGrantFor } from '../gateway-proxy';
import type { Crossing, JsonObject } from '../gateway-wire';
import type { XAIWebSocketGrant } from './xai-websocket-prepare';

import { isJsonObject, parsedJson } from '../gateway-wire';
import { restoreXAIToolPayload } from './xai-tool-response';
import { XAIWebSocketCompaction, type XAITranscriptTurn } from './xai-websocket-compaction';
import { messageTooBigPayload, parseXAIWebSocketError } from './xai-websocket-error';
import { prepareXAIWebSocketTarget } from './xai-websocket-prepare';
import { xaiWebSocketReady } from './xai-websocket-ready';
import {
  normalizeXAIReasoningEvent,
  requiresXAIWebSocketReplay,
  XAIWebSocketResponseIDs,
  xaiResponseIDsFor,
} from './xai-websocket-response';
import {
  upstreamXAIWebSocketUrl,
  xaiWebSocketErrorPayload,
  xaiWebSocketRequestBody,
  xaiWebSocketText,
} from './xai-websocket-wire';

type PreparedRequest = {
  body: JsonObject;
  crossing: Crossing;
  grant: XAIWebSocketGrant;
  headers: Record<string, string>;
  key: string;
  transcriptReset: boolean;
};
type ActiveConnection = {
  socket: WebSocket;
  key: string;
  ready: Promise<void>;
  crossing: Crossing;
  pending: XAITranscriptTurn | undefined;
};

function canSend(current: ActiveConnection | undefined, candidate: ActiveConnection): boolean {
  return current === candidate && candidate.socket.readyState === WebSocket.OPEN;
}

export class XAIWebSocketProxy {
  private active: ActiveConnection | undefined;
  private readonly downstream: WSContext;
  private readonly gateway: EngineGateway;
  private readonly spendGrantFor: SpendGrantFor;
  private readonly compaction: XAIWebSocketCompaction;
  private readonly requiredUpstreamWebSocket: boolean;
  private readonly responseIDs = new Map<string, XAIWebSocketResponseIDs>();
  private terminal = false;
  private turn: Promise<void> = Promise.resolve();

  public constructor(
    downstream: WSContext,
    gateway: EngineGateway,
    spendGrantFor: SpendGrantFor,
    fetchLike: typeof fetch,
    options: { requiredUpstreamWebSocket?: boolean } = {},
  ) {
    this.downstream = downstream;
    this.gateway = gateway;
    this.spendGrantFor = spendGrantFor;
    this.compaction = new XAIWebSocketCompaction(fetchLike);
    this.requiredUpstreamWebSocket = options.requiredUpstreamWebSocket === true;
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
    const prepared = await prepareXAIWebSocketTarget(this.gateway, this.spendGrantFor, message);

    if ('error' in prepared) {
      this.downstream.close(1008, prepared.error);

      return null;
    }

    if (this.compaction.isTrigger(prepared.normalized)) {
      if (requiresXAIWebSocketReplay(prepared.normalized, this.requiredUpstreamWebSocket)) {
        this.downstream.send(
          JSON.stringify({
            type: 'error',
            status: 409,
            error: { code: 'upstream_websocket_replay_required' },
          }),
        );

        return null;
      }

      const event = await this.compaction.compact(
        prepared.grant,
        prepared.crossing,
        prepared.normalized,
        prepared.headers,
      );

      this.downstream.send(JSON.stringify(event));

      return null;
    }

    const transcript = this.compaction.prepare(prepared.normalized);

    return {
      body: xaiWebSocketRequestBody(transcript.body),
      crossing: prepared.crossing,
      grant: prepared.grant,
      headers: prepared.headers,
      key: prepared.key,
      transcriptReset: transcript.reset,
    };
  }

  private async send(prepared: PreparedRequest): Promise<void> {
    const active = this.connectionFor(prepared);
    const body = xaiResponseIDsFor(this.responseIDs, prepared.key).prepareRequest(prepared.body);

    active.crossing = prepared.crossing;
    active.pending = { request: body, reset: prepared.transcriptReset };
    await active.ready;

    if (canSend(this.active, active)) active.socket.send(JSON.stringify(body));
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
      ready: xaiWebSocketReady(socket),
      crossing: prepared.crossing,
      pending: undefined,
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
    if (!this.acceptsMessage(active)) return;

    const value = parsedJson(xaiWebSocketText(data));

    if (this.handleUpstreamError(active, value)) return;

    const synthetic = this.observeTranscript(active, value);

    this.forwardNormalized(active, value);

    if (synthetic !== undefined) this.downstream.send(JSON.stringify(synthetic));
  }

  private forwardNormalized(active: ActiveConnection, value: unknown): void {
    const ids = xaiResponseIDsFor(this.responseIDs, active.key);

    for (const normalized of normalizeXAIReasoningEvent(value)) {
      const rewritten = ids.rewrite(normalized);
      const restored = restoreXAIToolPayload(rewritten, active.crossing.xaiNamespaceTools ?? {});

      this.downstream.send(JSON.stringify(restored));
    }
  }

  private acceptsMessage(active: ActiveConnection): boolean {
    return this.active === active && !this.terminal;
  }

  private handleUpstreamError(active: ActiveConnection, value: unknown): boolean {
    if (parseXAIWebSocketError(value) === null) return false;

    this.sendError(value);
    active.socket.close();

    return true;
  }

  private observeTranscript(active: ActiveConnection, value: unknown): JsonObject | undefined {
    if (!isJsonObject(value)) return undefined;

    const synthetic = this.compaction.observe(active.pending, value);

    if (value['type'] === 'response.completed' || synthetic !== undefined) {
      active.pending = undefined;
    }

    return synthetic;
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

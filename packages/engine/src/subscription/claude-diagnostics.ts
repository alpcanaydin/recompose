import { isJsonObject } from '../gateway-wire';

type JsonObject = Record<string, unknown>;

const MAX_DIAGNOSTIC_SESSIONS = 4096;

export class ClaudeDiagnostics {
  readonly #messages = new Map<string, string>();

  previous(key: string): string | null {
    return this.#messages.get(key) ?? null;
  }

  commit(key: string, messageId: string): void {
    this.#messages.delete(key);
    this.#messages.set(key, messageId);

    if (this.#messages.size > MAX_DIAGNOSTIC_SESSIONS) {
      const oldest = this.#messages.keys().next().value;

      if (typeof oldest === 'string') {
        this.#messages.delete(oldest);
      }
    }
  }
}

export function injectClaudeDiagnostics(body: JsonObject, previousMessageId: string | null) {
  const entries = Object.entries(body);
  const insertion = entries.findIndex(([key]) => key === 'context_management') + 1;
  const withoutDiagnostics = entries.filter(([key]) => key !== 'diagnostics');
  const position = insertion === 0 ? 0 : insertion;

  withoutDiagnostics.splice(position, 0, [
    'diagnostics',
    { previous_message_id: previousMessageId },
  ]);

  return Object.fromEntries(withoutDiagnostics);
}

function messageIdFromJson(value: unknown): string | undefined {
  const id = isJsonObject(value) ? value['id'] : undefined;

  return typeof id === 'string' && id !== '' ? id : undefined;
}

function eventData(line: string): JsonObject | null {
  if (!line.startsWith('data:')) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(line.slice(5).trim());

    return isJsonObject(value) ? value : null;
  } catch {
    return null;
  }
}

function nextSseState(
  state: { messageId: string | undefined },
  line: string,
  commit: (messageId: string) => void,
): void {
  const data = eventData(line);

  captureMessageStart(state, data);
  commitMessageStop(state, data, commit);
}

function captureMessageStart(
  state: { messageId: string | undefined },
  data: JsonObject | null,
): void {
  if (data?.['type'] === 'message_start' && isJsonObject(data['message'])) {
    state.messageId = messageIdFromJson(data['message']);
  }
}

function commitMessageStop(
  state: { messageId: string | undefined },
  data: JsonObject | null,
  commit: (messageId: string) => void,
): void {
  if (data?.['type'] === 'message_stop' && state.messageId !== undefined) {
    commit(state.messageId);
  }
}

function observingSseStream(
  body: ReadableStream<Uint8Array>,
  commit: (messageId: string) => void,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const state: { buffer: string; messageId: string | undefined } = {
    buffer: '',
    messageId: undefined,
  };

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        state.buffer += decoder.decode(chunk, { stream: true });
        const lines = state.buffer.split('\n');

        state.buffer = lines.pop() ?? '';
        lines.forEach((line) => {
          nextSseState(state, line, commit);
        });
      },
      flush() {
        nextSseState(state, state.buffer + decoder.decode(), commit);
      },
    }),
  );
}

export async function observeClaudeDiagnostics(
  response: Response,
  commit: (messageId: string) => void,
): Promise<Response> {
  if (!response.ok) {
    return response;
  }

  if (response.body === null) {
    return response;
  }

  return isSse(response)
    ? new Response(observingSseStream(response.body, commit), response)
    : observeJsonResponse(response, commit);
}

function isSse(response: Response): boolean {
  return response.headers.get('content-type')?.includes('text/event-stream') === true;
}

async function observeJsonResponse(
  response: Response,
  commit: (messageId: string) => void,
): Promise<Response> {
  const value: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  const messageId = messageIdFromJson(value);

  if (messageId !== undefined) {
    commit(messageId);
  }

  return response;
}

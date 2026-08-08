import { sseDataOf, withoutTrailingReturn } from './stream-wire';

type HygieneMode = 'unknown' | 'raw' | 'sse';
type HygieneState = {
  buffered: string;
  doneSeen: boolean;
  mode: HygieneMode;
  pending: Uint8Array[];
};

function emitLines(
  state: HygieneState,
  controller: TransformStreamDefaultController<Uint8Array>,
  encoder: { encode(input?: string): Uint8Array },
): void {
  const lines = state.buffered.split('\n');

  state.buffered = lines.pop() ?? '';

  for (const line of lines) {
    controller.enqueue(encoder.encode(`${line}\n`));

    if (state.doneSeen && withoutTrailingReturn(line) === '') {
      controller.terminate();

      return;
    }

    state.doneSeen = sseDataOf(withoutTrailingReturn(line)) === '[DONE]';
  }
}

function emitPending(
  state: HygieneState,
  controller: TransformStreamDefaultController<Uint8Array>,
): void {
  for (const chunk of state.pending) controller.enqueue(chunk);

  state.pending = [];
}

function unknownChunk(
  state: HygieneState,
  chunk: Uint8Array,
  decoder: { decode(input?: Uint8Array, options?: { stream?: boolean }): string },
  encoder: { encode(input?: string): Uint8Array },
  controller: TransformStreamDefaultController<Uint8Array>,
): void {
  state.pending.push(chunk);
  state.buffered += decoder.decode(chunk, { stream: true });

  if (state.buffered.startsWith('data:')) {
    state.mode = 'sse';
    state.pending = [];
    emitLines(state, controller, encoder);

    return;
  }

  if ('data:'.startsWith(state.buffered)) return;

  state.mode = 'raw';
  state.buffered = '';
  emitPending(state, controller);
}

export function chatSseUntilDone(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const state: HygieneState = { buffered: '', doneSeen: false, mode: 'unknown', pending: [] };

  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (state.mode === 'raw') {
          controller.enqueue(chunk);

          return;
        }

        if (state.mode === 'sse') {
          state.buffered += decoder.decode(chunk, { stream: true });
          emitLines(state, controller, encoder);

          return;
        }

        unknownChunk(state, chunk, decoder, encoder, controller);
      },
      flush(controller) {
        if (state.mode !== 'sse') {
          emitPending(state, controller);

          return;
        }

        state.buffered += decoder.decode();

        if (state.buffered !== '') controller.enqueue(encoder.encode(state.buffered));
      },
    }),
  );
}

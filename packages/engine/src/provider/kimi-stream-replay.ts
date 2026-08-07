import type { JsonObject } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';

type StreamBlock = {
  part: JsonObject;
  inputJson: string;
  hasInputDelta: boolean;
  finished: boolean;
};

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_BLOCKS = 512;
const TEXT_DELTA_FIELDS: ReadonlyMap<string, readonly [string, string]> = new Map([
  ['text_delta', ['text', 'text']],
  ['thinking_delta', ['thinking', 'thinking']],
  ['signature_delta', ['signature', 'signature']],
]);

export class KimiStreamReplayAccumulator {
  private readonly blocks = new Map<number, StreamBlock>();
  private observed = false;
  private complete = false;
  private bytesUsed = 0;
  public abandoned = false;
  public upstreamError = false;

  public observeLine(line: string): void {
    const trimmed = line.trim();

    if (!trimmed.startsWith('data:')) return;

    const payload = trimmed.slice('data:'.length).trim();

    if (payload === '' || payload === '[DONE]') return;

    const event = parsedJson(payload);

    if (!isJsonObject(event)) {
      this.abandon();

      return;
    }

    this.observeEvent(event);
  }

  public content(): JsonObject[] | undefined {
    if (!this.ready()) return undefined;

    const entries = [...this.blocks.entries()].sort(([left], [right]) => left - right);

    if (!entries.every(([, block]) => block.finished)) return undefined;

    const content = entries.map(([, block]) => block.part);

    return JSON.stringify(content).length <= MAX_BYTES ? content : undefined;
  }

  private ready(): boolean {
    return this.observed && this.complete && !this.upstreamError && !this.abandoned;
  }

  private observeEvent(event: JsonObject): void {
    if (this.observeLifecycle(event)) return;
    if (this.abandoned) return;

    this.observeBlockEvent(event);
  }

  private observeLifecycle(event: JsonObject): boolean {
    if (event['type'] === 'message_start') {
      this.observed = true;

      return true;
    }

    if (event['type'] === 'message_stop') {
      this.complete = true;

      return true;
    }

    if (event['type'] === 'error') {
      this.upstreamError = true;
      this.abandon();

      return true;
    }

    return false;
  }

  private observeBlockEvent(event: JsonObject): void {
    if (event['type'] === 'content_block_start') this.startBlock(event);
    else if (event['type'] === 'content_block_delta') this.applyBlockDelta(event);
    else if (event['type'] === 'content_block_stop') this.finishBlock(event);
  }

  private blockStart(event: JsonObject): { index: number; part: JsonObject } | null {
    const index = event['index'];
    const part = event['content_block'];

    return typeof index === 'number' && isJsonObject(part) ? { index, part } : null;
  }

  private startBlock(event: JsonObject): void {
    const start = this.blockStart(event);

    if (start === null) {
      this.abandon();

      return;
    }

    if (this.blocks.has(start.index)) {
      this.abandon();

      return;
    }

    if (this.blocks.size >= MAX_BLOCKS) {
      this.abandon();

      return;
    }

    if (!this.reserve(JSON.stringify(start.part).length)) return;

    this.blocks.set(start.index, {
      part: structuredClone(start.part),
      inputJson: '',
      hasInputDelta: false,
      finished: false,
    });
  }

  private blockDelta(event: JsonObject): { block: StreamBlock; delta: JsonObject } | null {
    const index = event['index'];
    const delta = event['delta'];
    const block = typeof index === 'number' ? this.blocks.get(index) : undefined;

    return block !== undefined && isJsonObject(delta) ? { block, delta } : null;
  }

  private applyBlockDelta(event: JsonObject): void {
    const update = this.blockDelta(event);

    if (update === null) {
      this.abandon();

      return;
    }

    if (update.delta['type'] === 'input_json_delta') {
      this.appendInput(update.block, update.delta);

      return;
    }

    const type = update.delta['type'];
    const fields = typeof type === 'string' ? TEXT_DELTA_FIELDS.get(type) : undefined;

    if (fields === undefined) {
      this.abandon();

      return;
    }

    this.appendText(update.block, fields[0], update.delta[fields[1]]);
  }

  private appendInput(block: StreamBlock, delta: JsonObject): void {
    const suffix = typeof delta['partial_json'] === 'string' ? delta['partial_json'] : '';

    if (!this.reserve(suffix.length)) return;

    block.inputJson += suffix;
    block.hasInputDelta = true;
  }

  private appendText(block: StreamBlock, field: string, value: unknown): void {
    const suffix = typeof value === 'string' ? value : '';
    const initial = typeof block.part[field] === 'string' ? block.part[field] : '';

    if (!this.reserve(suffix.length)) return;

    block.part[field] = initial + suffix;
  }

  private finishBlock(event: JsonObject): void {
    const index = event['index'];
    const block = typeof index === 'number' ? this.blocks.get(index) : undefined;

    if (block === undefined) {
      this.abandon();

      return;
    }

    if (block.hasInputDelta && !this.finishInput(block)) return;

    block.finished = true;
  }

  private finishInput(block: StreamBlock): boolean {
    const input = parsedJson(block.inputJson);

    if (!isJsonObject(input)) {
      this.abandon();

      return false;
    }

    block.part['input'] = input;

    return true;
  }

  private reserve(count: number): boolean {
    if (count < 0 || this.bytesUsed > MAX_BYTES - count) {
      this.abandon();

      return false;
    }

    this.bytesUsed += count;

    return true;
  }

  private abandon(): void {
    this.abandoned = true;
    this.blocks.clear();
    this.bytesUsed = 0;
  }
}

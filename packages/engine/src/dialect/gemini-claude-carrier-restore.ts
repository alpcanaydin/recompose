import type { HubContentBlock, HubMessage } from './hub';

import {
  decodeGeminiClaudeCarrier,
  type GeminiClaudeCarrier,
} from '../provider/gemini-claude-carrier';
import { isGeminiBypass, nativeGeminiSignature } from '../provider/gemini-signature';
import {
  geminiClaudeSemanticTarget,
  hasPreviousGeminiTool,
  signedGeminiBlock,
  type GeminiClaudeCarrierTarget,
} from './gemini-claude-carrier-semantic';

type CarrierInfo = GeminiClaudeCarrier & { marked: boolean; nonEmpty: boolean };
type SignableBlock = Extract<HubContentBlock, { type: 'text' | 'thinking' | 'tool_use' }>;

function nativeSignature(value: unknown): string | null {
  const signature = nativeGeminiSignature(value);

  return signature === null || isGeminiBypass(signature) ? null : signature;
}

function carrierOf(block: HubContentBlock): CarrierInfo | null {
  if (block.type !== 'thinking') return null;
  const marked = decodeGeminiClaudeCarrier(block.signature);

  if (marked !== null) return { ...marked, marked: true, nonEmpty: block.text !== '' };
  const signature = nativeSignature(block.signature);

  return signature === null
    ? null
    : {
        signature,
        direction: 'standalone',
        target: 'any',
        marked: false,
        nonEmpty: block.text !== '',
      };
}

function semanticIndex(
  content: readonly HubContentBlock[],
  index: number,
  step: 1 | -1,
  target: GeminiClaudeCarrier['target'],
): number | null {
  for (let current = index + step; current >= 0 && current < content.length; current += step) {
    const block = content[current];
    const decision = scanDecision(block, target);

    if (decision === 'match') return current;
    if (decision === 'stop') return null;
  }

  return null;
}

function scanDecision(
  block: HubContentBlock | undefined,
  target: GeminiClaudeCarrier['target'],
): 'match' | 'skip' | 'stop' {
  const kind = geminiClaudeSemanticTarget(block);

  if (kind !== null) return semanticDecision(target, kind);
  if (block === undefined) return 'stop';

  return carrierOf(block) === null ? 'stop' : 'skip';
}

function semanticDecision(
  target: GeminiClaudeCarrier['target'],
  kind: GeminiClaudeCarrierTarget,
): 'match' | 'stop' {
  return target === 'any' || target === kind ? 'match' : 'stop';
}

function rawDirection(content: readonly HubContentBlock[], index: number, carrier: CarrierInfo) {
  if (carrier.nonEmpty) return 'next' as const;
  const next = semanticIndex(content, index, 1, 'any');
  const previous = semanticIndex(content, index, -1, 'any');

  return neighborDirection(content, next, previous);
}

function neighborDirection(
  content: readonly HubContentBlock[],
  next: number | null,
  previous: number | null,
): 'next' | 'previous' | 'standalone' {
  if (next !== null && geminiClaudeSemanticTarget(content[next]) === 'function') return 'next';
  if (previous !== null) return 'previous';

  return next === null ? 'standalone' : 'next';
}

function effectiveCarrier(
  content: readonly HubContentBlock[],
  index: number,
  carrier: CarrierInfo,
): GeminiClaudeCarrier {
  return carrier.marked
    ? carrier
    : { ...carrier, direction: rawDirection(content, index, carrier) };
}

function targetHasSignature(block: HubContentBlock | undefined): boolean {
  if (!isSignable(block)) return false;
  if (nativeSignature(block.signature) !== null) return true;

  return markedThinking(block);
}

function isSignable(block: HubContentBlock | undefined): block is SignableBlock {
  if (block === undefined) return false;

  return new Set(['text', 'thinking', 'tool_use']).has(block.type);
}

function markedThinking(
  block: Extract<HubContentBlock, { type: 'text' | 'thinking' | 'tool_use' }>,
): boolean {
  return block.type === 'thinking' && decodeGeminiClaudeCarrier(block.signature) !== null;
}

type State = {
  targets: Map<number, string>;
  carriers: Set<number>;
  preserved: Map<number, GeminiClaudeCarrier>;
  tails: Set<number>;
};

function bindAt(
  content: readonly HubContentBlock[],
  index: number,
  state: State,
  direction: 'next' | 'previous',
): void {
  const binding = bindingAt(content, index, direction);

  if (binding === null) return;
  storeBinding(content, index, state, binding.carrier, binding.target);
}

function bindingAt(
  content: readonly HubContentBlock[],
  index: number,
  direction: 'next' | 'previous',
): { carrier: GeminiClaudeCarrier; target: number } | null {
  const block = content[index];

  if (block === undefined) return null;
  const raw = carrierOf(block);

  if (raw === null) return null;
  const carrier = effectiveCarrier(content, index, raw);

  if (carrier.direction !== direction) return null;
  const target = bindingTarget(content, index, direction, carrier.target);

  return target === null ? null : { carrier, target };
}

function bindingTarget(
  content: readonly HubContentBlock[],
  index: number,
  direction: 'next' | 'previous',
  target: GeminiClaudeCarrier['target'],
): number | null {
  return semanticIndex(content, index, direction === 'next' ? 1 : -1, target);
}

function storeBinding(
  content: readonly HubContentBlock[],
  index: number,
  state: State,
  carrier: GeminiClaudeCarrier,
  target: number,
): void {
  if (state.targets.has(target) || targetHasSignature(content[target])) {
    preserveCarrier(content, index, state, carrier);

    return;
  }

  state.targets.set(target, carrier.signature);
  state.carriers.add(index);
}

function preserveCarrier(
  content: readonly HubContentBlock[],
  index: number,
  state: State,
  carrier: GeminiClaudeCarrier,
): void {
  state.preserved.set(index, carrier);
  if (hasPreviousGeminiTool(content, index)) state.tails.add(index);
}

function bindingState(content: readonly HubContentBlock[]): State {
  const state: State = {
    targets: new Map(),
    carriers: new Set(),
    preserved: new Map(),
    tails: new Set(),
  };

  for (let index = content.length - 1; index >= 0; index -= 1) {
    bindAt(content, index, state, 'next');
  }

  for (let index = 0; index < content.length; index += 1) {
    bindAt(content, index, state, 'previous');
  }

  return state;
}

function unsignedThinking(block: Extract<HubContentBlock, { type: 'thinking' }>) {
  const { signature: _signature, ...unsigned } = block;

  return unsigned;
}

function restoredBlock(block: HubContentBlock, index: number, state: State): HubContentBlock[] {
  const carrier = carrierOf(block);
  const bound = boundCarrierBlock(block, index, state);

  if (bound !== null) return bound;
  const preserved = state.preserved.get(index);

  if (preserved !== undefined) return preservedBlock(block, preserved, state.tails.has(index));
  if (carrier !== null) return unboundCarrier(block, carrier);
  const signature = state.targets.get(index);

  return [signature === undefined ? block : signedGeminiBlock(block, signature)];
}

function boundCarrierBlock(
  block: HubContentBlock,
  index: number,
  state: State,
): HubContentBlock[] | null {
  if (!state.carriers.has(index)) return null;
  if (block.type === 'thinking' && block.text !== '') return [unsignedThinking(block)];

  return [];
}

function preservedBlock(
  block: HubContentBlock,
  carrier: GeminiClaudeCarrier,
  tail: boolean,
): HubContentBlock[] {
  return block.type === 'thinking' ? [preservedThinking(block, carrier, tail)] : [];
}

function preservedThinking(
  block: Extract<HubContentBlock, { type: 'thinking' }>,
  carrier: GeminiClaudeCarrier,
  tail: boolean,
): HubContentBlock {
  return {
    ...block,
    signature: carrier.signature,
    carrierDirection: tail ? 'previous' : carrier.direction,
    carrierTarget: carrier.target,
  };
}

function unboundCarrier(block: HubContentBlock, carrier: CarrierInfo): HubContentBlock[] {
  if (carrier.marked && carrier.direction !== 'standalone') return [];
  if (block.type !== 'thinking') return [];

  return [{ ...block, signature: carrier.signature }];
}

function restoredAssistant(content: readonly HubContentBlock[]): HubContentBlock[] {
  const state = bindingState(content);

  return content.flatMap((block, index) => restoredBlock(block, index, state));
}

function cleanedUser(content: readonly HubContentBlock[]): HubContentBlock[] {
  return content.filter((block) => carrierOf(block) === null);
}

export function restoreGeminiClaudeCarriersV2(message: HubMessage): HubMessage {
  return {
    ...message,
    content:
      message.role === 'assistant'
        ? restoredAssistant(message.content)
        : cleanedUser(message.content),
  };
}

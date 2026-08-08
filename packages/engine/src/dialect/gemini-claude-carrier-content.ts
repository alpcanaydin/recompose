import type { HubContentBlock, HubResponse } from './hub';

import { encodeGeminiClaudeCarrier } from '../provider/gemini-claude-carrier';
import { isGeminiBypass, nativeGeminiSignature } from '../provider/gemini-signature';

type Target = 'text' | 'function';

function nativeSignature(value: unknown): string | null {
  const signature = nativeGeminiSignature(value);

  return signature === null || isGeminiBypass(signature) ? null : signature;
}

function carrierBlock(
  signature: string,
  direction: 'next' | 'previous',
  target: Target,
): HubContentBlock {
  return {
    type: 'thinking',
    text: '',
    signature: encodeGeminiClaudeCarrier({ signature, direction, target }),
  };
}

type SignedBlock = Extract<HubContentBlock, { type: 'text' | 'thinking' | 'tool_use' }>;

function unsigned(block: SignedBlock): HubContentBlock {
  const { signature: _signature, ...rest } = block;

  return rest;
}

function semanticTarget(block: HubContentBlock): Target | null {
  if (block.type === 'tool_use') return 'function';

  return block.type === 'text' || block.type === 'thinking' ? 'text' : null;
}

function signedTarget(block: SignedBlock): Target {
  return block.type === 'tool_use' ? 'function' : 'text';
}

function signedContentBlock(
  content: readonly HubContentBlock[],
  block: HubContentBlock,
  index: number,
): HubContentBlock[] {
  if (!isSignedBlock(block)) return [block];

  const signature = nativeSignature(block.signature);

  if (signature === null) return [block];

  return emptyTextBlock(block)
    ? [detachedCarrier(content, index, signature)]
    : [carrierBlock(signature, 'next', signedTarget(block)), unsigned(block)];
}

function isSignedBlock(block: HubContentBlock): block is SignedBlock {
  return block.type === 'text' || block.type === 'thinking' || block.type === 'tool_use';
}

function emptyTextBlock(block: HubContentBlock): boolean {
  return block.type === 'text' && block.text === '';
}

function detachedCarrier(
  content: readonly HubContentBlock[],
  index: number,
  signature: string,
): HubContentBlock {
  const previous = adjacentSemanticTarget(content, index - 1);
  const next = adjacentSemanticTarget(content, index + 1);

  return previous !== null
    ? carrierBlock(signature, 'previous', previous)
    : carrierBlock(signature, 'next', next ?? 'text');
}

function adjacentSemanticTarget(content: readonly HubContentBlock[], index: number): Target | null {
  const block = content[index];

  return block === undefined ? null : semanticTarget(block);
}

export function geminiClaudeCarrierResponse(response: HubResponse): HubResponse {
  return {
    ...response,
    content: response.content.flatMap((block, index) =>
      signedContentBlock(response.content, block, index),
    ),
  };
}

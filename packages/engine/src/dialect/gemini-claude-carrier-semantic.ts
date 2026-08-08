import type { HubContentBlock } from './hub';

export type GeminiClaudeCarrierTarget = 'text' | 'function';

export function geminiClaudeSemanticTarget(
  block: HubContentBlock | undefined,
): GeminiClaudeCarrierTarget | null {
  if (block === undefined) return null;
  if (block.type === 'tool_use') return 'function';
  if (block.type === 'text') return 'text';
  if (block.type === 'thinking') return thinkingTarget(block.text);

  return null;
}

export function hasPreviousGeminiTool(content: readonly HubContentBlock[], index: number): boolean {
  return content.slice(0, index).some((block) => block.type === 'tool_use');
}

export function signedGeminiBlock(block: HubContentBlock, signature: string): HubContentBlock {
  return block.type === 'text' || block.type === 'thinking' || block.type === 'tool_use'
    ? { ...block, signature }
    : block;
}

function thinkingTarget(text: string): GeminiClaudeCarrierTarget | null {
  return text === '' ? null : 'text';
}

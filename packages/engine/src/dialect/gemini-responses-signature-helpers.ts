import type { GeminiPart } from './gemini-wire';

import { isGeminiBypass, nativeGeminiSignature } from '../provider/gemini-signature';

export function geminiResponseSignature(value: unknown): string | undefined {
  const signature = nativeGeminiSignature(value);

  return signature === null || isGeminiBypass(signature) ? undefined : signature;
}

export function geminiReasoningSignature(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export function detachedGeminiSignature(part: GeminiPart): string | undefined {
  if (part.functionCall !== undefined || part.thought === true) return undefined;
  if (part.text !== undefined && part.text !== '') return undefined;

  return geminiResponseSignature(part.thoughtSignature);
}

export function isVisibleGeminiText(part: GeminiPart): boolean {
  return part.functionCall === undefined && part.thought !== true && part.text !== undefined;
}

import type { GeminiPart } from './gemini-wire';
import type { HubBlockOpening } from './hub';

export function geminiThinkingOpening(part: GeminiPart): HubBlockOpening {
  const signature = nonEmptyString(part.thoughtSignature);

  return {
    kind: 'thinking',
    ...(signature === undefined ? {} : { signature }),
    ...(part.responsesSignatureDirection === undefined
      ? {}
      : { carrierDirection: part.responsesSignatureDirection }),
    ...(part.responsesSignatureTarget === undefined
      ? {}
      : { carrierTarget: part.responsesSignatureTarget }),
  };
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

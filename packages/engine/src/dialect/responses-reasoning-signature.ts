import { responsesItemForGeminiReasoningSignature } from './responses-gemini-carrier';

function encryptedContentValue(
  carrier: string | undefined,
  signature: string | undefined,
): string | undefined {
  return carrier ?? signature;
}

export function responsesReasoningEncryptedContent(
  signature: string | undefined,
  direction: 'next' | 'previous' | 'standalone' = 'standalone',
  target: 'text' | 'function' | 'any' = 'any',
): { encrypted_content?: string } {
  const carrier = responsesItemForGeminiReasoningSignature(signature, direction, target);
  const encryptedContent = encryptedContentValue(carrier?.encrypted_content, signature);

  return encryptedContent === undefined ? {} : { encrypted_content: encryptedContent };
}

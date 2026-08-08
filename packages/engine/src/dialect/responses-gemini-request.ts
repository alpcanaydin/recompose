import type { ResponsesRequest } from './responses-wire';

import { decodeGeminiResponsesCarrier } from '../provider/gemini-responses-carrier';
import { nativeGeminiSignature } from '../provider/gemini-signature';
import { normalizeResponsesGeminiRequestState } from './responses-gemini-request-state';

export function responsesRequestForGemini(request: ResponsesRequest): ResponsesRequest {
  const last = request.input.at(-1);

  const withoutPrefill =
    last?.type === 'message' && last.role === 'assistant' && !hasLeadingTextCarrier(request)
      ? { ...request, input: request.input.slice(0, -1) }
      : request;

  return normalizeResponsesGeminiRequestState(withoutPrefill);
}

function hasLeadingTextCarrier(request: ResponsesRequest): boolean {
  const item = request.input.at(-2);

  if (item?.type !== 'reasoning' || typeof item.encrypted_content !== 'string') return false;

  const carrier = decodeGeminiResponsesCarrier(item.encrypted_content);

  return isNextTextCarrier(carrier) || nativeGeminiSignature(item.encrypted_content) !== null;
}

function isNextTextCarrier(carrier: ReturnType<typeof decodeGeminiResponsesCarrier>): boolean {
  if (!carrier.marked) return false;
  if (!carrier.valid) return false;

  return carrier.direction === 'next' && carrier.target === 'text';
}

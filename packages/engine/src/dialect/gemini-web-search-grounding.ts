import type { GeminiGroundingMetadata, GeminiPart, GeminiResponse } from './gemini-wire';

export { citedGroundingParts, webSearchResultsFromGrounding } from './gemini-web-search-citations';
import { citedGroundingParts, webSearchResultsFromGrounding } from './gemini-web-search-citations';

function candidateOf(response: GeminiResponse) {
  return response.candidates?.[0];
}

function groundingOf(response: GeminiResponse): GeminiGroundingMetadata | undefined {
  return candidateOf(response)?.groundingMetadata;
}

function normalizedParts(
  response: GeminiResponse,
  metadata: GeminiGroundingMetadata,
): GeminiPart[] {
  const id = searchToolId(response);

  return [
    searchUsePart(id, metadata.webSearchQueries?.[0]),
    searchResultPart(id, metadata),
    ...citedGroundingParts(responseText(response), metadata),
  ];
}

function responseText(response: GeminiResponse): string {
  return (
    candidateOf(response)
      ?.content?.parts.map((part) => part.text ?? '')
      .join('') ?? ''
  );
}

function searchToolId(response: GeminiResponse): string {
  return `srvtoolu_${response.responseId ?? response.response_id ?? 'translated'}`;
}

function searchUsePart(id: string, query: string | undefined): GeminiPart {
  const input = query === undefined || query === '' ? {} : { query };

  return { serverWebSearch: { kind: 'use', id, input } };
}

function searchResultPart(id: string, metadata: GeminiGroundingMetadata): GeminiPart {
  return {
    serverWebSearch: {
      kind: 'result',
      id,
      input: { results: webSearchResultsFromGrounding(metadata) },
    },
  };
}

export function normalizeGeminiWebSearchResponse(
  response: GeminiResponse,
  enabled: boolean,
): GeminiResponse {
  const candidate = candidateOf(response);
  const metadata = groundingOf(response);

  if (!enabled || candidate?.content === undefined || metadata === undefined) return response;

  return {
    ...response,
    candidates: [
      {
        ...candidate,
        content: { ...candidate.content, parts: normalizedParts(response, metadata) },
      },
    ],
    usageMetadata: { ...response.usageMetadata, webSearchRequests: 1 },
  };
}

function combinedResponse(responses: GeminiResponse[]): GeminiResponse | undefined {
  const last = responses.at(-1);

  if (last === undefined) return undefined;

  const candidate = candidateOf(last);

  if (candidate === undefined) return undefined;

  const text = combinedText(responses);

  return {
    ...last,
    candidates: [
      {
        ...candidate,
        content: {
          ...(candidate.content?.role === undefined ? {} : { role: candidate.content.role }),
          parts: [{ text }],
        },
      },
    ],
  };
}

function combinedText(responses: GeminiResponse[]): string {
  let text = '';

  for (const response of responses) text += responseText(response);

  return text;
}

async function bufferedResponses(source: AsyncIterable<GeminiResponse>): Promise<GeminiResponse[]> {
  const buffered: GeminiResponse[] = [];

  for await (const response of source) buffered.push(response);

  return buffered;
}

export async function* normalizeGeminiWebSearchStream(
  source: AsyncIterable<GeminiResponse>,
  enabled: boolean,
): AsyncIterable<GeminiResponse> {
  if (!enabled) {
    yield* source;

    return;
  }

  const combined = combinedResponse(await bufferedResponses(source));

  if (combined === undefined) return;

  yield {
    ...(combined.responseId === undefined ? {} : { responseId: combined.responseId }),
    ...(combined.modelVersion === undefined ? {} : { modelVersion: combined.modelVersion }),
    usageMetadata: { ...combined.usageMetadata, candidatesTokenCount: 0 },
  };
  yield normalizeGeminiWebSearchResponse(combined, true);
}

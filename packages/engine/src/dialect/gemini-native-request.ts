import type { GeminiContent, GeminiPart, GeminiRequest } from './gemini-wire';

function functionCallNames(content: GeminiContent): string[] {
  return content.parts.flatMap((part) => {
    const call = part.functionCall;

    return call === undefined ? [] : [call.name];
  });
}

type GeminiFunctionResponse = NonNullable<GeminiPart['functionResponse']>;

function backfilledPart(
  part: GeminiPart,
  response: GeminiFunctionResponse,
  name: string | undefined,
): GeminiPart {
  if (response.name.trim() !== '' || name === undefined) return part;

  return { ...part, functionResponse: { ...response, name } };
}

function backfilledContent(content: GeminiContent, names: readonly string[]): GeminiContent {
  let responseIndex = 0;
  const parts = content.parts.map((part) => {
    const response = part.functionResponse;

    if (response === undefined) return part;

    const backfilled = backfilledPart(part, response, names[responseIndex]);

    responseIndex += 1;

    return backfilled;
  });

  return { ...content, parts };
}

export function backfillGeminiFunctionResponseNames(request: GeminiRequest): GeminiRequest {
  let pendingNames: string[] = [];
  const contents = request.contents.map((content) => {
    if (content.role === 'model') {
      pendingNames = functionCallNames(content);

      return content;
    }

    if (pendingNames.length === 0) return content;

    const names = pendingNames;

    pendingNames = [];

    return backfilledContent(content, names);
  });

  return { ...request, contents };
}

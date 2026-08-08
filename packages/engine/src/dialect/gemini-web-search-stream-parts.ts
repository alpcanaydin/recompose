import type { GeminiPart } from './gemini-wire';
import type { HubBlockDelta, HubBlockOpening } from './hub';

export function geminiWebSearchOpening(part: GeminiPart): HubBlockOpening | null {
  const server = part.serverWebSearch;

  return server === undefined
    ? null
    : {
        kind: 'tool',
        id: server.id,
        name: 'web_search',
        signature: server.kind === 'use' ? 'server:web-search' : 'server:web-search-result',
        serverInput: server.input,
      };
}

export function geminiWebSearchDeltas(part: GeminiPart): HubBlockDelta[] | null {
  return part.serverWebSearch === undefined ? null : [];
}

export function geminiCitationDeltas(part: GeminiPart): HubBlockDelta[] {
  return (part.citations ?? []).map(
    (annotation): HubBlockDelta => ({ kind: 'annotation', annotation }),
  );
}

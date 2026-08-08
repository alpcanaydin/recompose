import type { GeminiGroundingMetadata, GeminiPart } from './gemini-wire';
import type { HubJsonObject } from './hub';

type GroundingSupport = {
  start: number;
  end: number;
  urls: string[];
  title: string;
};

function appendResult(
  results: HubJsonObject[],
  seen: Set<string>,
  chunk: NonNullable<GeminiGroundingMetadata['groundingChunks']>[number],
): void {
  const web = chunk.web;

  if (web === undefined) return;

  const url = normalizedUrl(web.uri);

  if (url === null) return;
  if (seen.has(url)) return;

  seen.add(url);
  results.push({ type: 'web_search_result', title: web.title ?? '', url, page_age: null });
}

function normalizedUrl(value: string | undefined): string | null {
  const url = value?.trim() ?? '';

  return url === '' ? null : url;
}

export function webSearchResultsFromGrounding(metadata: GeminiGroundingMetadata): HubJsonObject[] {
  const seen = new Set<string>();
  const results: HubJsonObject[] = [];

  for (const chunk of metadata.groundingChunks ?? []) {
    appendResult(results, seen, chunk);
  }

  return results;
}

function supportFrom(
  support: NonNullable<GeminiGroundingMetadata['groundingSupports']>[number],
  metadata: GeminiGroundingMetadata,
): GroundingSupport | null {
  const segment = validSegment(support.segment);

  if (segment === null) return null;

  const refs = chunkRefs(support.groundingChunkIndices ?? [], metadata);

  return {
    start: segment.startIndex,
    end: segment.endIndex,
    urls: refs.map((ref) => ref.url),
    title: refs[0]?.title ?? '',
  };
}

function validSegment(
  segment: NonNullable<GeminiGroundingMetadata['groundingSupports']>[number]['segment'],
): { startIndex: number; endIndex: number } | null {
  if (segment?.startIndex === undefined) return null;
  if (segment.endIndex === undefined) return null;

  return { startIndex: segment.startIndex, endIndex: segment.endIndex };
}

function chunkRefs(indices: number[], metadata: GeminiGroundingMetadata) {
  const refs: { url: string; title: string }[] = [];

  for (const index of indices) {
    const ref = chunkRef(metadata, index);

    if (ref !== null) refs.push(ref);
  }

  return refs;
}

function chunkRef(
  metadata: GeminiGroundingMetadata,
  index: number,
): { url: string; title: string } | null {
  const web = webAt(metadata, index);

  if (web === undefined) return null;
  if (web.uri === undefined) return null;

  return { url: web.uri, title: titleOf(web.title) };
}

function titleOf(title: string | undefined): string {
  return title ?? '';
}

function webAt(metadata: GeminiGroundingMetadata, index: number) {
  const chunks = metadata.groundingChunks;

  return chunks === undefined ? undefined : chunks[index]?.web;
}

function supportsOf(metadata: GeminiGroundingMetadata): GroundingSupport[] {
  const supports: GroundingSupport[] = [];

  for (const value of metadata.groundingSupports ?? []) {
    const support = supportFrom(value, metadata);

    if (support !== null) supports.push(support);
  }

  return supports;
}

function byteSlice(text: string, start: number, end: number): string {
  return Buffer.from(text).subarray(start, end).toString();
}

function citation(support: GroundingSupport, text: string): HubJsonObject[] {
  const url = support.urls[0];

  return url === undefined
    ? []
    : [
        {
          type: 'web_search_result_location',
          cited_text: text,
          url,
          title: support.title,
        },
      ];
}

function appendGap(parts: GeminiPart[], text: string, start: number, end: number): void {
  if (start < end) parts.push({ text: byteSlice(text, start, end) });
}

function appendCitedPart(
  parts: GeminiPart[],
  text: string,
  support: GroundingSupport,
  start: number,
): void {
  const cited = byteSlice(text, start, support.end);

  if (cited !== '') parts.push({ text: cited, citations: citation(support, cited) });
}

function appendSupport(
  parts: GeminiPart[],
  text: string,
  support: GroundingSupport,
  lastEnd: number,
): number {
  if (support.end <= lastEnd) return lastEnd;

  appendGap(parts, text, lastEnd, Math.min(support.start, Buffer.byteLength(text)));
  appendCitedPart(parts, text, support, Math.max(lastEnd, support.start));

  return Math.max(lastEnd, support.end);
}

export function citedGroundingParts(text: string, metadata: GeminiGroundingMetadata): GeminiPart[] {
  const parts: GeminiPart[] = [];
  let lastEnd = 0;

  for (const support of supportsOf(metadata)) {
    lastEnd = appendSupport(parts, text, support, lastEnd);
  }

  appendGap(parts, text, lastEnd, Buffer.byteLength(text));

  return parts.length === 0 && text !== '' ? [{ text }] : parts;
}

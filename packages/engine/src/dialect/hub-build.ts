import type { HubImageBlock, HubImageSource, HubJsonObject, HubMessage } from './hub';

function isJsonObject(value: unknown): value is HubJsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseToolArguments(raw: string): HubJsonObject {
  try {
    const parsed: unknown = JSON.parse(raw);

    return isJsonObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const dataUriPrefix = 'data:';
const base64Marker = ';base64,';

function parseBase64DataUri(text: string): { mediaType: string; data: string } | undefined {
  if (!text.startsWith(dataUriPrefix)) {
    return undefined;
  }

  const markerAt = text.indexOf(base64Marker);

  if (markerAt < 0) {
    return undefined;
  }

  const mediaType = text.slice(dataUriPrefix.length, markerAt);
  const data = text.slice(markerAt + base64Marker.length);

  return mediaType.length === 0 ? undefined : { mediaType, data };
}

export function imageSourceFromUrl(url: string): HubImageSource {
  const parsed = parseBase64DataUri(url);

  return parsed === undefined ? { type: 'url', url } : { type: 'base64', ...parsed };
}

export function imageBlockFromDataUri(text: string): HubImageBlock | undefined {
  const parsed = parseBase64DataUri(text);

  if (parsed === undefined || !parsed.mediaType.startsWith('image/')) {
    return undefined;
  }

  return { type: 'image', source: { type: 'base64', ...parsed } };
}

export function mergeAdjacentSameRole(messages: readonly HubMessage[]): HubMessage[] {
  const merged: HubMessage[] = [];

  for (const message of messages) {
    if (message.content.length === 0) continue;

    const last = merged.at(-1);

    if (canMergeMessages(last, message)) {
      merged[merged.length - 1] = {
        role: last.role,
        content: [...last.content, ...message.content],
      };

      continue;
    }

    merged.push(message);
  }

  return merged;
}

function canMergeMessages(last: HubMessage | undefined, next: HubMessage): last is HubMessage {
  return (
    last !== undefined &&
    last.role === next.role &&
    last.boundary === undefined &&
    next.boundary === undefined
  );
}

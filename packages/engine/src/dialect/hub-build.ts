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

  return parsed === undefined
    ? undefined
    : { type: 'image', source: { type: 'base64', ...parsed } };
}

export function mergeAdjacentSameRole(messages: readonly HubMessage[]): HubMessage[] {
  const merged: HubMessage[] = [];

  for (const message of messages) {
    const last = merged.at(-1);

    if (last !== undefined && last.role === message.role) {
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

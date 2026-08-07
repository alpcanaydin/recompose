import type { Crossing, JsonObject, ProxyDialect } from '../gateway-wire';

import { isJsonObject, parsedJson } from '../gateway-wire';

const defaultVertexOrigin = 'https://aiplatform.googleapis.com';

export type VertexCredential =
  | { kind: 'api-key'; apiKey: string; baseUrl?: string | undefined }
  | { kind: 'bearer'; accessToken: string; projectId: string; location: string };

function nonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function parsedCredential(secret: string): JsonObject | null {
  const value = parsedJson(secret);

  return isJsonObject(value) ? value : null;
}

function apiKeyCredential(value: JsonObject): VertexCredential | null {
  const apiKey = nonBlank(value['api_key']);

  return apiKey === undefined
    ? null
    : { kind: 'api-key', apiKey, baseUrl: nonBlank(value['base_url']) };
}

function bearerCredential(value: JsonObject): VertexCredential | null {
  const accessToken = nonBlank(value['access_token']);
  const projectId = nonBlank(value['project_id']) ?? nonBlank(value['project']);

  return accessToken === undefined || projectId === undefined
    ? null
    : {
        kind: 'bearer',
        accessToken,
        projectId,
        location: nonBlank(value['location']) ?? 'us-central1',
      };
}

function jsonCredential(value: JsonObject): VertexCredential | null {
  return apiKeyCredential(value) ?? bearerCredential(value);
}

export function parseVertexCredential(secret: string): VertexCredential | null {
  const parsed = parsedCredential(secret);

  if (parsed !== null) return jsonCredential(parsed);

  const apiKey = nonBlank(secret);

  return apiKey === undefined ? null : { kind: 'api-key', apiKey };
}

function regionalOrigin(location: string): string {
  return location === 'global'
    ? defaultVertexOrigin
    : `https://${encodeURIComponent(location)}-aiplatform.googleapis.com`;
}

function isDefaultOrigin(origin: string): boolean {
  return origin.replace(/\/+$/u, '') === defaultVertexOrigin;
}

function vertexOrigin(origin: string, credential: VertexCredential): string {
  if (credential.kind === 'api-key') {
    return (credential.baseUrl ?? origin).replace(/\/+$/u, '');
  }

  return (isDefaultOrigin(origin) ? regionalOrigin(credential.location) : origin).replace(
    /\/+$/u,
    '',
  );
}

function vertexAction(crossing: Crossing, action: 'generate' | 'count'): string {
  if (action === 'count') return 'countTokens';

  return crossing.raw['stream'] === true ? 'streamGenerateContent' : 'generateContent';
}

function vertexPath(credential: VertexCredential, model: string, action: string): string {
  const publisher = `/publishers/google/models/${encodeURIComponent(model)}:${action}`;

  return credential.kind === 'api-key'
    ? `/v1${publisher}`
    : `/v1/projects/${encodeURIComponent(credential.projectId)}/locations/${encodeURIComponent(credential.location)}${publisher}`;
}

export function vertexRequestUrl(
  origin: string,
  credential: VertexCredential,
  crossing: Crossing,
  action: 'generate' | 'count' = 'generate',
): string {
  const operation = vertexAction(crossing, action);
  const stream = operation === 'streamGenerateContent' ? '?alt=sse' : '';

  return `${vertexOrigin(origin, credential)}${vertexPath(credential, crossing.providerModel, operation)}${stream}`;
}

export function vertexHeaders(credential: VertexCredential): Record<string, string> {
  return credential.kind === 'api-key'
    ? { 'x-goog-api-key': credential.apiKey }
    : { authorization: `Bearer ${credential.accessToken}` };
}

function stripPart(part: unknown): unknown {
  if (!isJsonObject(part)) return part;

  const call = part['functionCall'];
  const response = part['functionResponse'];
  const updates = {
    ...strippedField('functionCall', call),
    ...strippedField('functionResponse', response),
  };

  return Object.keys(updates).length === 0 ? part : { ...part, ...updates };
}

function strippedField(key: string, value: unknown): JsonObject {
  const stripped = stripId(value);

  return stripped === value ? {} : { [key]: stripped };
}

function stripId(value: unknown): unknown {
  if (!isJsonObject(value) || !Object.hasOwn(value, 'id')) return value;

  const { id: _id, ...withoutId } = value;

  return withoutId;
}

function stripContent(content: unknown): unknown {
  if (!isJsonObject(content) || !Array.isArray(content['parts'])) return content;

  const parts = content['parts'];
  const stripped = parts.map(stripPart);

  return stripped.every((part, index) => part === parts[index])
    ? content
    : { ...content, parts: stripped };
}

export function stripVertexToolCallIds(body: JsonObject, source: ProxyDialect): JsonObject {
  if (source !== 'responses' || !Array.isArray(body['contents'])) return body;

  const contents = body['contents'];
  const stripped = contents.map(stripContent);

  return stripped.every((content, index) => content === contents[index])
    ? body
    : { ...body, contents: stripped };
}

export function vertexProviderBody(body: JsonObject, crossing: Crossing): JsonObject {
  const withoutSession = Object.hasOwn(body, 'session_id')
    ? Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'session_id'))
    : body;

  return stripVertexToolCallIds(withoutSession, crossing.dialect);
}

export function vertexCountBody(body: JsonObject): JsonObject {
  const excluded = new Set(['tools', 'generationConfig', 'safetySettings']);

  return Object.fromEntries(Object.entries(body).filter(([key]) => !excluded.has(key)));
}

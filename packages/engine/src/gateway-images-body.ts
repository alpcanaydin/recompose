import type { Context } from 'hono';

import type { JsonObject } from './gateway-wire';

import { InvalidJsonBodyError, isJsonObject, readJsonBody } from './gateway-wire';

export type PreparedImageBody = {
  model: string;
  body: JsonObject;
  stream: boolean;
};

function stringField(body: JsonObject, field: string): string {
  const value = body[field];

  return typeof value === 'string' ? value : '';
}

function jsonImageBody(body: JsonObject): PreparedImageBody {
  const stream = body['stream'] === true;
  const { stream: _stream, ...withoutStream } = body;

  return {
    model: stringField(body, 'model'),
    body: stream ? { ...withoutStream, stream: true } : withoutStream,
    stream,
  };
}

function numericField(name: string, value: string): number | string {
  if (!['n', 'output_compression', 'partial_images'].includes(name)) return value;

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) ? parsed : value;
}

function maskField(name: string, value: string): JsonObject | null {
  if (name !== 'mask[file_id]' && name !== 'mask[image_url]') return null;

  const key = name === 'mask[file_id]' ? 'file_id' : 'image_url';

  return { [key]: value };
}

function currentMask(body: JsonObject): JsonObject {
  return isJsonObject(body['mask']) ? body['mask'] : {};
}

function setField(body: JsonObject, name: string, value: string): void {
  const mask = maskField(name, value);

  if (mask !== null) {
    body['mask'] = { ...currentMask(body), ...mask };

    return;
  }

  body[name] = numericField(name, value);
}

async function dataUrl(file: File): Promise<string> {
  const mime = file.type.trim() === '' ? 'application/octet-stream' : file.type;
  const encoded = Buffer.from(await file.arrayBuffer()).toString('base64');

  return `data:${mime};base64,${encoded}`;
}

type ClassifiedEntry =
  | { kind: 'model'; value: string }
  | { kind: 'stream'; value: boolean }
  | { kind: 'field'; name: string; value: string }
  | { kind: 'existingImage'; value: string }
  | { kind: 'image'; value: string }
  | { kind: 'mask'; value: string }
  | { kind: 'ignored' };

function textEntry(name: string, value: string): ClassifiedEntry {
  if (name === 'model') return { kind: 'model', value };
  if (name === 'stream') return { kind: 'stream', value: value.trim().toLowerCase() === 'true' };
  if (name === 'images') return { kind: 'existingImage', value };

  return { kind: 'field', name, value };
}

async function fileEntry(name: string, value: File): Promise<ClassifiedEntry> {
  const encoded = await dataUrl(value);

  if (name === 'mask') return { kind: 'mask', value: encoded };
  if (name === 'image' || name === 'image[]') return { kind: 'image', value: encoded };

  return { kind: 'ignored' };
}

async function classifiedEntry(name: string, value: string | File): Promise<ClassifiedEntry> {
  return typeof value === 'string' ? textEntry(name, value) : fileEntry(name, value);
}

function entriesOfKind<T extends ClassifiedEntry['kind']>(
  entries: ClassifiedEntry[],
  kind: T,
): Array<Extract<ClassifiedEntry, { kind: T }>> {
  return entries.filter(
    (entry): entry is Extract<ClassifiedEntry, { kind: T }> => entry.kind === kind,
  );
}

function modelValue(entries: ClassifiedEntry[]): string {
  return entriesOfKind(entries, 'model')[0]?.value ?? '';
}

function streamValue(entries: ClassifiedEntry[]): boolean {
  return entriesOfKind(entries, 'stream')[0]?.value ?? false;
}

function withMedia(body: JsonObject, entries: ClassifiedEntry[], stream: boolean): JsonObject {
  const existing = entriesOfKind(entries, 'existingImage').map((entry) => entry.value);
  const uploaded = entriesOfKind(entries, 'image').map((entry) => ({ image_url: entry.value }));
  const images = [...existing, ...uploaded];
  const mask = entriesOfKind(entries, 'mask')[0]?.value;

  if (images.length > 0) body['images'] = images;
  if (mask !== undefined) body['mask'] = { image_url: mask };
  if (stream) body['stream'] = true;

  return body;
}

function preparedMultipart(entries: ClassifiedEntry[]): PreparedImageBody {
  const body: JsonObject = {};
  const stream = streamValue(entries);

  for (const entry of entriesOfKind(entries, 'field')) setField(body, entry.name, entry.value);

  return { model: modelValue(entries), body: withMedia(body, entries, stream), stream };
}

async function multipartImageBody(form: FormData): Promise<PreparedImageBody> {
  const entries = await Promise.all(
    [...form.entries()].map(async ([name, value]) => classifiedEntry(name, value)),
  );

  return preparedMultipart(entries);
}

export async function readImageBody(c: Context): Promise<PreparedImageBody> {
  const contentType = c.req.header('content-type') ?? '';

  if (!contentType.toLowerCase().startsWith('multipart/')) {
    return jsonImageBody(await readJsonBody(c));
  }

  try {
    return await multipartImageBody(await c.req.formData());
  } catch {
    throw new InvalidJsonBodyError('The multipart image request could not be read.');
  }
}

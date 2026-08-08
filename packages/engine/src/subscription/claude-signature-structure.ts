import { canonicalBase64, signatureVarint } from '../provider/signature-wire';

type ProtobufField = {
  number: number;
  value: Buffer;
  wire: number;
};

const CANONICAL_UUID = /^[\da-f]{8}-[\da-f]{4}-[1-5][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/iu;

function decodedBase64(value: string): Buffer | null {
  return canonicalBase64(value);
}

function fixedEnd(wire: number, offset: number, length: number): number | null {
  if (wire === 1) return offset + 8 <= length ? offset + 8 : null;
  if (wire === 5) return offset + 4 <= length ? offset + 4 : null;

  return null;
}

function fieldAt(bytes: Buffer, offset: number): { end: number; field: ProtobufField } | null {
  const tag = signatureVarint(bytes, offset);

  if (tag === null || tag.value < 8) return null;

  const number = Math.floor(tag.value / 8);
  const wire = tag.value & 7;

  if (wire === 0) return varintField(bytes, tag.end, number);
  if (wire === 2) return bytesField(bytes, tag.end, number);

  return fixedField(bytes, tag.end, number, wire);
}

function fixedField(
  bytes: Buffer,
  offset: number,
  number: number,
  wire: number,
): { end: number; field: ProtobufField } | null {
  const end = fixedEnd(wire, offset, bytes.length);

  return end === null ? null : { end, field: { number, value: bytes.subarray(offset, end), wire } };
}

function varintField(
  bytes: Buffer,
  offset: number,
  number: number,
): { end: number; field: ProtobufField } | null {
  const value = signatureVarint(bytes, offset);

  return value === null
    ? null
    : {
        end: value.end,
        field: { number, value: bytes.subarray(offset, value.end), wire: 0 },
      };
}

function bytesField(
  bytes: Buffer,
  offset: number,
  number: number,
): { end: number; field: ProtobufField } | null {
  const length = signatureVarint(bytes, offset);

  if (length === null) return null;

  const end = length.end + length.value;

  return end > bytes.length
    ? null
    : { end, field: { number, value: bytes.subarray(length.end, end), wire: 2 } };
}

function fieldsOf(bytes: Buffer): ProtobufField[] | null {
  const fields: ProtobufField[] = [];
  let offset = 0;

  while (offset < bytes.length) {
    const parsed = fieldAt(bytes, offset);

    if (parsed === null || parsed.end <= offset) return null;

    fields.push(parsed.field);
    offset = parsed.end;
  }

  return fields;
}

function fieldOf(fields: readonly ProtobufField[], number: number, wire: number): Buffer | null {
  const field = fields.find((candidate) => candidate.number === number);

  return field?.wire === wire ? field.value : null;
}

function nestedBytes(bytes: Buffer, number: number): Buffer | null {
  const fields = fieldsOf(bytes);

  return fields === null ? null : fieldOf(fields, number, 2);
}

function startsWithChannelId(channel: Buffer): boolean {
  const parsed = fieldAt(channel, 0);

  return parsed?.field.number === 1 && parsed.field.wire === 0;
}

function strictClassicPayload(decoded: Buffer): boolean {
  if (decoded[0] !== 0x12) return false;

  const container = nestedBytes(decoded, 2);

  if (container === null) return false;

  const channel = nestedBytes(container, 1);

  if (channel === null) return false;

  return startsWithChannelId(channel);
}

function strictClassicSingle(signature: string): string | null {
  const decoded = decodedBase64(signature);

  return signature.startsWith('E') && decoded !== null && strictClassicPayload(decoded)
    ? signature
    : null;
}

export function strictClassicClaudeSignature(signature: string): string | null {
  if (signature.startsWith('E')) return strictClassicSingle(signature);
  if (!signature.startsWith('R')) return null;

  const decoded = decodedBase64(signature);
  const inner = decoded?.toString('utf8');

  return inner === undefined ? null : strictClassicSingle(inner);
}

function utf8(value: Buffer): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(value);
  } catch {
    return null;
  }
}

function validContext(fields: readonly ProtobufField[]): boolean {
  const context = fields.find((field) => field.number === 11);

  if (context === undefined) return true;
  if (context.wire !== 2) return false;

  const value = utf8(context.value);

  return value !== null && CANONICAL_UUID.test(value);
}

function validCaisModel(fields: readonly ProtobufField[]): boolean {
  const modelBytes = fieldOf(fields, 6, 2);
  const model = modelBytes === null ? null : utf8(modelBytes);

  return model?.startsWith('claude-') === true;
}

function hasRequiredCaisFields(fields: readonly ProtobufField[]): boolean {
  const channelId = fieldOf(fields, 1, 0);
  const signature = fieldOf(fields, 5, 2);

  if (channelId === null || signature === null) return false;

  return signature.length > 0;
}

function validCaisChannel(fields: readonly ProtobufField[]): boolean {
  if (!hasRequiredCaisFields(fields)) return false;
  if (!validCaisModel(fields)) return false;

  return validContext(fields);
}

function caisContainer(decoded: Buffer): Buffer | null {
  if (decoded[0] !== 0x08) return null;

  const top = fieldsOf(decoded);

  if (top === null || fieldOf(top, 1, 0) === null) return null;

  return fieldOf(top, 2, 2);
}

function caisChannelFields(decoded: Buffer): ProtobufField[] | null {
  const container = caisContainer(decoded);

  if (container === null) return null;

  const channel = nestedBytes(container, 1);

  return channel === null ? null : fieldsOf(channel);
}

export function strictCaisClaudeSignature(signature: string): string | null {
  if (!signature.startsWith('C')) return null;

  const decoded = decodedBase64(signature);

  if (decoded === null) return null;

  const channelFields = caisChannelFields(decoded);

  return channelFields !== null && validCaisChannel(channelFields) ? signature : null;
}

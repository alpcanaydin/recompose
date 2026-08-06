import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

const CLAUDE_PREFIXES = new Set([
  'claude',
  'anthropic',
  'cais',
  'claude-cais',
  'claude_cais',
  'ccmax',
  'claude-code-max',
  'claude_code_max',
]);

function withoutProviderPrefix(signature: string): string | null {
  const trimmed = signature.trim();
  const separator = trimmed.indexOf('#');

  if (separator < 0) {
    return trimmed;
  }

  return CLAUDE_PREFIXES.has(trimmed.slice(0, separator).trim().toLowerCase())
    ? trimmed.slice(separator + 1).trim()
    : null;
}

function decodedBase64(value: string): Buffer | null {
  if (value === '' || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) {
    return null;
  }

  const decoded = Buffer.from(value, 'base64');

  return decoded.toString('base64') === value ? decoded : null;
}

function validSingleLayer(signature: string): string | null {
  const decoded = decodedBase64(signature);

  return signature.startsWith('E') && decoded?.[0] === 0x12 ? signature : null;
}

function validDoubleLayer(signature: string): string | null {
  const inner = decodedBase64(signature)?.toString('utf8');

  return signature.startsWith('R') && inner !== undefined ? validSingleLayer(inner) : null;
}

function validClassicSignature(signature: string): string | null {
  return validSingleLayer(signature) ?? validDoubleLayer(signature);
}

function validCaisSignature(signature: string): string | null {
  if (!signature.startsWith('C')) {
    return null;
  }

  const decoded = decodedBase64(signature);

  return decoded?.[0] === 0x08 && decoded.includes(Buffer.from('claude-')) ? signature : null;
}

export function nativeClaudeSignature(signature: unknown): string | null {
  if (typeof signature !== 'string') {
    return null;
  }

  const unprefixed = withoutProviderPrefix(signature);

  return unprefixed === null
    ? null
    : (validClassicSignature(unprefixed) ?? validCaisSignature(unprefixed));
}

function sanitizedToolUse(block: JsonObject): JsonObject {
  const {
    signature: _signature,
    thoughtSignature: _thoughtSignature,
    model: _model,
    ...clean
  } = block;

  return clean;
}

function sanitizedThinking(block: JsonObject): JsonObject | null {
  const signature = nativeClaudeSignature(block['signature']);

  return signature === null ? null : { ...block, signature };
}

function sanitizedBlock(block: unknown): unknown {
  if (!isJsonObject(block)) {
    return block;
  }

  if (block['type'] === 'tool_use') {
    return sanitizedToolUse(block);
  }

  return block['type'] === 'thinking' ? sanitizedThinking(block) : block;
}

function sanitizedMessage(message: unknown): unknown {
  if (!isJsonObject(message) || !Array.isArray(message['content'])) {
    return message;
  }

  const content = message['content'].map(sanitizedBlock).filter((block) => block !== null);

  return content.length === 0 ? null : { ...message, content };
}

export function sanitizeClaudeSignatures(body: JsonObject): JsonObject {
  if (!Array.isArray(body['messages'])) {
    return body;
  }

  const messages = body['messages'].map(sanitizedMessage).filter((message) => message !== null);

  return { ...body, messages };
}

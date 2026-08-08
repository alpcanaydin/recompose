import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';
import { canonicalBase64 } from '../provider/signature-wire';
import {
  strictCaisClaudeSignature,
  strictClassicClaudeSignature,
} from './claude-signature-structure';

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
const MAX_CLAUDE_SIGNATURE_LENGTH = 32 * 1024 * 1024;

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
  return canonicalBase64(value);
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
  return strictCaisClaudeSignature(signature);
}

export function nativeClaudeSignature(signature: unknown): string | null {
  if (typeof signature !== 'string') {
    return null;
  }

  const unprefixed = withoutProviderPrefix(signature);

  return unprefixed === null || unprefixed.length > MAX_CLAUDE_SIGNATURE_LENGTH
    ? null
    : (validClassicSignature(unprefixed) ?? validCaisSignature(unprefixed));
}

export function strictNativeClaudeSignature(signature: unknown): string | null {
  if (typeof signature !== 'string') return null;

  const unprefixed = withoutProviderPrefix(signature);

  return unprefixed === null || unprefixed.length > MAX_CLAUDE_SIGNATURE_LENGTH
    ? null
    : (strictClassicClaudeSignature(unprefixed) ?? strictCaisClaudeSignature(unprefixed));
}

export function antigravityClaudeSignature(signature: unknown): string | null {
  const native = strictNativeClaudeSignature(signature);

  return native === null || native.startsWith('C')
    ? null
    : Buffer.from(native, 'utf8').toString('base64');
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
  const signature = strictNativeClaudeSignature(block['signature']);

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
